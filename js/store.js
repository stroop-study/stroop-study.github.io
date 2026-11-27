// Couche de données : lecture et écriture dans Firestore, avec un petit cache en mémoire.
import { db, doc, getDoc, getDocFromCache, setDoc, collection, getDocs, getDocsFromCache, writeBatch, increment } from './firebase.js';
import { today } from './leitner.js';
import { checkFigure } from './figures.js';

export const COULEURS = ['orange', 'rose', 'jaune', 'bleu', 'violet', 'vert'];

const DEFAULT_MATIERES = [
  { code: 'APR1', nom: 'Apprentissage par la recherche', couleur: 'orange' },
  { code: 'LING', nom: 'Introduction à la linguistique', couleur: 'rose' },
  { code: 'CLI1', nom: 'Psychologie clinique', couleur: 'jaune' },
  { code: 'DIF1', nom: 'Psychologie différentielle', couleur: 'bleu' },
  { code: 'SOC1', nom: 'Psychologie sociale', couleur: 'violet' },
  { code: 'PAT1', nom: 'Psychopathologie', couleur: 'vert' }
].map((m, i) => ({ ...m, ordre: i, semestre: 'L1-S1', examens: [], modalites: [], negatif: false }));

const state = { uid: null, email: '', user: null, contenu: {}, progres: {}, revise: {}, touches: {}, isAdmin: false, acces: null, libOk: false };

// Lecture rapide : on demande au serveur, mais s'il traîne (métro, amphi), on prend la copie locale de
// Firestore au bout de 2,5 s ; la réponse du serveur, quand elle arrive, est passée à `plusTard`.
const LENT = 2500;
async function rapide(ref, plusTard) {
  const serveur = getDoc(ref);
  const r = await Promise.race([serveur.then((s) => ({ s }), (e) => ({ e })), new Promise((res) => setTimeout(() => res(null), LENT))]);
  if (r?.s) return r.s;
  if (r?.e?.code === 'permission-denied') throw r.e; // jamais de cache quand le serveur refuse
  try {
    const c = await getDocFromCache(ref);
    if (!r && plusTard) serveur.then(plusTard).catch(() => {});
    return c;
  } catch { if (r?.e) throw r.e; return serveur; }
}
const withTimeout = (p, ms = 6000) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

const userRef = () => doc(db, 'users', state.uid);
// Le contenu est dans une bibliothèque commune, gérée par l'admin et lisible par les invités.
const contenuRef = (code) => doc(db, 'bibliotheque', code);
// Depuis 3.4.0, chaque chapitre a son propre document (bibliotheque/{code}/chapitres/{id}) : plus de plafond
// d'environ 1 Mo par matière. Le document de la matière n'est plus qu'un sommaire ({ id, h } par chapitre).
const chapitreRef = (code, id) => doc(db, 'bibliotheque', code, 'chapitres', id);
const chapitresCol = (code) => collection(db, 'bibliotheque', code, 'chapitres');
/** Empreinte courte d'un texte (FNV-1a + longueur) : sert à ne réécrire et retélécharger que les chapitres modifiés. */
function empreinte(t) {
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36) + '-' + t.length.toString(36);
}
const accesRef = () => doc(db, 'config', 'acces');
const progresRef = (code) => doc(db, 'users', state.uid, 'progres', code);

export async function loadUser(uid, displayName, email) {
  state.uid = uid; state.email = (email || '').toLowerCase(); state.contenu = {}; state.progres = {}; state.touches = {}; state.isAdmin = false; state.acces = null; state.libOk = false;
  let snap = await rapide(userRef(), (s) => { if (s.exists() && state.uid === uid) fusionnerUser(s.data()); });
  // Fiche absente de la copie locale : seul le serveur peut dire qu'elle n'existe pas (sinon on écraserait tout).
  if (!snap.exists() && snap.metadata?.fromCache) snap = await getDoc(userRef());
  if (snap.exists()) {
    state.user = snap.data();
  } else {
    state.user = {
      prenom: (displayName || '').split(' ')[0] || '',
      semestre: 'L1-S1',
      matieres: DEFAULT_MATIERES,
      jours: {},
      theme: 'auto',
      creeLe: Date.now()
    };
    await setDoc(userRef(), state.user);
  }
  state.user.jours = state.user.jours || {};
  state.user.temps = state.user.temps || {};
  state.user.joursM = state.user.joursM || {};
  state.user.matieres = state.user.matieres || [];
  // L'adresse sert à reconnaître les testeur·ses dans les statistiques de l'admin.
  if (state.email && state.user.email !== state.email) { state.user.email = state.email; setDoc(userRef(), { email: state.email }, { merge: true }).catch(() => {}); }
  return state.user;
}

