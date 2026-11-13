// Envoi des rappels de Stroop Study. Lancé toutes les 15 minutes par GitHub Actions (.github/workflows/rappels.yml).
// Aucune dépendance : Node 20+ (fetch, crypto). Lit Firestore et envoie via Firebase Cloud Messaging (API HTTP v1).
// Secret requis : FIREBASE_SERVICE_ACCOUNT (le fichier JSON de clé de compte de service, collé tel quel).
// DRY_RUN=1 : calcule et affiche les messages sans rien envoyer ni écrire.

import { createSign } from 'node:crypto';

const DAY = 86400000;
const INTERVALS = { 0: 0, 1: 1, 2: 2, 3: 4, 4: 7, 5: 16 };
const FENETRE_MIN = 180; // rattrapage si le planificateur de GitHub prend du retard
const COMPTE_A_REBOURS = [14, 7, 3, 1];

// ---------- Dates (dans le fuseau de la personne) ----------
export function partsIn(tz, now = new Date()) {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' });
  const p = Object.fromEntries(f.formatToParts(now).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute), weekend: p.weekday === 'Sat' || p.weekday === 'Sun' };
}
const dayNum = (iso) => Math.round(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DAY);
const hm = (s, def) => { const m = /^(\d{1,2}):(\d{2})$/.exec(s || def); return Number(m[1]) * 60 + Number(m[2]); };
const plural = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`;

/** Série en cours (jours consécutifs avec au moins une réponse) se terminant hier ou aujourd'hui. */
export function serie(jours, todayIso) {
  const done = new Set(Object.keys(jours || {}).filter((k) => jours[k] > 0).map(dayNum));
  let d = dayNum(todayIso); if (!done.has(d)) d -= 1;
  let n = 0; while (done.has(d)) { n++; d--; }
  return n;
}

/** Cartes à revoir aujourd'hui (date locale de la dernière montée + intervalle de la boîte). */
export function aRevoir(items, todayIso, tz) {
  let n = 0;
  for (const p of Object.values(items || {})) {
    if (!p || !p.box) continue;
    const lastIso = partsIn(tz, new Date(p.last)).date;
    if (dayNum(lastIso) + (INTERVALS[p.box] ?? 0) <= dayNum(todayIso)) n++;
  }
  return n;
}

/** Décide des messages à envoyer maintenant pour une personne. Fonction pure (testable). */
export function decider(u, ctx) {
  const n = { heure: '09:30', soir: '18:30', rappel: true, serie: true, examens: true, ...(u.notif || {}) };
  if (!n.actif || !n.tokens || !Object.keys(n.tokens).length) return [];
  const tz = n.tz || 'Europe/Paris';
  const { date, minutes, weekend } = partsIn(tz, ctx.now);
  const deja = u.notifEnvoye || {};
  const revise = (u.jours?.[date] || 0) > 0;
  const out = [];

  // Examens à venir
  const exams = (u.matieres || []).flatMap((m) => (m.examens || []).map((e) => ({ code: m.code, label: e.label, j: dayNum(e.date) - dayNum(date) }))).filter((e) => e.j >= 0);
  const proche = exams.some((e) => e.j <= 14);
  const decompte = n.examens ? exams.filter((e) => COMPTE_A_REBOURS.includes(e.j)).sort((a, b) => a.j - b.j)[0] : null;

  // Ce qui attend, matière par matière
  const parMatiere = (ctx.matieres || []).map((m) => ({ code: m.code, due: m.due, neufs: m.neufs })).sort((a, b) => b.due - a.due);
  const dues = parMatiere.filter((m) => m.due > 0);
  const resume = dues.length
    ? `${plural(dues[0].due, 'carte')} à revoir en ${dues[0].code}${dues[1] ? `, ${dues[1].due} en ${dues[1].code}` : ''}. On s’y met ?`
    : (parMatiere.find((m) => m.neufs > 0) ? `De nouvelles notions t’attendent en ${parMatiere.find((m) => m.neufs > 0).code}. Une petite session ?` : 'Une petite session pour garder le rythme ?');

  // Matin : rappel du jour et/ou compte à rebours (un seul message)
  const tMatin = hm(n.heure, '09:30');
  if (deja.matin !== date && minutes >= tMatin && minutes < tMatin + FENETRE_MIN) {
    if (decompte) {
      const quoi = `${decompte.code}${decompte.label ? ` (${decompte.label})` : ''}`;
      out.push({ creneau: 'matin', title: decompte.j === 1 ? `Demain : examen de ${quoi}` : `J-${decompte.j} avant l’examen de ${quoi}`, body: revise ? 'Tu as déjà révisé aujourd’hui, bravo. Continue comme ça !' : resume });
    } else if (n.rappel && !revise && (!weekend || proche)) {
      out.push({ creneau: 'matin', title: 'Stroop t’attend', body: resume });
    }
  }

  // Soir : série en danger
  const tSoir = hm(n.soir, '18:30');
  const s = serie(u.jours, date);
  if (n.serie && deja.soir !== date && !revise && s >= 3 && minutes >= tSoir && minutes < 23 * 60) {
    out.push({ creneau: 'soir', title: `Ta série de ${s} jours est en danger`, body: 'Une seule carte suffit pour la garder. Stroop compte sur toi !' });
  }
  return out.slice(0, 2);
}

// ---------- Accès Google (compte de service) ----------
async function jeton(sa, fetchFn) {
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const head = b64({ alg: 'RS256', typ: 'JWT' });
  const claim = b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase.messaging', aud: sa.token_uri || 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
  const sig = createSign('RSA-SHA256').update(`${head}.${claim}`).sign(sa.private_key, 'base64url');
  const r = await fetchFn(sa.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claim}.${sig}` })
  });
  if (!r.ok) throw new Error(`Jeton refusé : ${r.status} ${await r.text()}`);
  return (await r.json()).access_token;
}

