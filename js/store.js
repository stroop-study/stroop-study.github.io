// Couche de données : lecture et écriture dans Firestore, avec un petit cache en mémoire.
import { db, doc, getDoc, setDoc, collection, getDocs } from './firebase.js';
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

const state = { uid: null, email: '', user: null, contenu: {}, progres: {}, isAdmin: false, acces: null, libOk: false };

const withTimeout = (p, ms = 6000) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

const userRef = () => doc(db, 'users', state.uid);
// Le contenu est dans une bibliothèque commune, gérée par l'admin et lisible par les invités.
const contenuRef = (code) => doc(db, 'bibliotheque', code);
const accesRef = () => doc(db, 'config', 'acces');
const progresRef = (code) => doc(db, 'users', state.uid, 'progres', code);

export async function loadUser(uid, displayName, email) {
  state.uid = uid; state.email = (email || '').toLowerCase(); state.contenu = {}; state.progres = {}; state.isAdmin = false; state.acces = null; state.libOk = false;
  const snap = await getDoc(userRef());
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
  return state.user;
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
    const snap = await withTimeout(getDocs(collection(db, 'bibliotheque')), 10000);
    snap.forEach((d) => { state.contenu[d.id] = decodeContenu(d.data()); });
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

/** Firestore refuse les tableaux imbriqués : les chapitres sont donc stockés en texte JSON. */
function decodeContenu(d) {
  if (!d) return null;
  if (typeof d.chapitresJson === 'string') {
    try {
      const lire = (k) => { try { return typeof d[k] === 'string' ? JSON.parse(d[k]) : []; } catch { return []; } };
      return { ...d, chapitres: JSON.parse(d.chapitresJson), glossaire: lire('glossaireJson'), auteurs: lire('auteursJson') };
    } catch { return null; }
  }
  return d;
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
    state.contenu[code] = snap.exists() ? decodeContenu(snap.data()) : null;
  } catch (e) { state.contenu[code] = null; }
  return state.contenu[code];
}

export async function getProgres(code) {
  if (state.progres[code]) return state.progres[code];
  const snap = await getDoc(progresRef(code));
  state.progres[code] = (snap.exists() && snap.data().items) || {};
  return state.progres[code];
}

/** Ajoute du temps de révision (en secondes) à la journée. */
export function addTime(sec) {
  if (!(sec > 0)) return;
  const j = today();
  state.user.temps[j] = Math.round((state.user.temps[j] || 0) + sec);
  setDoc(userRef(), { temps: { [j]: state.user.temps[j] } }, { merge: true }).catch(console.error);
}

/** Enregistre la réponse à un élément et valide la journée. */
export async function recordAnswer(code, id, newState, { countDay = true } = {}) {
  const prog = await getProgres(code);
  prog[id] = { ...(prog[id] || {}), ...newState };
  const j = today();
  if (countDay) {
    state.user.jours[j] = (state.user.jours[j] || 0) + 1;
    const jm = (state.user.joursM[j] = state.user.joursM[j] || {});
    jm[code] = (jm[code] || 0) + 1;
    setDoc(userRef(), { joursM: { [j]: { [code]: jm[code] } } }, { merge: true }).catch(console.error);
  }
  // Écritures non bloquantes : hors ligne, Firestore les garde et les envoie plus tard.
  setDoc(progresRef(code), { items: { [id]: prog[id] } }, { merge: true }).catch(console.error);
  setDoc(userRef(), { jours: { [j]: state.user.jours[j] } }, { merge: true }).catch(console.error);
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

export async function importContenu(data, nomFichier = '') {
  const info = validateContenu(data);
  const code = info.code;
  const importeLe = Date.now(), revision = revisionDe(data, nomFichier), fichier = nomFichier || null;
  const glossaire = Array.isArray(data.glossaire) ? data.glossaire : [], auteurs = Array.isArray(data.auteurs) ? data.auteurs : [];
  await setDoc(contenuRef(code), { matiere: data.matiere, chapitresJson: JSON.stringify(data.chapitres), glossaireJson: JSON.stringify(glossaire), auteursJson: JSON.stringify(auteurs), version: data.version || 1, importeLe, revision, fichier });
  state.contenu[code] = { matiere: data.matiere, chapitres: data.chapitres, glossaire, auteurs, importeLe, revision, fichier };
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
  const out = { exporteLe: new Date().toISOString(), user: state.user, contenu: { ...state.contenu }, progres: {} };
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