// Données du serveur arrivées après l'affichage : on garde le plus grand compteur de chaque jour
// (les réponses données entre-temps sur cet appareil sont déjà envoyées en incréments).
function fusionnerUser(d) {
  const u = state.user; if (!u) return;
  const maxi = (a = {}, b = {}) => { const o = { ...a }; for (const k in b) o[k] = Math.max(o[k] || 0, b[k] || 0); return o; };
  const jours = maxi(u.jours, d.jours), temps = maxi(u.temps, d.temps), joursM = { ...(d.joursM || {}) };
  for (const j in u.joursM || {}) joursM[j] = maxi(u.joursM[j], joursM[j]);
  Object.assign(u, d, { jours, temps, joursM, matieres: d.matieres || u.matieres });
}

export const getUser = () => state.user;
export const isAdmin = () => state.isAdmin;
export const libOk = () => state.libOk;
export const getAcces = () => state.acces;

/** Détermine si la personne connectée est l'admin (seul l'admin peut créer la fiche d'accès). */
export async function loadAcces() {
  try {
    const snap = await withTimeout(getDoc(accesRef()));
    if (snap.exists()) {
      state.acces = snap.data();
      state.isAdmin = (state.acces.admins || []).includes(state.uid);
    } else {
      const a = { admins: [state.uid], membres: [] };
      await withTimeout(setDoc(accesRef(), a));
      state.acces = a; state.isAdmin = true;
    }
  } catch (e) {
    state.isAdmin = false;
  }
  return state.isAdmin;
}

/** Charge toute la bibliothèque commune et ajoute ses matières à la liste de la personne. */
export async function loadLibrary() {
  try {
    const lire = async (snap, cacheSeul = false) => {
      const docs = []; snap.forEach((d) => docs.push(d));
      const res = await Promise.all(docs.map((d) => decodeContenu(d.id, d.data(), cacheSeul)));
      docs.forEach((d, i) => { if (res[i] || !state.contenu[d.id]) state.contenu[d.id] = res[i]; });
      return docs.length;
    };
    const serveur = getDocs(collection(db, 'bibliotheque'));
    const r = await Promise.race([serveur.then((s) => ({ s }), (e) => ({ e })), new Promise((res) => setTimeout(() => res(null), LENT))]);
    if (r?.s) await lire(r.s);
    else if (r?.e?.code === 'permission-denied') throw r.e; // pas d’accès : surtout ne pas lire le cache d’un autre compte
    else {
      // Serveur lent ou injoignable : la copie locale d'abord, la version du serveur dès qu'elle arrive.
      let n = 0;
      try { n = await lire(await getDocsFromCache(collection(db, 'bibliotheque')), true); } catch { n = 0; }
      if (!n) await lire(await withTimeout(serveur, 10000));
      else if (!r) serveur.then(lire).catch(() => {});
    }
    state.libOk = true;
  } catch (e) {
    state.libOk = false;
    return false;
  }
  const missing = Object.entries(state.contenu).filter(([code, c]) => c && !getMatiere(code));
  if (missing.length) {
    const list = [...state.user.matieres];
    for (const [code, c] of missing) {
      const m = c.matiere || {};
      list.push({ code, nom: m.nom || code, couleur: COULEURS.includes(m.couleur) ? m.couleur : 'orange', semestre: m.semestre || state.user.semestre, ordre: list.length, examens: [], modalites: m.modalites || [], negatif: false });
    }
    await saveUser({ matieres: list });
  }
  return true;
}

/** Firestore refuse les tableaux imbriqués : les chapitres sont donc stockés en texte JSON.
 * Ancien format : tout dans `chapitresJson`. Format 2 (3.4.0) : un sommaire `index` et un document par chapitre ;
 * un chapitre déjà en cache avec la même empreinte n'est pas retéléchargé. */