// ---------- Firestore REST ----------
export function dec(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, dec(x)]));
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(dec);
  return null;
}
const docObj = (d) => ({ id: d.name.split('/').pop(), ...Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, dec(v)])) });

function api(projet, token, fetchFn) {
  const base = `https://firestore.googleapis.com/v1/projects/${projet}/databases/(default)/documents`;
  const H = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  return {
    async liste(chemin) {
      const out = []; let page = '';
      do {
        const r = await fetchFn(`${base}/${chemin}?pageSize=300${page ? `&pageToken=${page}` : ''}`, { headers: H });
        if (!r.ok) throw new Error(`Lecture ${chemin} : ${r.status} ${await r.text()}`);
        const j = await r.json(); (j.documents || []).forEach((d) => out.push(docObj(d))); page = j.nextPageToken || '';
      } while (page);
      return out;
    },
    async marquer(uid, envoye) {
      const fields = { notifEnvoye: { mapValue: { fields: Object.fromEntries(Object.entries(envoye).map(([k, v]) => [k, { stringValue: v }])) } } };
      const r = await fetchFn(`${base}/users/${uid}?updateMask.fieldPaths=notifEnvoye`, { method: 'PATCH', headers: H, body: JSON.stringify({ fields }) });
      if (!r.ok) console.error('Écriture impossible', uid, r.status, await r.text());
    },
    async oublierJeton(uid, tok) {
      const r = await fetchFn(`${base}/users/${uid}?updateMask.fieldPaths=${encodeURIComponent(`notif.tokens.\`${tok}\``)}`, { method: 'PATCH', headers: H, body: JSON.stringify({ fields: {} }) });
      if (!r.ok) console.error('Suppression du jeton impossible', uid, r.status);
    },
    async envoyer(tok, msg) {
      const r = await fetchFn(`https://fcm.googleapis.com/v1/projects/${projet}/messages:send`, {
        method: 'POST', headers: H,
        body: JSON.stringify({ message: { token: tok, data: { title: msg.title, body: msg.body, url: './', tag: `stroop-${msg.creneau}` }, webpush: { headers: { Urgency: 'high', TTL: '10800' } } } })
      });
      if (r.ok) return 'ok';
      const t = await r.text();
      return r.status === 404 || /UNREGISTERED|registration-token-not-registered|INVALID_ARGUMENT/.test(t) ? 'perime' : `erreur ${r.status} ${t}`;
    }
  };
}

// ---------- Programme principal ----------
export async function main({ fetchFn = fetch, now = new Date(), env = process.env } = {}) {
  const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT || '{}');
  if (!sa.private_key) { console.log('Secret FIREBASE_SERVICE_ACCOUNT pas encore configuré : rien à faire.'); return []; }
  const dry = env.DRY_RUN === '1';
  const db = api(sa.project_id, await jeton(sa, fetchFn), fetchFn);

  const users = (await db.liste('users')).filter((u) => u.notif?.actif);
  if (!users.length) { console.log('Personne n’a activé les rappels.'); return []; }

  // Nombre de questions par matière (bibliothèque commune)
  const totals = {};
  for (const b of await db.liste('bibliotheque')) {
    try { totals[b.id] = JSON.parse(b.chapitresJson || '[]').reduce((a, c) => a + (c.elements || []).length, 0); } catch { totals[b.id] = 0; }
  }

  const journal = [];
  for (const u of users) {
    const tz = u.notif.tz || 'Europe/Paris';
    const { date } = partsIn(tz, now);
    const progres = Object.fromEntries((await db.liste(`users/${u.id}/progres`)).map((p) => [p.id, p.items || {}]));
    const matieres = (u.matieres || []).filter((m) => totals[m.code]).map((m) => {
      const items = progres[m.code] || {};
      return { code: m.code, due: aRevoir(items, date, tz), neufs: Math.max(0, totals[m.code] - Object.values(items).filter((p) => p?.box).length) };
    });
    const msgs = decider(u, { now, matieres });
    if (!msgs.length) continue;
    const envoye = { ...(u.notifEnvoye || {}) };
    for (const msg of msgs) {
      journal.push({ uid: u.id, ...msg });
      console.log(`${dry ? '[essai] ' : ''}${u.id.slice(0, 6)}… ${msg.creneau} : ${msg.title} — ${msg.body}`);
      if (dry) continue;
      for (const tok of Object.keys(u.notif.tokens || {})) {
        const res = await db.envoyer(tok, msg);
        if (res === 'perime') await db.oublierJeton(u.id, tok);
        else if (res !== 'ok') console.error(res);
      }
      envoye[msg.creneau] = date;
    }
    if (!dry) await db.marquer(u.id, envoye);
  }
  return journal;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
