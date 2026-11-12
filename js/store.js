// Couche de données : lecture et écriture dans Firestore, avec un petit cache en mémoire.
import { db, doc, getDoc, setDoc, collection, getDocs } from './firebase.js';
import { today } from './leitner.js';

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
    snap.forEach((d) => { state.contenu[d.id] = d.data(); });
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

export async function setMembres(membres) {
  const clean = [...new Set(membres.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  await setDoc(accesRef(), { membres: clean }, { merge: true });
  state.acces = { ...(state.acces || {}), membres: clean };
}

export async function saveUser(patch) {
  Object.assign(state.user, patch);
  await setDoc(userRef(), patch, { merge: true });
}

export function matieres() {
  return [...state.user.matieres].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
}
export const getMatiere = (code) => state.user.matieres.find((m) => m.code === code);

export async function saveMatiere(code, patch) {
  const list = state.user.matieres.map((m) => (m.code === code ? { ...m, ...patch } : m));
  await saveUser({ matieres: list });
}

export async function getContenu(code) {
  if (state.contenu[code] !== undefined) return state.contenu[code];
  if (!state.libOk) return null;
  try {
    const snap = await getDoc(contenuRef(code));
    state.contenu[code] = snap.exists() ? snap.data() : null;
  } catch (e) { state.contenu[code] = null; }
  return state.contenu[code];
}

export async function getProgres(code) {
  if (state.progres[code]) return state.progres[code];
  const snap = await getDoc(progresRef(code));
  state.progres[code] = (snap.exists() && snap.data().items) || {};
  return state.progres[code];
}

/** Enregistre la réponse à un élément et valide la journée. */
export async function recordAnswer(code, id, newState) {
  const prog = await getProgres(code);
  prog[id] = { ...(prog[id] || {}), ...newState };
  const j = today();
  state.user.jours[j] = (state.user.jours[j] || 0) + 1;
  // Écritures non bloquantes : hors ligne, Firestore les garde et les envoie plus tard.
  setDoc(progresRef(code), { items: { [id]: prog[id] } }, { merge: true }).catch(console.error);
  setDoc(userRef(), { jours: { [j]: state.user.jours[j] } }, { merge: true }).catch(console.error);
}

export async function flagItem(code, id, note) {
  const prog = await getProgres(code);
  const flag = { note: note || '', date: Date.now() };
  prog[id] = { ...(prog[id] || {}), flag };
  await setDoc(progresRef(code), { items: { [id]: { flag } } }, { merge: true });
}

export async function unflagItem(code, id) {
  const prog = await getProgres(code);
  if (prog[id]) prog[id].flag = null;
  await setDoc(progresRef(code), { items: { [id]: { flag: null } } }, { merge: true });
}

/** Tous les éléments d'une matière, à plat, avec leur chapitre. */
export function flatItems(contenu) {
  if (!contenu) return [];
  return contenu.chapitres.flatMap((c) => c.elements.map((e) => ({ ...e, chapitre: c.id, chapitreTitre: c.titre })));
}

/** Validation et import d'un fichier de contenu. */
export function validateContenu(data) {
  if (!data || data.format !== 'app-revisions/contenu') throw new Error('Ce fichier n’est pas un fichier de contenu de l’appli.');
  if (!data.matiere?.code || !Array.isArray(data.chapitres)) throw new Error('Fichier incomplet : matière ou chapitres manquants.');
  const ids = new Set();
  for (const c of data.chapitres) {
    if (!c.id || !c.titre || !Array.isArray(c.elements)) throw new Error(`Chapitre invalide : ${c.titre || c.id || '?'}`);
    for (const e of c.elements) {
      if (!e.id || ids.has(e.id)) throw new Error(`Identifiant manquant ou en double : ${e.id || '?'}`);
      ids.add(e.id);
      if (e.type === 'flashcard') { if (!e.recto || !e.verso) throw new Error(`Flashcard incomplète : ${e.id}`); }
      else if (e.type === 'qcu' || e.type === 'qcm') {
        if (!e.question || !Array.isArray(e.choix) || !Array.isArray(e.bonnes) || !e.bonnes.length) throw new Error(`Question incomplète : ${e.id}`);
      } else throw new Error(`Type inconnu : ${e.type} (${e.id})`);
    }
  }
  return { code: data.matiere.code, nbChapitres: data.chapitres.length, nbElements: ids.size };
}

export async function importContenu(data) {
  const info = validateContenu(data);
  const code = info.code;
  await setDoc(contenuRef(code), { matiere: data.matiere, chapitres: data.chapitres, version: data.version || 1, importeLe: Date.now() });
  state.contenu[code] = { matiere: data.matiere, chapitres: data.chapitres };
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