async function decodeContenu(code, d, cacheSeul = false) {
  if (!d) return null;
  const lireJ = (k) => { try { return typeof d[k] === 'string' ? JSON.parse(d[k]) : []; } catch { return []; } };
  if (typeof d.chapitresJson === 'string') {
    try { return { ...d, chapitres: JSON.parse(d.chapitresJson), glossaire: lireJ('glossaireJson'), auteurs: lireJ('auteursJson') }; } catch { return null; }
  }
  if (!Array.isArray(d.index)) return d;
  const trouves = {};
  await Promise.all(d.index.map(async ({ id, h }) => {
    try { const s = await getDocFromCache(chapitreRef(code, id)); if (s.exists() && s.data().h === h) trouves[id] = s.data().json; } catch { /* pas en cache */ }
  }));
  if (d.index.some(({ id }) => !(id in trouves))) {
    try {
      const snap = await (cacheSeul ? getDocsFromCache(chapitresCol(code)) : getDocs(chapitresCol(code)));
      snap.forEach((s) => { const x = s.data(); if (d.index.some((e) => e.id === s.id && e.h === x.h)) trouves[s.id] = x.json; });
    } catch (e) { if (e?.code === 'permission-denied') throw e; }
  }
  if (d.index.some(({ id }) => !(id in trouves))) return null; // incomplet (hors ligne, jamais téléchargé) : on n'affiche pas une matière tronquée
  try {
    return { ...d, chapitres: d.index.map(({ id }) => JSON.parse(trouves[id])), glossaire: lireJ('glossaireJson'), auteurs: lireJ('auteursJson') };
  } catch { return null; }
}

