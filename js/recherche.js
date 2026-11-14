// Recherche globale : index construit dans le téléphone à partir des contenus importés (aucun serveur).
// Tolère les accents, les majuscules, les débuts de mots et une petite faute de frappe.
import { normalize } from './types.js';

const VIDES = new Set('le la les l un une des de du d et ou a au aux en dans sur pour par avec sans ce cette ces se sa son ses qu que qui quoi est sont il elle on ne pas plus'.split(' '));
export const mots = (s) => normalize(s).split(' ').filter((w) => w && !VIDES.has(w));
const txt = (v) => (Array.isArray(v) ? v.join(' ') : v || '');

/** Distance d'édition bornée (on s'arrête dès que ça dépasse max). */
function proche(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]);
    }
    if (best > max) return false;
    prev = cur;
  }
  return prev[b.length] <= max;
}
/** Score d'un mot de la requête contre les mots d'un document : 3 exact, 2 début de mot, 1 faute de frappe. */
function scoreMot(q, ws) {
  let s = 0;
  for (const w of ws) {
    if (w === q) return 3;
    if (q.length >= 2 && w.startsWith(q)) s = Math.max(s, 2);
    else if (s < 1 && q.length >= 4 && /[a-z]/.test(q) && proche(q, w.slice(0, q.length + 1), q.length >= 8 ? 2 : 1)) s = 1;
  }
  return s;
}

/** Construit l'index : termes, auteur·rices, passages de fiches, questions. */
export function construireIndex(contenus) {
  const docs = [];
  for (const c of contenus) {
    const code = c.code;
    (c.glossaire || []).forEach((g, i) => docs.push({ k: 'terme', code, id: `${code}:t${i}`, g, titre: g.terme, poids: 4,
      tete: mots([g.terme, ...(g.aussi || [])].join(' ')), corps: mots(`${g.def} ${(g.voir || []).join(' ')} ${(g.criteres || []).join(' ').replace(/\*\*/g, '')}`) }));
    (c.auteurs || []).forEach((a, i) => docs.push({ k: 'auteur', code, id: `${code}:a${i}`, a, titre: a.nom, poids: 4,
      tete: mots(a.nom), corps: mots(`${a.reperes || ''} ${a.apport}`) }));
    for (const ch of c.chapitres) {
      for (const sec of ch.fiche || []) sec.points.forEach((p, i) => docs.push({ k: 'fiche', code, id: `${ch.id}:${sec.id}:${i}`, ch, sec, texte: p, titre: sec.titre, poids: 2,
        tete: mots(sec.titre), corps: mots(p) }));
      for (const e of ch.elements) docs.push({ k: 'question', code, id: e.id, e, ch, titre: e.notion || '', poids: 1,
        tete: mots(e.notion || ''), corps: mots([e.recto, e.verso, e.question, e.affirmation, e.scenario, e.explication].map(txt).join(' ')) });
    }
  }
  return docs;
}

/** Résultats triés par pertinence ; chaque mot de la requête doit être trouvé. */
export function chercher(index, requete) {
  const qs = mots(requete);
  if (!qs.length) return [];
  const res = [];
  for (const d of index) {
    let total = 0, ok = true;
    for (const q of qs) {
      const st = scoreMot(q, d.tete) * 2, sc = scoreMot(q, d.corps);
      const s = Math.max(st, sc);
      if (!s) { ok = false; break; }
      total += s;
    }
    if (ok) res.push({ d, score: total * d.poids + (normalize(d.titre) === normalize(requete) ? 50 : 0) });
  }
  return res.sort((a, b) => b.score - a.score).map((r) => r.d);
}

/** Questions liées à un terme : même notion, ou terme cité dans la question / la situation / l'explication. */
export function questionsDuTerme(contenu, g) {
  const cible = [g.terme, ...(g.aussi || [])].map(normalize).filter(Boolean);
  const notions = new Set(g.notions || []);
  const out = [];
  for (const ch of contenu.chapitres) for (const e of ch.elements) {
    // la bonne réponse compte (elle nomme souvent la notion), pas les distracteurs
    const bonnes = (e.bonnes || []).map((i) => txt(e.choix?.[i]));
    const t = ' ' + normalize([e.recto, e.verso, e.question, e.affirmation, e.scenario, e.explication, e.notion, ...bonnes].map(txt).join(' ')) + ' ';
    if (notions.has(e.notion) || cible.some((c) => t.includes(' ' + c + ' ') || t.includes(' ' + c + 's '))) out.push(e.id);
  }
  return out;
}

/** Surligne les mots de la requête dans un texte déjà échappé. */
export function surligner(htmlEchappe, requete) {
  const qs = mots(requete).filter((q) => q.length >= 2);
  if (!qs.length) return htmlEchappe;
  return htmlEchappe.replace(/[\p{L}\p{N}’'-]+/gu, (w) => (qs.some((q) => normalize(w).split(' ').some((n) => n.startsWith(q))) ? `<mark>${w}</mark>` : w));
}