export async function setMembres(membres) {
  const clean = [...new Set(membres.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  await setDoc(accesRef(), { membres: clean }, { merge: true });
  state.acces = { ...(state.acces || {}), membres: clean };
}

export async function saveUser(patch) {
  Object.assign(state.user, patch);
  await setDoc(userRef(), patch, { merge: true });
}

/** Réglages des notifications (fusionnés avec l'existant). */
export const NOTIF_DEFAUT = { actif: false, heure: '09:30', soir: '18:30', rappel: true, serie: true, examens: true };
export const getNotif = () => ({ ...NOTIF_DEFAUT, ...(state.user.notif || {}) });
export async function saveNotif(patch) {
  state.user.notif = { ...(state.user.notif || {}), ...patch };
  if (patch.tokens) state.user.notif.tokens = { ...(state.user.notif.tokens || {}), ...patch.tokens };
  await setDoc(userRef(), { notif: patch }, { merge: true });
}

export function matieres() {
  return [...state.user.matieres].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
}
export const getMatiere = (code) => state.user.matieres.find((m) => m.code === code);

export async function saveMatiere(code, patch) {
  const list = state.user.matieres.map((m) => (m.code === code ? { ...m, ...patch } : m));
  await saveUser({ matieres: list });
}

/** Contenus présents dans la bibliothèque (pour l'écran Bibliothèque). */
export function contenusImportes() {
  return Object.entries(state.contenu).filter(([, c]) => c && c.chapitres).map(([code, c]) => ({
    code, nom: c.matiere?.nom || code, revision: c.revision ?? null, fichier: c.fichier || null, importeLe: c.importeLe || null,
    nbElements: c.chapitres.reduce((a, ch) => a + (ch.elements?.length || 0), 0)
  })).sort((a, b) => a.code.localeCompare(b.code));
}

/** Contenus complets de toutes les matières importées (pour la recherche et le glossaire). */
export const tousContenus = () => Object.entries(state.contenu).filter(([, c]) => c && c.chapitres).map(([code, c]) => ({ code, ...c }));

export async function getContenu(code) {
  if (state.contenu[code] !== undefined) return state.contenu[code];
  if (!state.libOk) return null;
  try {
    const snap = await getDoc(contenuRef(code));
    state.contenu[code] = snap.exists() ? await decodeContenu(code, snap.data()) : null;
  } catch (e) { state.contenu[code] = null; }
  return state.contenu[code];
}

export async function getProgres(code) {
  if (state.progres[code]) return state.progres[code];
  const touche = (state.touches[code] = state.touches[code] || new Set());
  const snap = await rapide(progresRef(code), (s) => {
    // Réponses venues d'un autre appareil : on les prend, sauf pour les cartes revues ici entre-temps.
    const items = (s.exists() && s.data().items) || {}, p = state.progres[code];
    if (p) for (const id in items) if (!touche.has(id)) p[id] = items[id];
    const r = (s.exists() && s.data().revise) || {}, rv = (state.revise[code] = state.revise[code] || {});
    for (const k in r) if (!touche.has('rev:' + k)) rv[k] = r[k];
  });
  state.progres[code] = (snap.exists() && snap.data().items) || {};
  state.revise[code] = { ...((snap.exists() && snap.data().revise) || {}), ...(state.revise[code] || {}) };
  return state.progres[code];
}

/** Notions cochées « révisée » dans l'onglet Réviser : clé `chapitre|notion` → true. */
export async function getRevise(code) {
  await getProgres(code);
  return state.revise[code] || (state.revise[code] = {});
}
export const cleNotion = (chap, notion) => `${chap}|${notion}`;
export async function setRevise(code, cles, val) {
  const r = await getRevise(code);
  const patch = {};
  const touche = (state.touches[code] = state.touches[code] || new Set());
  for (const k of cles) { r[k] = !!val; patch[k] = !!val; touche.add('rev:' + k); }
  setDoc(progresRef(code), { revise: patch }, { merge: true }).catch(console.error);
}

/** Ajoute du temps de révision (en secondes) à la journée. */
export function addTime(sec) {
  if (!(sec > 0)) return;
  const j = today();
  const s = Math.round(sec); if (!s) return;
  state.user.temps[j] = (state.user.temps[j] || 0) + s;
  // Incrément côté serveur : l'iPad et le téléphone s'additionnent au lieu de s'écraser.
  setDoc(userRef(), { temps: { [j]: increment(s) } }, { merge: true }).catch(console.error);
}

/** Enregistre la réponse à un élément et valide la journée. */
export async function recordAnswer(code, id, newState, { countDay = true } = {}) {
  const prog = await getProgres(code);
  prog[id] = { ...(prog[id] || {}), ...newState };
  (state.touches[code] = state.touches[code] || new Set()).add(id);
  const j = today();
  if (countDay) {
    state.user.jours[j] = (state.user.jours[j] || 0) + 1;
    const jm = (state.user.joursM[j] = state.user.joursM[j] || {});
    jm[code] = (jm[code] || 0) + 1;
    setDoc(userRef(), { jours: { [j]: increment(1) }, joursM: { [j]: { [code]: increment(1) } } }, { merge: true }).catch(console.error);
  }
  // Écritures non bloquantes : hors ligne, Firestore les garde et les envoie plus tard.
  setDoc(progresRef(code), { items: { [id]: prog[id] } }, { merge: true }).catch(console.error);
}

// Signalements partagés : chaque signalement est aussi copié dans /signalements pour que l'admin
// voie ceux de ses invité·es. Si les règles Firebase ne sont pas encore à jour, la copie échoue
// sans bloquer le signalement personnel.
const sigRef = (uid, code, id) => doc(db, 'signalements', `${uid}__${code}__${id}`.replace(/\//g, '_'));

export async function flagItem(code, id, note) {
  const prog = await getProgres(code);
  const flag = { note: note || '', date: Date.now() };
  prog[id] = { ...(prog[id] || {}), flag };
  await setDoc(progresRef(code), { items: { [id]: { flag } } }, { merge: true });
  setDoc(sigRef(state.uid, code, id), { uid: state.uid, email: state.email, prenom: state.user?.prenom || '', code, item: id, note: flag.note, date: flag.date, retire: false }).catch(() => {});
}

export async function unflagItem(code, id) {
  const prog = await getProgres(code);
  if (prog[id]) prog[id].flag = null;
  await setDoc(progresRef(code), { items: { [id]: { flag: null } } }, { merge: true });
  setDoc(sigRef(state.uid, code, id), { retire: true }, { merge: true }).catch(() => {});
}

/** Admin : signalements des invité·es (les siens sont déjà listés via la progression). */
export async function flagsInvites() {
  if (!state.isAdmin) return [];
  const res = [];
  try {
    const snap = await getDocs(collection(db, 'signalements'));
    snap.forEach((d) => { const f = d.data(); if (f && !f.retire && f.uid !== state.uid) res.push({ sid: d.id, ...f }); });
  } catch (e) { return null; } // règles pas encore mises à jour
  for (const f of res) {
    const contenu = await getContenu(f.code);
    f.it = contenu ? flatItems(contenu).find((x) => x.id === f.item) || null : null;
  }
  return res.sort((a, b) => (b.date || 0) - (a.date || 0));
}

/** Admin : fiches et progression de tous les comptes (null si les règles ne le permettent pas encore). */
export async function statsTesteurs() {
  if (!state.isAdmin) return [];
  let users;
  try { users = await withTimeout(getDocs(collection(db, 'users')), 15000); } catch { return null; }
  const res = [];
  users.forEach((d) => res.push({ uid: d.id, moi: d.id === state.uid, ...d.data(), progres: {} }));
  await Promise.all(res.map(async (u) => {
    try { (await getDocs(collection(db, 'users', u.uid, 'progres'))).forEach((p) => { u.progres[p.id] = p.data().items || {}; }); } catch { /* ignoré */ }
  }));
  return res;
}

export async function retirerFlagInvite(sid) {
  await setDoc(doc(db, 'signalements', sid), { retire: true }, { merge: true });
}

/** Tous les éléments d'une matière, à plat, avec leur chapitre. */
export function flatItems(contenu) {
  if (!contenu) return [];
  return contenu.chapitres.flatMap((c) => c.elements.map((e) => ({ ...e, chapitre: c.id, chapitreTitre: c.titre })));
}

function checkElement(e) {
  const bad = (what) => { throw new Error(`${what} : ${e.id}`); };
  const f = e.type === 'cas' ? (e.format || 'qcu') : e.type;
  if (e.type === 'cas' && !e.scenario) bad('Cas pratique sans scénario');
  switch (f) {
    case 'flashcard': if (!e.recto || !e.verso) bad('Flashcard incomplète'); break;
    case 'qcu': case 'qcm':
      if (!e.question || !Array.isArray(e.choix) || !Array.isArray(e.bonnes) || !e.bonnes.length) bad('Question incomplète'); break;
    case 'vf': if (!(e.affirmation || e.question) || typeof e.vrai !== 'boolean') bad('Vrai/faux incomplet'); break;
    case 'ordre': if (!Array.isArray(e.items) || e.items.length < 2) bad('Remise en ordre incomplète'); break;
    case 'assoc': if (!Array.isArray(e.paires) || e.paires.length < 2) bad('Association incomplète'); break;
    case 'tri': if (!Array.isArray(e.categories) || !Array.isArray(e.items) || !e.items.length) bad('Tri incomplet'); break;
    case 'courte': if (!e.question || !Array.isArray(e.reponses) || !e.reponses.length) bad('Réponse courte incomplète'); break;
    case 'redaction': if (!e.question || !Array.isArray(e.attendus) || e.attendus.length < 2) bad('Rédaction incomplète'); break;
    default: bad(`Type inconnu (${e.type})`);
  }
  for (const k of ['figure', 'figureVerso', 'figureCorrection']) if (e[k]) checkFigure(e[k], e.id);
}

/** Validation et import d'un fichier de contenu. */
export function validateContenu(data) {
  if (!data || data.format !== 'app-revisions/contenu') throw new Error('Ce fichier n’est pas un fichier de contenu de l’appli.');
  if (!data.matiere?.code || !Array.isArray(data.chapitres)) throw new Error('Fichier incomplet : matière ou chapitres manquants.');
  const ids = new Set();
  for (const c of data.chapitres) {
    if (!c.id || !c.titre || !Array.isArray(c.elements)) throw new Error(`Chapitre invalide : ${c.titre || c.id || '?'}`);
    for (const s of c.fiche || []) if (s.figure) checkFigure(s.figure, `${c.id} / ${s.id}`);
    for (const e of c.elements) {
      if (!e.id || ids.has(e.id)) throw new Error(`Identifiant manquant ou en double : ${e.id || '?'}`);
      ids.add(e.id);
      checkElement(e);
    }
  }
  for (const g of data.glossaire || []) if (!g.terme || !g.def || (g.criteres && !(Array.isArray(g.criteres) && g.criteres.every((c) => typeof c === 'string')))) throw new Error(`Entrée de glossaire incomplète : ${g.terme || '?'}`);
  for (const a of data.auteurs || []) if (!a.nom || !a.apport) throw new Error(`Auteur·rice incomplet : ${a.nom || '?'}`);
  return { code: data.matiere.code, nbChapitres: data.chapitres.length, nbElements: ids.size };
}

/** Numéro de version du contenu : champ « revision » du fichier, sinon « _v5 » dans son nom. */
function revisionDe(data, nomFichier) {
  if (Number.isInteger(data.revision)) return data.revision;
  const m = /_v(\d+)/i.exec(nomFichier || '');
  return m ? Number(m[1]) : null;
}

export async function importContenu(data, nomFichier = '', { forcer = false } = {}) {
  const info = validateContenu(data);
  const code = info.code;
  const importeLe = Date.now(), revision = revisionDe(data, nomFichier), fichier = nomFichier || null;
  // Garde-fou : on ne remplace pas une version plus récente par une plus ancienne (sauf choix explicite).
  const actuelle = state.contenu[code]?.revision;
  if (!forcer && Number.isInteger(actuelle) && Number.isInteger(revision) && revision < actuelle) {
    const e = new Error(`Tu as déjà la version ${actuelle} de ${code}, plus récente que ce fichier (v${revision}). Rien n’a été remplacé.`);
    e.ancienne = { code, actuelle, revision }; throw e;
  }
  const glossaire = Array.isArray(data.glossaire) ? data.glossaire : [], auteurs = Array.isArray(data.auteurs) ? data.auteurs : [];
  // Un document par chapitre ; garde-fou : un document Firestore ne peut pas dépasser 1 Mio (marge à 900 Ko).
  const ko = (t) => new Blob([t]).size, MAX = 900 * 1024;
  const chap = data.chapitres.map((c) => { const json = JSON.stringify(c); return { id: c.id, json, h: empreinte(json) }; });
  for (const c of chap) if (ko(c.json) > MAX) throw new Error(`Le chapitre ${c.id} pèse ${Math.round(ko(c.json) / 1024)} Ko : trop lourd pour être enregistré (limite d’environ 1 Mo). Rien n’a été remplacé : signale-le à Claude.`);
  const index = chap.map(({ id, h }) => ({ id, h }));
  const sommaire = { matiere: data.matiere, format: 2, index, glossaireJson: JSON.stringify(glossaire), auteursJson: JSON.stringify(auteurs), version: data.version || 1, importeLe, revision, fichier };
  if (ko(JSON.stringify(sommaire)) > MAX) throw new Error(`Le glossaire de ${code} est trop lourd pour être enregistré. Rien n’a été remplacé : signale-le à Claude.`);
  info.taille = chap.reduce((a, c) => a + ko(c.json), 0) + ko(JSON.stringify(sommaire));
  // Écriture atomique : les chapitres modifiés, la suppression des chapitres disparus, puis le sommaire.
  // Sommaire relu sur le serveur : un autre appareil a pu importer entre-temps.
  let avant = [];
  try { const s = await getDoc(contenuRef(code)); if (s.exists() && Array.isArray(s.data().index)) avant = s.data().index; } catch (e) { if (e?.code === 'permission-denied') throw e; }
  const hAvant = Object.fromEntries(avant.map((e) => [e.id, e.h]));
  const lot = writeBatch(db);
  let ecrits = 0;
  for (const c of chap) if (hAvant[c.id] !== c.h) { lot.set(chapitreRef(code, c.id), { json: c.json, h: c.h }); ecrits++; }
  for (const e of avant) if (!chap.some((c) => c.id === e.id)) lot.delete(chapitreRef(code, e.id));
  lot.set(contenuRef(code), sommaire);
  await lot.commit();
  info.chapitresEcrits = ecrits;
  state.contenu[code] = { ...sommaire, chapitres: data.chapitres, glossaire, auteurs };
  info.glossaire = glossaire.length; info.auteurs = auteurs.length;
  info.revision = revision;
  // Crée la matière si elle n'existe pas encore (nouveau semestre, nouvelle matière…).
  if (!getMatiere(code)) {
    const m = data.matiere;
    const list = [...state.user.matieres, {
      code, nom: m.nom || code, couleur: COULEURS.includes(m.couleur) ? m.couleur : 'orange',
      semestre: m.semestre || state.user.semestre, ordre: state.user.matieres.length, examens: [], modalites: m.modalites || [], negatif: false
    }];
    await saveUser({ matieres: list });
  } else if (data.matiere.modalites?.length) {
    await saveMatiere(code, { modalites: data.matiere.modalites });
  }
  return info;
}

/** Export complet des données de l'utilisatrice. */
export async function exportAll() {
  // Le contenu des cours n’est jamais exporté (bibliothèque privée) : seulement ta progression et tes réglages.
  const out = { exporteLe: new Date().toISOString(), user: state.user, progres: {} };
  const snap = await getDocs(collection(db, 'users', state.uid, 'progres'));
  snap.forEach((d) => { out.progres[d.id] = d.data(); });
  return out;
}

/** Signalements de toutes les matières. */
export async function allFlags() {
  const res = [];
  for (const m of matieres()) {
    const contenu = await getContenu(m.code);
    if (!contenu) continue;
    const prog = await getProgres(m.code);
    for (const it of flatItems(contenu)) {
      if (prog[it.id]?.flag) res.push({ matiere: m.code, item: it, flag: prog[it.id].flag });
    }
  }
  return res;
}
