// Stroop Study — application principale (routeur + écrans).
import { figureHtml } from './figures.js';
import { son, getSons, setSons, setSilence, sessionAudio } from './sons.js';
import * as R from './recherche.js';
import * as N from './notifs.js';
import {
  auth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  sendEmailVerification, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut
} from './firebase.js';
import * as S from './store.js';
import { today, isDue, dueDate, nextState, mastery, notionStats, seenCount, prioritize, shuffle, streak, INTERVALS, PRIO_NOMS, niveauxChapitre, filtrerOuvertes } from './leitner.js';
import { TYPES, TYPE_KEYS, NIVEAUX, typeLabel, timeFor, formatOf, checkCourte, sameSet, resolveVariants, nbVariantes, normalize } from './types.js';

const VERSION = '2.18.1';
const $app = document.getElementById('app');
const $tab = document.getElementById('tabbar');
const $halos = document.getElementById('halos');
let currentUser = null;
let session = null; // session de révision en cours
let lastRecap = null;

/* ================= Utilitaires ================= */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const IC = {
  home: '<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',
  book: '<path d="M12 6.5C10.3 5.2 7.6 4.6 4 4.8v13.4c3.6-.2 6.3.4 8 1.8 1.7-1.4 4.4-2 8-1.8V4.8c-3.6-.2-6.3.4-8 1.7zM12 6.5V20"/>',
  chart: '<path d="M5 20V12M12 20V5M19 20v-9"/>',
  user: '<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 20a7 7 0 0 1 14 0"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  back: '<path d="M15 6l-6 6 6 6"/>',
  next: '<path d="M9 6l6 6-6 6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5" style="stroke-width:3"/>',
  flip: '<path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  redo: '<path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  gear: '<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5M5 20h14"/>',
  copy: '<path d="M9 9h10v10H9zM5 15V5h10"/>',
  pause: '<path d="M9 5v14M15 5v14" style="stroke-width:3"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0"/>',
  sun: '<path d="M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  books: '<path d="M5 4h4v16H5zM10 4h4v16h-4zM15.5 5l3.5-1 2.5 15-3.5 1z"/>',
  paw: '<g fill="currentColor" stroke="none"><ellipse cx="12" cy="15.6" rx="4.6" ry="3.9"/><ellipse cx="6.2" cy="10.4" rx="1.9" ry="2.4"/><ellipse cx="9.6" cy="6.8" rx="1.9" ry="2.5"/><ellipse cx="14.4" cy="6.8" rx="1.9" ry="2.5"/><ellipse cx="17.8" cy="10.4" rx="1.9" ry="2.4"/></g>',
  help: '<path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01"/>',
  play: '<path d="M8 5l11 7-11 7z"/>',
  prev: '<path d="M18 6l-8 6 8 6zM6 6v12"/>',
  suiv: '<path d="M6 6l8 6-8 6zM18 6v12"/>',
  casque: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>',
  cards: '<path d="M8 4h11v14H8zM5 7v13h11"/>',
  search: '<path d="M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15zM16 16l5 5"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>'
};
const ic = (n, cls = 'ic') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${IC[n]}</svg>`;
const STROOP = { dodo: 'stroop-dodo', contente: 'stroop-contente', sport: 'stroop-sport', fete: 'stroop-fete', etude: 'stroop-etude', arcenciel: 'stroop-arcenciel' };
/* Journée arc-en-ciel : au moins une réponse dans chacune des matières qui ont du contenu (6 à terme), le même jour. */
const avecContenuCodes = () => S.contenusImportes().map((c) => c.code);
const NB_ARC = () => avecContenuCodes().length;
const matieresDuJour = (u, k = today()) => { const ok = new Set(avecContenuCodes()); return Object.keys(u.joursM?.[k] || {}).filter((c) => ok.has(c) && u.joursM[k][c] > 0).length; };
const estArcEnCiel = (u, k = today()) => NB_ARC() > 1 && matieresDuJour(u, k) >= NB_ARC();
/* Paupières de Stroop : zone des yeux fermés (en % de l'image 640×640), posée par-dessus l'image normale. */
const YEUX = { contente: [28.44, 19.84, 46.41, 19.06], etude: [36.72, 24.84, 38.44, 22.19], sport: [30.63, 13.44, 43.13, 25.16] };
const stroopImg = (mood, cls = '') => {
  const y = YEUX[mood];
  if (!y) return `<img class="stroop a-${mood} ${cls}" src="assets/stroop/${STROOP[mood]}.webp" alt="Stroop la loutre" width="176" height="176" data-stroop>`;
  return `<span class="stroop stroop-w a-${mood} ${cls}" data-stroop data-yeux role="img" aria-label="Stroop la loutre"><img src="assets/stroop/${STROOP[mood]}.webp" alt="" width="176" height="176" draggable="false"><img class="yeux" src="assets/stroop/yeux-${mood}.webp" alt="" draggable="false" style="left:${y[0]}%;top:${y[1]}%;width:${y[2]}%;height:${y[3]}%"><span class="zzz" aria-hidden="true"><i>z</i><i>z</i><i>z</i></span></span>`;
};
/* ===== Stroop vivant : clignements, réaction au toucher, sieste, soirée ===== */
function estSoirH() { const h = new Date().getHours(); return h >= 21 || h < 4; }
const calme = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const stroopsVivants = () => [...document.querySelectorAll('[data-yeux]')].filter((el) => el.isConnected && !el.closest('.stroop-pop') && el.getClientRects().length);
function cligne(el, duree) {
  if (el.classList.contains('dort') || el.classList.contains('pense') || el.classList.contains('ferme')) return;
  el.classList.add('ferme');
  setTimeout(() => el.classList.remove('ferme'), duree);
}
(function boucleClignements() {
  const soir = estSoirH();
  document.body.classList.toggle('stroop-lourd', soir);
  if (!calme() && !document.hidden) {
    for (const el of stroopsVivants()) {
      const d = soir ? 520 : 150;
      setTimeout(() => { cligne(el, d); if (!soir && Math.random() < 0.22) setTimeout(() => cligne(el, d), d + 140); }, Math.random() * 900);
    }
  }
  setTimeout(boucleClignements, (soir ? 5000 : 3000) + Math.random() * 4000);
})();
// Sieste : 30 s sans rien toucher (hors session), Stroop s'assoupit. N'importe quel geste le réveille.
let dernierGeste = Date.now();
const reveil = () => { dernierGeste = Date.now(); document.querySelectorAll('[data-yeux].dort').forEach((el) => el.classList.remove('dort')); };
['pointerdown', 'keydown', 'wheel', 'touchmove'].forEach((t) => addEventListener(t, reveil, { passive: true }));
document.addEventListener('visibilitychange', () => { if (!document.hidden) reveil(); });
// Quitter l'appli en pleine session chronométrée (SMS, appel…) met la session en pause : le chrono s'arrête.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && session && (session.chrono || session.kind === 'rafale') && !session.pausedAt && location.hash === '#/session' && !document.querySelector('.pause-ov')) document.getElementById('pause')?.click();
});
setInterval(() => {
  if (calme() || Date.now() - dernierGeste < 30000 || location.hash.startsWith('#/session')) return;
  stroopsVivants().forEach((el) => el.classList.add('dort'));
}, 1000);
// Toucher : il ferme les yeux de plaisir et fait un petit bond.
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-yeux]'); if (!el || el.closest('.stroop-pop')) return;
  el.classList.remove('ferme', 'hop'); void el.offsetWidth; el.classList.add('ferme', 'hop');
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('ferme', 'hop'), 850);
});
// Série de bonnes réponses en session : Super Stroop surgit, les yeux fermés de joie.
function stroopSerie(n) {
  document.querySelector('.stroop-pop')?.remove();
  const d = document.createElement('div'); d.className = 'stroop-pop'; d.setAttribute('role', 'status');
  d.innerHTML = `${stroopImg('sport', 'mini ferme')}<span class="pop-txt"><b>${n} d’affilée !</b>${n >= 10 ? 'Inarrêtable.' : n >= 5 ? 'Quelle série !' : 'Ça s’enchaîne !'}</span>`;
  document.body.appendChild(d);
  setTimeout(() => d.classList.add('out'), 1900); setTimeout(() => d.remove(), 2300);
}
const pct = (n) => `${n} %`;
const plural = (n, s, p) => `${n} ${n > 1 ? (p || s + 's') : s}`;

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 2600);
}

function setHalo(couleur) {
  $halos.className = couleur ? `c-${couleur}` : '';
  $halos.querySelector('.h1').style.background = couleur ? 'var(--m-halo)' : '';
}

/* ================= Thème ================= */
const mq = window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const pref = localStorage.getItem('theme') || 'auto';
  const t = pref === 'auto' ? (mq.matches ? 'sombre' : 'clair') : pref;
  document.documentElement.dataset.theme = t;
  // barre du haut (barre d'état, navigateur) assortie au thème choisi dans l'appli
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
  const meta = document.createElement('meta'); meta.name = 'theme-color'; meta.content = t === 'sombre' ? '#10142A' : '#F4F5FB';
  document.head.appendChild(meta);
}
mq.addEventListener?.('change', applyTheme);
applyTheme();

/* ================= Navigation ================= */
function tabbar(active) {
  const tabs = [['#/', 'home', 'Accueil'], ['#/matieres', 'book', 'Matières'], ['#/progres', 'chart', 'Progrès'], ['#/profil', 'user', 'Profil']];
  $tab.innerHTML = tabs.map(([h, i, l]) => `<a href="${h}" ${active === h ? 'aria-current="page"' : ''}>${ic(i)}<span>${l}</span></a>`).join('');
  $tab.hidden = false; $app.classList.remove('no-tab');
}
function noTab() { $tab.hidden = true; $app.classList.add('no-tab'); }

function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }

async function route() {
  if (!currentUser) return;
  const h = location.hash || '#/';
  const [, page, arg] = h.split('/');
  window.scrollTo(0, 0);
  try {
    if (page === 'matiere' && arg) return await viewMatiere(decodeURIComponent(arg));
    if (page === 'matieres') return await viewMatieres();
    if (page === 'recherche') return viewRecherche(arg ? decodeURIComponent(arg) : null);
    if (page === 'session') return viewSession();
    if (page === 'ecoute') return viewEcoute();
    if (page === 'recap') return viewRecap();
    if (page === 'progres') return await viewProgres();
    if (page === 'profil') return await viewProfil(arg);
    return await viewHome();
  } catch (e) {
    console.error(e);
    $app.innerHTML = `<div class="card empty"><p><b>Oups, un souci.</b></p><p class="muted small">${esc(e.message)}</p><a class="btn plain" href="#/">Revenir à l'accueil</a></div>`;
  }
}
window.addEventListener('hashchange', () => { document.querySelectorAll('.sheet-back, .pause-ov').forEach((e) => e.remove()); if (lockedY !== null) { lockedY = 0; unlockScroll(); } route(); });

/* ================= Connexion ================= */
const GOOGLE_SVG = '<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';

async function googleLogin(onErr) {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try { await signInWithPopup(auth, provider); }
  catch (er) {
    const c = er?.code || '';
    if (c.includes('popup-blocked') || c.includes('operation-not-supported') || c.includes('web-storage')) {
      try { await signInWithRedirect(auth, provider); return; } catch (er2) { return onErr(authError(er2)); }
    }
    if (!c.includes('popup-closed') && !c.includes('cancelled-popup')) onErr(authError(er));
  }
}

function viewLogin(mode = 'google', err = '') {
  noTab(); setHalo(null);
  if (mode === 'google') {
    $app.innerHTML = `
    <section class="login">
      <div class="stroop-zone">
        <div class="bubble"><span class="who">Stroop</span>Coucou ! Connecte-toi et on révise ensemble.</div>
        ${stroopImg('etude')}
      </div>
      <div><h1 style="font-size:36px">Stroop Study</h1><p class="muted" style="margin:4px 0 0;font-weight:700">Révise en te testant, un peu chaque jour.</p></div>
      ${err ? `<p class="feedback ko" role="alert">${esc(err)}</p>` : ''}
      <button class="btn plain block" id="google" style="min-height:58px">${GOOGLE_SVG}Continuer avec Google</button>
      <button class="flag-btn" id="mail" style="align-self:center">Utiliser une adresse e-mail à la place</button>
      ${N.isStandalone() ? '' : `<button class="flag-btn" id="instL" style="align-self:center">${ic('download')}Installer Stroop sur mon téléphone</button>`}
    </section>`;
    document.getElementById('instL')?.addEventListener('click', () => installSheet());
    document.getElementById('google').onclick = () => googleLogin((m) => viewLogin('google', m));
    document.getElementById('mail').onclick = () => viewLogin('login');
    return;
  }
  const create = mode === 'create';
  $app.innerHTML = `
  <section class="login">
    <div class="stroop-zone">
      <div class="bubble"><span class="who">Stroop</span>${create ? 'Bienvenue ! Crée ton compte, je t’attends.' : 'Coucou ! Connecte-toi et on révise ensemble.'}</div>
      ${stroopImg('contente')}
    </div>
    <h1>${create ? 'Créer mon compte' : 'Connexion par e-mail'}</h1>
    <form id="f" class="list" novalidate>
      <label class="field">Adresse e-mail<input type="email" name="email" autocomplete="email" required></label>
      <label class="field">Mot de passe<input type="password" name="pw" autocomplete="${create ? 'new-password' : 'current-password'}" minlength="6" required></label>
      ${err ? `<p class="feedback ko" role="alert">${esc(err)}</p>` : ''}
      <button class="btn primary block" type="submit">${create ? 'Créer mon compte' : 'Me connecter'}</button>
    </form>
    <div class="between">
      <button class="flag-btn" id="sw">${create ? 'J’ai déjà un compte' : 'Créer un compte'}</button>
      ${create ? '' : '<button class="flag-btn" id="reset">Mot de passe oublié</button>'}
    </div>
    <div class="divider">ou</div>
    <button class="btn plain block" id="google">${GOOGLE_SVG}Continuer avec Google</button>
  </section>`;
  const f = document.getElementById('f');
  f.onsubmit = async (e) => {
    e.preventDefault();
    const email = f.email.value.trim(), pw = f.pw.value;
    try {
      if (create) { const cred = await createUserWithEmailAndPassword(auth, email, pw); sendEmailVerification(cred.user).catch(() => {}); }
      else await signInWithEmailAndPassword(auth, email, pw);
    } catch (er) { viewLogin(mode, authError(er)); }
  };
  document.getElementById('sw').onclick = () => viewLogin(create ? 'login' : 'create');
  const r = document.getElementById('reset');
  if (r) r.onclick = async () => {
    const email = f.email.value.trim();
    if (!email) return viewLogin(mode, 'Indique ton adresse e-mail, puis touche « Mot de passe oublié ».');
    try { await sendPasswordResetEmail(auth, email); toast('E-mail de réinitialisation envoyé'); } catch (er) { viewLogin(mode, authError(er)); }
  };
  document.getElementById('google').onclick = () => googleLogin((m) => viewLogin(mode, m));
}
function authError(e) {
  const c = e?.code || '';
  if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found')) return 'Adresse ou mot de passe incorrect.';
  if (c.includes('email-already-in-use')) return 'Un compte existe déjà avec cette adresse.';
  if (c.includes('weak-password')) return 'Mot de passe trop court (6 caractères minimum).';
  if (c.includes('invalid-email')) return 'Adresse e-mail invalide.';
  if (c.includes('popup')) return 'La fenêtre Google a été fermée ou bloquée. Essaie avec ton e-mail.';
  if (c.includes('operation-not-allowed')) return 'Ce mode de connexion n’est pas activé dans Firebase.';
  if (c.includes('network')) return 'Pas de connexion internet.';
  return 'Connexion impossible (' + (c || e?.message || 'erreur inconnue') + ').';
}

/* ================= Données dérivées ================= */
async function matiereStats(m) {
  const contenu = await S.getContenu(m.code);
  if (!contenu) return { m, contenu: null, total: 0, due: 0, neufs: 0, maitrise: 0, erreurs: 0, vus: 0 };
  const prog = await S.getProgres(m.code);
  const items = S.flatItems(contenu);
  const ids = items.map((i) => i.id);
  let due = 0, neufs = 0, erreurs = 0, flashDue = 0, flashTot = 0;
  for (const it of items) {
    const p = prog[it.id];
    if (it.type === 'flashcard') { flashTot++; if (!p || !p.box || isDue(p)) flashDue++; continue; }
    if (!p || !p.box) neufs++; else if (isDue(p)) due++;
    if (p?.err) erreurs++;
  }
  return { m, contenu, prog, items, total: items.length, due, neufs, flashDue, flashTot, maitrise: mastery(items, prog), erreurs, vus: seenCount(ids, prog) };
}

function nextExam(m) {
  const now = new Date(today()).getTime();
  return (m.examens || []).map((e) => ({ ...e, t: new Date(e.date).getTime() })).filter((e) => e.t >= now).sort((a, b) => a.t - b.t)[0];
}
const daysUntil = (t) => Math.round((t - new Date(today()).getTime()) / 86400000);

function weekStrip(jours, u = null) {
  const d = new Date(); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow);
  const L = ['L', 'M', 'M', 'J', 'V', 'S', 'D']; const t = today();
  let html = '';
  for (let i = 0; i < 7; i++) {
    const k = today(d); const done = !!jours[k]; const isT = k === t; const fut = k > t;
    const cls = done ? (u && estArcEnCiel(u, k) ? 'done arc' : 'done') : isT ? 'today' : fut ? 'future' : 'miss';
    html += `<div class="day"><span class="l">${L[i]}</span><span class="d ${cls}${isT ? ' today' : ''}" aria-label="${k}${done ? ', validé' : ''}">${done ? ic('paw', 'ic') : d.getDate()}</span></div>`;
    d.setDate(d.getDate() + 1);
  }
  return `<div class="card week" aria-label="Ma semaine">${html}</div>`;
}

/* ================= Accès à la bibliothèque ================= */
const needsVerif = () => auth.currentUser && !auth.currentUser.emailVerified && !S.isAdmin();
/* ================= Installer l'appli (tuto iOS / Android) ================= */
let promptInstall = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); promptInstall = e; });
window.addEventListener('appinstalled', () => { promptInstall = null; localStorage.setItem('stroop-install-ok', '1'); });
const UA = navigator.userAgent;
const estIOS = () => /iPhone|iPad|iPod/.test(UA) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const estAndroid = () => /Android/.test(UA);
const estMobile = () => estIOS() || estAndroid();
const SHARE_IC = '<svg class="ic" viewBox="0 0 24 24" style="width:18px;height:18px;vertical-align:-3px"><path d="M12 3v12M7 8l5-5 5 5M5 12v8h14v-8"/></svg>';
function installEtapes(os) {
  if (os === 'ios') return `<ol class="small" style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:8px">
      <li>Ouvre <b>stroop-study.github.io</b> dans <b>Safari</b> (sur iPhone récent, Chrome marche aussi).</li>
      <li>Touche le bouton <b>Partager</b> ${SHARE_IC} : en bas de l’écran sur iPhone, en haut sur iPad (parfois caché derrière « ⋯ »).</li>
      <li>Fais défiler et choisis <b>« Sur l’écran d’accueil »</b>.</li>
      <li>Touche <b>Ajouter</b>, en haut à droite. Stroop apparaît sur ton écran d’accueil 🦦</li>
    </ol>
    <p class="muted small" style="margin:0">Ouvre ensuite toujours Stroop depuis cette icône : c’est elle qui permet les rappels (iOS 16.4 ou plus récent).</p>`;
  return `<ol class="small" style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:8px">
      <li>Ouvre <b>stroop-study.github.io</b> dans <b>Chrome</b>.</li>
      <li>Touche le menu <b>⋮</b>, en haut à droite.</li>
      <li>Choisis <b>« Installer l’application »</b> (ou <b>« Ajouter à l’écran d’accueil »</b>, selon la version).</li>
      <li>Confirme avec <b>Installer</b>. Stroop arrive avec tes autres applis 🦦</li>
    </ol>
    <p class="muted small" style="margin:0">Sur Samsung Internet : menu ☰ → « Ajouter la page à » → « Écran d’accueil ».</p>`;
}
function installSheet() {
  const os = estIOS() ? 'ios' : estAndroid() ? 'android' : null;
  const deja = N.isStandalone();
  const sh = openSheet(`
    <div class="between"><h2>Installer Stroop</h2><button class="icon-btn" data-close aria-label="Fermer">${ic('close')}</button></div>
    ${deja ? '<p class="feedback ok" style="margin:0">C’est déjà fait : tu utilises Stroop comme une appli ✓</p>' : '<p class="muted small" style="margin:0">Ajoute Stroop sur ton écran d’accueil : il s’ouvre en plein écran comme une vraie appli, plus vite, et peut t’envoyer des rappels.</p>'}
    ${promptInstall && !deja ? `<button class="btn primary block" id="instNow">${ic('download')}Installer maintenant</button>` : ''}
    <div class="row" role="tablist" style="gap:8px">
      <button class="chip" data-os="ios" aria-pressed="${os !== 'android'}">iPhone · iPad</button>
      <button class="chip" data-os="android" aria-pressed="${os === 'android'}">Android</button>
    </div>
    <div id="instSteps" class="card" style="padding:14px;display:flex;flex-direction:column;gap:10px">${installEtapes(os === 'android' ? 'android' : 'ios')}</div>
    ${!os ? '<p class="muted small" style="margin:0">Sur ordinateur (Chrome ou Edge), clique sur l’icône d’installation à droite de la barre d’adresse.</p>' : ''}
    <button class="btn plain block" data-close>OK</button>`);
  const box = document.getElementById('instSteps');
  document.querySelectorAll('[data-os]').forEach((b) => b.onclick = () => {
    document.querySelectorAll('[data-os]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    box.innerHTML = installEtapes(b.dataset.os);
  });
  const now = document.getElementById('instNow');
  if (now) now.onclick = async () => { promptInstall.prompt(); const r = await promptInstall.userChoice.catch(() => null); promptInstall = null; if (r?.outcome === 'accepted') { localStorage.setItem('stroop-install-ok', '1'); toast('Stroop est installé 🦦'); } document.querySelector('.sheet-back')?.remove(); unlockScroll(); };
  return sh;
}
function installBanner() {
  if (N.isStandalone() || !estMobile() || localStorage.getItem('stroop-install-masque') || localStorage.getItem('stroop-install-ok')) return '';
  return `<div class="card" id="instBan" style="display:flex;gap:12px;align-items:center;padding:12px 14px">
    <div style="flex:1;min-width:0"><b class="small">Installe Stroop sur ton téléphone</b><div class="small muted">Plein écran, plus rapide, et les rappels.</div></div>
    <button class="btn soft" id="instGo" style="min-height:40px;padding:0 14px">Comment ?</button>
    <button class="icon-btn sm" id="instX" aria-label="Masquer">${ic('close')}</button></div>`;
}
function bindInstallBanner() {
  const go = document.getElementById('instGo'); if (go) go.onclick = () => installSheet();
  const x = document.getElementById('instX'); if (x) x.onclick = () => { localStorage.setItem('stroop-install-masque', '1'); document.getElementById('instBan')?.remove(); };
}

function verifBanner() {
  if (!needsVerif()) return '';
  return `<div class="card" style="padding:14px;display:flex;flex-direction:column;gap:10px"><b>Confirme ton adresse e-mail</b><span class="small muted">Clique sur le lien reçu par e-mail pour accéder au contenu partagé, puis touche « C’est fait ».</span><div class="two"><button class="btn plain" id="resend">Renvoyer le mail</button><button class="btn primary" id="verified">C’est fait</button></div></div>`;
}
function bindVerif() {
  document.getElementById('resend')?.addEventListener('click', async () => { try { await sendEmailVerification(auth.currentUser); toast('E-mail renvoyé'); } catch { toast('Réessaie dans quelques minutes'); } });
  document.getElementById('verified')?.addEventListener('click', async () => {
    await auth.currentUser.reload(); await auth.currentUser.getIdToken(true);
    if (!auth.currentUser.emailVerified) return toast('Adresse pas encore confirmée');
    await S.loadLibrary(); toast('Adresse confirmée !'); route();
  });
}

async function viewSetup(uid) {
  noTab(); setHalo(null);
  let rules = '';
  try { rules = (await (await fetch('firestore.rules', { cache: 'no-store' })).text()).split('ADMIN_UID').join(uid); } catch { rules = ''; }
  $app.innerHTML = `<section class="list" style="gap:14px">
    <div class="stroop-zone"><div class="bubble"><span class="who">Stroop</span>Presque prêt·e ! Il reste à ouvrir ta base de données.</div>${stroopImg('dodo')}</div>
    <h1>Dernier réglage</h1>
    <p style="margin:0">Ta base Firebase est encore verrouillée. Copie ces règles, colle-les dans Firebase (<b>Bases de données et stockage → Firestore → Règles</b>), puis clique sur <b>Publier</b>. Elles font de toi l’admin de la bibliothèque.</p>
    <button class="btn primary block" id="copy">${ic('copy')}Copier les règles</button>
    <pre class="card" style="padding:12px;font-size:11px;white-space:pre-wrap;overflow:auto;max-height:240px;margin:0">${esc(rules)}</pre>
    <p class="small muted" style="margin:0">Ton identifiant : <code>${esc(uid)}</code></p>
    <button class="btn plain block" id="retry">C’est publié, on réessaie</button>
    <button class="flag-btn" id="out" style="align-self:center">Me déconnecter</button>
  </section>`;
  document.getElementById('copy').onclick = async () => { try { await navigator.clipboard.writeText(rules); toast('Règles copiées !'); } catch { toast('Copie impossible : sélectionne le texte à la main'); } };
  document.getElementById('retry').onclick = () => location.reload();
  document.getElementById('out').onclick = () => signOut(auth);
}

/* ================= Accueil ================= */
async function viewHome() {
  tabbar('#/'); setHalo(null);
  const u = S.getUser();
  const all = await Promise.all(S.matieres().map(matiereStats));
  const s = streak(u.jours); const fait = u.jours[today()] || 0;
  const minutes = Math.floor((u.temps?.[today()] || 0) / 60);
  const arc = estArcEnCiel(u);
  const mood = !fait ? 'dodo' : arc ? 'arcenciel' : minutes >= 15 ? 'sport' : 'contente';
  if (mood === 'arcenciel' && localStorage.getItem('stroop-arc-joue') !== today()) { localStorage.setItem('stroop-arc-joue', today()); setTimeout(() => son('sport'), 400); }
  if (mood === 'sport' && localStorage.getItem('stroop-sport-joue') !== today()) { localStorage.setItem('stroop-sport-joue', today()); setTimeout(() => son('sport'), 400); }
  const avecContenu = all.filter((x) => x.contenu);
  const best = [...avecContenu].sort((a, b) => (b.due + b.neufs) - (a.due + a.neufs))[0];
  const todo = best ? Math.min(12, best.due + best.neufs) : 0;

  let bubble;
  if (!avecContenu.length) bubble = S.isAdmin() ? 'Zzz… Importe ton premier contenu dans Profil et on commence !' : 'Zzz… Le contenu n’est pas encore arrivé. Je fais une petite sieste en attendant.';
  else if (mood === 'dodo') bubble = s ? `Zzz… Ta série de ${plural(s, 'jour')} m’attend. Une carte suffit à me réveiller !` : 'Zzz… Une seule carte suffit pour me réveiller.';
  else if (mood === 'arcenciel') bubble = `Les ${NB_ARC()} matières dans la même journée ! Journée arc-en-ciel 🌈 Tu es incroyable.`;
  else if (mood === 'sport') bubble = `${fmtMin(minutes)} de révision aujourd’hui ! Super Stroop est à fond${s > 1 ? `, et ta série monte à ${s} jours` : ''}.`;
  else if (matieresDuJour(u) >= 3 && NB_ARC() - matieresDuJour(u) <= 3) bubble = `Déjà ${matieresDuJour(u)} matières aujourd’hui ! Plus que ${plural(NB_ARC() - matieresDuJour(u), 'matière')} pour une journée arc-en-ciel 🌈`;
  else bubble = todo ? 'Journée validée ! On s’en refait une petite ?' : 'Journée validée, et tout est à jour. Bravo !';

  const exams = all.map((x) => ({ x, e: nextExam(x.m) })).filter((o) => o.e).sort((a, b) => a.e.t - b.e.t);
  const saved = loadSaved();
  const hello = new Date().getHours() >= 18 || new Date().getHours() < 5 ? 'Bonsoir' : 'Bonjour';
  const dateStr = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  $app.innerHTML = `
  <header class="between hello">
    <div><div class="date">${esc(dateStr.charAt(0).toUpperCase() + dateStr.slice(1))}</div><h1>${hello}${u.prenom ? ' ' + esc(u.prenom) : ''}</h1></div>
    <span class="row" style="gap:8px"><a class="icon-btn" href="#/recherche" aria-label="Rechercher une notion">${ic('search')}</a><span class="chip" aria-label="Série de ${s} jours"><svg class="ic flame" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" stroke="none" d="M12 2c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.2 1.7 1 2.7 2 3-.5-3 .3-5.8 1-8.5z"/></svg><b class="title">${s}</b><span class="muted">${s > 1 ? 'jours' : 'jour'}</span></span></span>
  </header>
  <div class="stroop-zone">
    <div class="bubble" id="bubble"><span class="who">Stroop</span><span id="btxt">${esc(bubble)}</span></div>
    ${stroopImg(mood)}
  </div>
  ${verifBanner()}
  ${installBanner()}
  ${weekStrip(u.jours, u)}
  ${saved ? `<button class="cta" id="resume"><span><span class="t">Reprendre ma session</span><span class="s">${esc(saved.code)} · ${saved.results?.length || saved.i}/${saved.ids.length} · là où tu t’étais arrêté·e</span></span><span class="go">${ic('arrow')}</span></button>` : ''}
  ${best || !S.isAdmin() ?  (best ? `<button class="cta cta-m c-${best.m.couleur}" id="daily" ${todo ? '' : 'disabled'}><span><span class="t">Session du jour</span><span class="s">${todo ? `${esc(best.m.code)} · ${plural(todo, 'carte')} · environ ${Math.max(2, Math.round(todo / 2))} min` : 'Rien à revoir pour l’instant'}</span></span><span class="go">${ic('arrow')}</span></button>` : '') : `<a class="cta" href="#/profil/bibliotheque"><span><span class="t">Importer du contenu</span><span class="s">Ajoute ton premier fichier de révisions</span></span><span class="go">${ic('arrow')}</span></a>`}
  ${estSoir() && avecContenu.some((x) => x.flashTot) ? `<button class="card nuit-card" id="nuit"><span class="nuit-ic">${ic('moon')}</span><span style="flex:1;text-align:left"><b>Avant de dormir</b><span class="small muted" style="display:block">10 flashcards déjà vues, en douceur : sans chrono ni son.</span></span>${ic('next')}</button>` : ''}
  ${exams.length ? `<div class="row" style="flex-wrap:wrap">${exams.slice(0, 3).map((o) => `<span class="chip m c-${o.x.m.couleur}">${esc(o.x.m.code)} · ${daysUntil(o.e.t) === 0 ? 'aujourd’hui' : 'J-' + daysUntil(o.e.t)}</span>`).join('')}</div>` : ''}
  <div class="between"><h2 class="section-title">Mes matières</h2><span class="small muted">${esc(semestreLabel(u.semestre))}</span></div>
  <div class="subjects">
    ${all.filter((x) => x.m.semestre === u.semestre || !x.m.semestre).map((x) => `
      <a class="subject c-${x.m.couleur}" href="#/matiere/${encodeURIComponent(x.m.code)}">
        <span class="code">${esc(x.m.code)}</span>
        <span class="p">${x.contenu ? pct(x.maitrise) : 'à importer'}</span>
        <span class="bar"><span style="width:${x.maitrise}%"></span></span>
      </a>`).join('')}
  </div>`;

  const img = $app.querySelector('[data-stroop]');
  img.onclick = () => {
    if (!img.matches('[data-yeux]')) { img.classList.remove('wiggle'); void img.offsetWidth; img.classList.add('wiggle'); }
    const lines = ['Hop hop hop, au boulot !', 'Tu sais que je suis une loutre ultra motivée ?', 'Une carte, puis une autre… et voilà !', 'Effet Stroop : dire la couleur, pas le mot. Facile, non ?', 'Je crois en toi (et en tes neurones).'];
    document.getElementById('btxt').textContent = lines[Math.floor(Math.random() * lines.length)];
  };
  bindVerif();
  document.getElementById('resume')?.addEventListener('click', () => {
    session = saved;
    // la dernière question affichée avait déjà reçu une réponse : on reprend à la suivante
    const last = session.results[session.results.length - 1];
    if (last && last.id === session.ids[session.i]) session.i++;
    go('#/session');
  });
  document.getElementById('daily')?.addEventListener('click', () => startSession({ code: best.m.code, kind: 'jour' }));
  document.getElementById('nuit')?.addEventListener('click', () => nuitSheet(avecContenu.filter((x) => x.flashTot)));
  bindInstallBanner();
  if (N.proposer(u)) setTimeout(() => { if (location.hash === '' || location.hash === '#/') inviteNotif(); }, 900);
}
const semestreLabel = (s) => (s || '').replace('-S', ' · Semestre ');

/* ================= Matières ================= */
async function viewMatieres() {
  tabbar('#/matieres'); setHalo(null);
  const u = S.getUser();
  const all = await Promise.all(S.matieres().map(matiereStats));
  const sems = [...new Set(all.map((x) => x.m.semestre || u.semestre))];
  $app.innerHTML = `<div class="between"><h1>Matières</h1><a class="icon-btn" href="#/recherche" aria-label="Rechercher une notion">${ic('search')}</a></div>
  ${S.tousContenus().some((c) => c.glossaire?.length) ? `<a class="card cfg-card" href="#/recherche" style="text-decoration:none"><span><b>Glossaire et auteur·rices</b><span class="small muted" style="display:block">Toutes les notions de toutes tes matières, de A à Z</span></span>${ic('next')}</a>` : ''}` + sems.map((sem) => `
    <div class="between"><h2 class="section-title">${esc(semestreLabel(sem))}</h2>${sem === u.semestre ? '<span class="chip">en cours</span>' : ''}</div>
    <div class="list">${all.filter((x) => (x.m.semestre || u.semestre) === sem).map((x) => `
      <a class="card c-${x.m.couleur}" href="#/matiere/${encodeURIComponent(x.m.code)}" style="display:flex;gap:14px;align-items:center;padding:14px;text-decoration:none">
        <span class="subject" style="min-height:0;width:64px;align-items:center;justify-content:center"><span class="code">${esc(x.m.code)}</span></span>
        <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px">
          <b>${esc(x.m.nom)}</b>
          <span class="small muted">${x.contenu ? `${plural(x.total, 'élément')} · ${x.due + x.neufs} à revoir` : 'Pas encore de contenu'}</span>
          <span class="bar"><span style="width:${x.maitrise}%"></span></span>
        </span>
      </a>`).join('')}</div>`).join('');
}

/* ================= Matière ================= */
const matSel = {}; // sélection de chapitres par matière, gardée aussi dans localStorage
const SEL_KEY = (code) => `stroop-sel-${code}`;
function lireSel(code, chaps) {
  try { const ids = new Set(chaps.map((c) => c.id)); return new Set((JSON.parse(localStorage.getItem(SEL_KEY(code)) || '[]')).filter((x) => ids.has(x))); } catch { return new Set(); }
}
const garderSel = (code, sel) => { try { localStorage.setItem(SEL_KEY(code), JSON.stringify([...sel])); } catch { /* stockage plein ou privé */ } };
const CFG_KEY = (code) => `stroop-cfg-${code}`;
function getCfg(code) {
  let c = null;
  try { c = JSON.parse(localStorage.getItem(CFG_KEY(code)) || 'null'); } catch { c = null; }
  c = c || {};
  return {
    // depuis la 2.8, les flashcards ont leur propre mode : décochées par défaut dans les quiz
    types: Array.isArray(c.types) ? [...c.types.filter((t) => TYPE_KEYS.includes(t) && (c.v >= 3 || t !== 'flashcard')), ...(c.v >= 6 || c.types.includes('redaction') ? [] : ['redaction'])] : TYPE_KEYS.filter((t) => t !== 'flashcard'),
    n: c.n ?? 20,
    niveau: c.niveau ?? 'tous',
    chrono: c.v >= 5 ? !!c.chrono : true,
    reflechir: !!c.reflechir,
    toutOuvrir: !!c.toutOuvrir
  };
}
const saveCfg = (code, cfg) => localStorage.setItem(CFG_KEY(code), JSON.stringify({ ...cfg, v: 6 }));
const matchCfg = (it, cfg) => cfg.types.includes(it.type) && (cfg.niveau === 'tous' || (it.niveau || 1) === Number(cfg.niveau));
function cfgSummary(cfg) {
  const t = cfg.types.length === TYPE_KEYS.length ? 'tous les types' : plural(cfg.types.length, 'type');
  const n = cfg.n === 'tout' ? 'toutes les questions' : `${cfg.n} questions`;
  const niv = cfg.niveau === 'tous' ? 'tous niveaux' : NIVEAUX[cfg.niveau].toLowerCase();
  return `${t} · ${n} · ${niv} · chrono ${cfg.chrono ? 'activé' : 'désactivé'}${cfg.reflechir ? ' · réfléchir d’abord' : ''}${cfg.toutOuvrir ? ' · tout débloqué' : ''}`;
}

const PARTIES = { CM: 'Cours magistraux', TD: 'Travaux dirigés', METHODE: 'Méthode' };

async function viewMatiere(code) {
  tabbar('#/matieres');
  const m = S.getMatiere(code);
  if (!m) return go('#/matieres');
  setHalo(m.couleur);
  const x = await matiereStats(m);
  if (!x.contenu) {
    $app.innerHTML = `${backBtn()}<div class="c-${m.couleur}"><div class="mat-head"><div><div class="code">${esc(m.code)}</div><b>${esc(m.nom)}</b></div></div></div>
      <div class="card empty"><img class="stroop small a-dodo" src="assets/stroop/stroop-dodo.webp" alt=""><p><b>Pas encore de contenu ici.</b></p>${S.isAdmin() ? '<p class="muted small">Envoie tes supports à Claude, puis importe le fichier qu’il te donne depuis l’onglet Profil.</p><a class="btn plain" href="#/profil/bibliotheque">Aller à l’import</a>' : '<p class="muted small">Il arrivera dès qu’il sera ajouté à la bibliothèque commune.</p>'}</div>
      ${examBlock(m)}`;
    bindExam(m);
    return;
  }
  const chaps = x.contenu.chapitres.slice().sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
  const st = matSel[code] || (matSel[code] = { sel: lireSel(code, chaps) });
  const render = () => {
    garderSel(code, st.sel);
    const cfg = getCfg(code);
    const dansSel = (it) => !st.sel.size || st.sel.has(it.chapitre); // rien de coché = toute la matière
    const selItems = filtrerOuvertes(x.items.filter((it) => dansSel(it) && matchCfg(it, cfg)), x.prog, cfg.toutOuvrir, x.items);
    const errItems = x.items.filter((it) => dansSel(it) && x.prog[it.id]?.err && it.type !== 'flashcard');
    const flashItems = x.items.filter((it) => it.type === 'flashcard' && (!st.sel.size || st.sel.has(it.chapitre)));
    const flashDue = flashItems.filter((it) => { const p = x.prog[it.id]; return !p || !p.box || isDue(p); }).length;
    const all = chaps.every((c) => st.sel.has(c.id));
    const ex = nextExam(m);
    const nb = cfg.n === 'tout' ? selItems.length : Math.min(cfg.n, selItems.length);
    $app.innerHTML = `
    <div class="between">${backBtn()}<span class="row" style="gap:8px">${x.contenu.glossaire?.length ? `<a class="icon-btn" href="#/recherche/${encodeURIComponent(code)}" aria-label="Glossaire de ${esc(code)}">${ic('search')}</a>` : ''}<button class="icon-btn" id="gear" aria-label="Réglages de la matière">${ic('gear')}</button></span></div>
    <div class="c-${m.couleur}" style="display:flex;flex-direction:column;gap:16px">
      <div class="mat-head">
        <div style="min-width:0"><div class="code">${esc(m.code)}</div><b>${esc(m.nom)}</b>
          <div class="small muted">Vu : ${x.vus}/${x.total} · ${plural(x.erreurs, 'erreur')} à revoir${ex ? ` · examen J-${daysUntil(ex.t)}` : ''}</div>
          ${x.contenu.importeLe ? `<div class="small muted" style="opacity:.75">Contenu${x.contenu.revision ? ` v${x.contenu.revision}` : ''} mis à jour le ${new Date(x.contenu.importeLe).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} à ${new Date(x.contenu.importeLe).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>` : ''}</div>
        <button class="ring" id="ringinfo" aria-label="Maîtrise ${x.maitrise} %, comment c’est calculé" style="border:none;background:conic-gradient(var(--m-acc) 0 ${x.maitrise}%, var(--ghost) ${x.maitrise}% 100%)"><div><b>${pct(x.maitrise)}</b><small>maîtrise ⓘ</small></div></button>
      </div>
      <div class="between"><h2 class="section-title">Mes boîtes</h2><button class="flag-btn" id="tuto" style="color:var(--m-ink);font-weight:800">Comment ça marche ?</button></div>
      <div class="boxes">${[0, 1, 2, 3, 4, 5].map((b) => {
        const its = x.items.filter((it) => (x.prog[it.id]?.box || 0) === b);
        const due = b === 0 ? 0 : its.filter((it) => isDue(x.prog[it.id])).length;
        return `<button class="boxtile b${b}" data-box="${b}" aria-label="${b ? 'Boîte ' + b : 'Jamais vues'} : ${its.length} cartes${due ? ', ' + due + ' à revoir' : ''}">
          <span class="bl">${b ? 'B' + b : 'Neuves'}</span><b>${its.length}</b><span class="bd">${due ? due + ' à revoir' : b ? 'J+' + INTERVALS[b] : '&nbsp;'}</span></button>`;
      }).join('')}</div>
      <div class="between"><h2 class="section-title">Chapitres à réviser</h2><button class="flag-btn" id="all" style="color:var(--m-ink);font-weight:800">${all ? 'Tout décocher' : 'Tout cocher'}</button></div>
      <div class="list">
        ${chaps.map((c, ci) => {
          const partHead = c.partie && c.partie !== chaps[ci - 1]?.partie ? `<div class="partie-head"><span>${esc(PARTIES[c.partie] || c.partie)}</span><button class="flag-btn" data-partie="${esc(c.partie)}" style="color:var(--m-ink);font-weight:800">${chaps.filter((k) => k.partie === c.partie).every((k) => st.sel.has(k.id)) ? 'Tout décocher' : 'Tout cocher'}</button></div>` : '';
          const ids = c.elements.map((e) => e.id); const mm = mastery(c.elements, x.prog); const vus = seenCount(ids, x.prog);
          const nv = niveauxChapitre(c.elements, x.prog), p100 = (v) => Math.round(v * 100);
          const etape = !c.elements.some((e) => e.prio) ? '' : cfg.toutOuvrir ? 'Tout débloqué' : nv.max === 1 && nv.aAppro ? `Socle acquis à ${p100(nv.socle)} % · la suite à 75 %` : nv.max === 2 && nv.aDetail ? `Approfondissements acquis à ${p100(nv.appro)} % · les détails à 75 %` : nv.max === 1 ? `Socle acquis à ${p100(nv.socle)} %` : 'Tout débloqué';
          return `${partHead}<div class="chaprow">
            <button class="chap" data-chap="${esc(c.id)}" aria-pressed="${st.sel.has(c.id)}">
              <span class="box" aria-hidden="true"><svg class="ic" viewBox="0 0 24 24">${IC.check}</svg></span>
              <span class="info"><span class="between"><span class="name">${esc(c.titre)}</span><span class="small muted">${pct(mm)}</span></span>
              <span class="bar duo"><span class="seen" style="width:${Math.round((vus / ids.length) * 100)}%"></span><span style="width:${mm}%"></span></span>${etape ? `<span class="small muted etape">${esc(etape)}</span>` : ''}</span>
            </button>
            ${c.fiche?.length ? `<button class="icon-btn fiche-btn" data-fiche="${esc(c.id)}" aria-label="Fiche de cours : ${esc(c.titre)}">${ic('book')}</button>` : ''}
          </div>`;
        }).join('')}
      </div>
      <button class="card cfg-card" id="cfg"><span><b>Réglages de session</b><span class="small muted" style="display:block">${esc(cfgSummary(cfg))}</span></span><span class="flag-btn" style="color:var(--m-ink);font-weight:800">Modifier</span></button>
      <button class="cta cta-m lance" id="go" ${selItems.length ? '' : 'disabled'}><span><span class="t">Lancer la session</span><span class="s">${selItems.length ? `${st.sel.size ? plural(st.sel.size, 'chapitre') : 'Toute la matière'} · ${plural(nb, 'question')}` : 'Aucune question avec ces réglages'}</span></span><span class="go">${ic('arrow')}</span></button>
      <div class="actions">
        <div class="two">
          <button class="btn soft" id="rafale" ${selItems.length ? '' : 'disabled'}>${ic('bolt')}Rafale 2 min</button>
          <button class="btn soft" id="flash" style="white-space:nowrap" ${flashItems.length ? '' : 'disabled'}>${ic('cards')}Flashcards${flashItems.length ? ` <span class="nb">${flashDue || flashItems.length}</span>` : ''}</button>
        </div>
        <button class="btn plain block" id="err" ${errItems.length ? '' : 'disabled'}>${ic('redo')}Mes erreurs · ${errItems.length}</button>
        <button class="btn plain block" id="ecoute">${ic('casque')}Écouter ${st.sel.size ? (st.sel.size > 1 ? 'ces chapitres' : 'ce chapitre') : 'la matière'}</button>
      </div>
    </div>`;
    $app.querySelectorAll('[data-chap]').forEach((b) => b.onclick = () => { const id = b.dataset.chap; st.sel.has(id) ? st.sel.delete(id) : st.sel.add(id); render(); $app.querySelector(`[data-chap="${CSS.escape(id)}"]`)?.focus({ preventScroll: true }); });
    $app.querySelectorAll('[data-fiche]').forEach((b) => b.onclick = () => ficheSheet(m, chaps.find((c) => c.id === b.dataset.fiche)));
    $app.querySelectorAll('[data-partie]').forEach((b) => b.onclick = () => { const p = b.dataset.partie; const cs = chaps.filter((c) => c.partie === p); const on = cs.every((c) => st.sel.has(c.id)); cs.forEach((c) => on ? st.sel.delete(c.id) : st.sel.add(c.id)); render(); });
    document.getElementById('all').onclick = () => { if (all) st.sel.clear(); else chaps.forEach((c) => st.sel.add(c.id)); render(); };
    document.getElementById('ringinfo').onclick = () => masteryInfo(m, x);
    document.getElementById('tuto').onclick = () => leitnerTuto(m);
    $app.querySelectorAll('[data-box]').forEach((b) => b.onclick = () => boxSheet(m, x, Number(b.dataset.box)));
    document.getElementById('cfg').onclick = () => cfgSheet(m, x, st, render);
    const opts = { code, chapitres: [...st.sel] };
    document.getElementById('go').onclick = () => startSession({ ...opts, kind: 'normal' });
    document.getElementById('rafale').onclick = () => startSession({ ...opts, kind: 'rafale' });
    document.getElementById('err').onclick = () => startSession({ ...opts, kind: 'erreurs' });
    document.getElementById('flash').onclick = () => startSession({ ...opts, chapitres: st.sel.size ? opts.chapitres : null, kind: 'flash' });
    document.getElementById('gear').onclick = () => matiereSheet(m, render);
    document.getElementById('ecoute').onclick = () => ecouteSheet(m, x, chaps.filter((c) => !st.sel.size || st.sel.has(c.id)));
  };
  render();
  if (!localStorage.getItem('stroop-tuto-leitner')) { localStorage.setItem('stroop-tuto-leitner', '1'); leitnerTuto(m); }
}

/* ================= Mode écoute ================= */
let ecouteEtat = null;
const ECFG = 'stroop-ecoute-cfg';
async function ecouteSheet(m, x, chaps) {
  const E = await import('./ecoute.js'), V = await import('./voix.js');
  const cfg = { contenu: 'tout', n: 10, voix: 'pierre', silence: 8, vitesse: 1, ...JSON.parse(localStorage.getItem(ECFG) || '{}') };
  const derniere = await E.retrouver(m.code);
  const voix = V.VOIX.filter((v) => v.id === 'pierre' || v.id === 'jessica');
  const seg = (k, opts) => `<div class="seg" data-k="${k}">${opts.map(([v, l]) => `<button data-v="${v}" aria-pressed="${String(cfg[k]) === String(v)}">${l}</button>`).join('')}</div>`;
  const nbQ = () => x.items.filter((it) => chaps.some((c) => c.id === it.chapitre) && E.audible(it)).length;
  const sh = openSheet(`
    <div class="between"><h2>Écouter</h2><button class="icon-btn" data-close aria-label="Fermer">${ic('close')}</button></div>
    <p class="small muted" style="margin:0">${chaps.length === x.contenu.chapitres.length ? 'Toute la matière' : chaps.map((c) => esc(shortChap(c.titre))).join(' · ')}. La voix est calculée sur ton téléphone : ton cours ne quitte jamais l’appli. Spotify se met en pause pendant l’écoute.</p>
    ${derniere ? `<button class="card cfg-card" id="reprendre"><span><b>Reprendre ma dernière écoute</b><span class="small muted" style="display:block">${esc(derniere.titre || '')} · ${fmtMin(derniere.duree / 60)}${derniere.pos > 10 ? ` · reprise à ${Math.floor(derniere.pos / 60)} min ${String(Math.floor(derniere.pos % 60)).padStart(2, '0')}` : ''}</span></span>${ic('play')}</button>` : ''}
    <div class="field">Contenu${seg('contenu', [['fiches', 'Fiches'], ['questions', 'Questions'], ['tout', 'Les deux']])}</div>
    <div class="field" id="fN">Nombre de questions${seg('n', [[10, '10'], [20, '20'], [0, `Toutes (${nbQ()})`]])}</div>
    <div class="field" id="fS">Silence pour répondre${seg('silence', [[5, '5 s'], [8, '8 s'], [12, '12 s']])}</div>
    <div class="field">Voix${seg('voix', voix.map((v) => [v.id, v.nom]))}</div>
    <div class="field">Vitesse${seg('vitesse', [[1, 'Normale'], [0.85, 'Plus lente']])}</div>
    <span class="small muted" id="ecest"></span>
    <button class="btn primary block" id="ecgo">${ic('casque')}Préparer l’écoute</button>`, `c-${m.couleur}`);
  const choisir = () => {
    let qs = x.items.filter((it) => chaps.some((c) => c.id === it.chapitre) && E.audible(it));
    qs = shuffle(qs); if (cfg.n) qs = qs.slice(0, cfg.n);
    const ordre = new Map(x.items.map((it, i) => [it.id, i])); qs.sort((a, b) => ordre.get(a.id) - ordre.get(b.id));
    return E.programme({ chapitres: chaps, items: qs, contenu: cfg.contenu, silence: cfg.silence });
  };
  const estimer = () => {
    const P = choisir();
    const sec = P.reduce((a, p) => a + (p.type === 'parole' ? p.texte.length / (13.5 * cfg.vitesse) : p.type === 'silence' ? p.secondes : 0.2), 0);
    const min = Math.max(1, Math.round(sec / 60)), prep = Math.max(1, Math.round(sec / 60 / 4));
    sh.back.querySelector('#ecest').innerHTML = `Environ <b>${fmtMin(min)}</b> d’écoute, préparée en ${prep > 1 ? 'environ ' + prep + ' min' : 'moins d’une minute'} sur ton téléphone. Garde l’écran allumé pendant la préparation ; ensuite tu peux le verrouiller.${min > 45 ? ' C’est long : choisis moins de chapitres si ton téléphone peine.' : ''}`;
  };
  const maj = () => {
    estimer();
    sh.back.querySelectorAll('[data-k]').forEach((g) => g.querySelectorAll('[data-v]').forEach((b) => b.setAttribute('aria-pressed', String(String(cfg[g.dataset.k]) === b.dataset.v))));
    sh.back.querySelector('#fN').style.display = sh.back.querySelector('#fS').style.display = cfg.contenu === 'fiches' ? 'none' : '';
  };
  sh.back.querySelectorAll('[data-k] [data-v]').forEach((b) => b.onclick = () => { const k = b.closest('[data-k]').dataset.k, v = b.dataset.v; cfg[k] = k === 'contenu' || k === 'voix' ? v : Number(v); localStorage.setItem(ECFG, JSON.stringify(cfg)); maj(); });
  maj();
  sh.back.querySelector('#reprendre')?.addEventListener('click', () => { sh.close(); ecouteEtat = { m, ep: derniere, pos: derniere.pos || 0 }; go('#/ecoute'); });
  sh.back.querySelector('#ecgo').onclick = () => {
    const P = choisir();
    const titre = `${m.code} · ${chaps.length === 1 ? shortChap(chaps[0].titre) : plural(chaps.length, 'chapitre')} · ${{ fiches: 'fiches', questions: 'questions', tout: 'fiches et questions' }[cfg.contenu]}`;
    sh.close(); ecouteEtat = { m, P, voix: V.VOIX.find((v) => v.id === cfg.voix), vitesse: cfg.vitesse, titre }; go('#/ecoute');
  };
}

async function viewEcoute() {
  const etat = ecouteEtat;
  if (!etat) return go('#/matieres');
  const { m } = etat; const E = await import('./ecoute.js');
  tabbar(null); setHalo(m.couleur);
  if (!etat.ep) {
    let stop = false, verrou = null;
    $app.innerHTML = `<div class="c-${m.couleur} ec-prep"><div class="between"><span class="chip m c-${m.couleur}">${esc(m.code)}</span><button class="icon-btn" id="ecx" aria-label="Annuler">${ic('close')}</button></div>
      ${stroopImg('etude')}<h2 style="text-align:center;margin:0">Je prépare ton écoute…</h2><p class="small muted" style="text-align:center;margin:0">${esc(etat.titre)}</p>
      <div class="bar ec-bar"><span id="ecpb" style="width:0%"></span></div><p class="small" id="ecpt" style="text-align:center;font-weight:700;margin:0">0 %</p>
      <p class="small muted" style="text-align:center;margin:0">Garde l’écran allumé pendant la préparation.</p></div>`;
    document.getElementById('ecx').onclick = () => { stop = true; ecouteEtat = null; go(`#/matiere/${encodeURIComponent(m.code)}`); };
    window.addEventListener('hashchange', function f() { window.removeEventListener('hashchange', f); if (!location.hash.startsWith('#/ecoute')) stop = true; });
    try { verrou = await navigator.wakeLock?.request('screen'); } catch {}
    try {
      const t0 = Date.now();
      const ep = await E.construire(etat.P, etat.voix, { vitesse: etat.vitesse, annule: () => stop || ecouteEtat !== etat, progression: (p, txt) => {
        const b = document.getElementById('ecpb'), t = document.getElementById('ecpt'); if (!b) return;
        b.style.width = `${Math.round(p * 100)}%`;
        const reste = p > 0.05 ? Math.round(((Date.now() - t0) / p) * (1 - p) / 1000) : null;
        t.textContent = txt || `${Math.round(p * 100)} %${reste != null ? ` · encore ${reste < 60 ? reste + ' s' : Math.round(reste / 60) + ' min'}` : ''}`;
      } });
      ep.titre = etat.titre; etat.ep = ep; etat.pos = 0;
      E.garder(m.code, ep);
    } catch (e) {
      if (stop || ecouteEtat !== etat) return;
      $app.innerHTML = `<div class="card empty"><p><b>La préparation a échoué.</b></p><p class="small muted">${/fetch|téléchargement/i.test(e.message) ? 'Impossible de télécharger la voix : vérifie ta connexion (le Wi-Fi est préférable la première fois).' : esc(e.message)}</p><a class="btn plain" href="#/matiere/${encodeURIComponent(m.code)}">Revenir</a></div>`;
      return;
    } finally { try { await verrou?.release(); } catch {} }
    if (ecouteEtat !== etat || !location.hash.startsWith('#/ecoute')) return;
  }
  lecteurEcoute(etat, E);
}

function lecteurEcoute(etat, E) {
  const { m, ep } = etat; const marques = ep.marques;
  const url = URL.createObjectURL(ep.blob);
  const audio = new Audio(url); audio.preload = 'auto';
  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  $app.innerHTML = `<div class="c-${m.couleur} ec-lect">
    <div class="between"><span class="chip m c-${m.couleur}">${ic('casque')} ${esc(m.code)}</span><button class="icon-btn" id="ecx" aria-label="Fermer l’écoute">${ic('close')}</button></div>
    <p class="small muted" style="margin:0">${esc(ep.titre || '')}</p>
    <div class="card ec-now"><span class="ec-sous" id="ecsous"></span><div class="ec-txt" id="ectxt"></div></div>
    <input type="range" id="ecpos" min="0" max="${Math.round(ep.duree)}" step="1" value="0" aria-label="Position dans l’écoute">
    <div class="between small muted"><span id="ecnow">0:00</span><span>${mmss(ep.duree)}</span></div>
    <div class="ec-ctrl">
      <button class="icon-btn" id="ecprev" aria-label="Précédent">${ic('prev')}</button>
      <button class="icon-btn ec-10" id="ecm10" aria-label="Reculer de 10 secondes">−10</button>
      <button class="ec-play" id="ecplay" aria-label="Lecture">${ic('play')}</button>
      <button class="icon-btn ec-10" id="ecp10" aria-label="Avancer de 10 secondes">+10</button>
      <button class="icon-btn" id="ecnext" aria-label="Suivant">${ic('suiv')}</button>
    </div>
    <p class="small muted" style="text-align:center;margin:0">Tu peux verrouiller ton téléphone : la lecture continue, avec les commandes sur l’écran verrouillé.</p></div>`;
  const $ = (id) => document.getElementById(id);
  let cour = -1, dernierSave = 0;
  const idx = (t) => { let i = 0; for (let k = 0; k < marques.length; k++) if (marques[k].t <= t + 0.05) i = k; return i; };
  const montrer = (i) => {
    if (i === cour) return; cour = i; const mk = marques[i] || {};
    $('ecsous').textContent = mk.sous || ''; $('ectxt').innerHTML = esc(mk.texte || '').replace(/\n/g, '<br>');
    $('ectxt').classList.toggle('rep', !!mk.reponse);
    if ('mediaSession' in navigator) navigator.mediaSession.metadata = new MediaMetadata({ title: mk.sous || ep.titre, artist: `Stroop Study · ${m.code}`, album: mk.titre || '', artwork: [{ src: 'assets/icons/icon-512.png', sizes: '512x512', type: 'image/png' }] });
  };
  let vivant = true;
  const etatPlay = () => { if (!vivant) return; $('ecplay').innerHTML = ic(audio.paused ? 'play' : 'pause'); $('ecplay').setAttribute('aria-label', audio.paused ? 'Lecture' : 'Pause'); };
  const aller = (t) => { audio.currentTime = Math.max(0, Math.min(ep.duree - 0.1, t)); maj(); };
  const maj = () => {
    if (!vivant) return;
    const t = audio.currentTime; montrer(idx(t)); $('ecpos').value = Math.round(t); $('ecnow').textContent = mmss(t);
    if (Math.abs(t - dernierSave) > 5) { dernierSave = t; E.memoriserPosition(m.code, t); }
    try { navigator.mediaSession?.setPositionState?.({ duration: ep.duree, position: Math.min(t, ep.duree), playbackRate: 1 }); } catch {}
  };
  const prec = () => { const i = idx(audio.currentTime); aller(audio.currentTime - marques[i].t > 3 || i === 0 ? marques[i].t : marques[i - 1].t); };
  const suiv = () => { const i = idx(audio.currentTime); if (marques[i + 1]) aller(marques[i + 1].t); };
  const jouer = () => { try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {} audio.play().catch(() => {}); };
  audio.addEventListener('timeupdate', maj); audio.addEventListener('play', etatPlay); audio.addEventListener('pause', etatPlay);
  audio.addEventListener('ended', () => { E.memoriserPosition(m.code, 0); etatPlay(); });
  audio.addEventListener('loadedmetadata', () => { if (etat.pos) aller(etat.pos); });
  $('ecplay').onclick = () => (audio.paused ? jouer() : audio.pause());
  $('ecprev').onclick = prec; $('ecnext').onclick = suiv;
  $('ecm10').onclick = () => aller(audio.currentTime - 10); $('ecp10').onclick = () => aller(audio.currentTime + 10);
  $('ecpos').oninput = (e) => aller(Number(e.target.value));
  if ('mediaSession' in navigator) {
    const h = { play: jouer, pause: () => audio.pause(), previoustrack: prec, nexttrack: suiv, seekbackward: () => aller(audio.currentTime - 10), seekforward: () => aller(audio.currentTime + 10), seekto: (d) => aller(d.seekTime) };
    for (const [k, f] of Object.entries(h)) { try { navigator.mediaSession.setActionHandler(k, f); } catch {} }
  }
  const fermer = () => {
    vivant = false;
    E.memoriserPosition(m.code, audio.ended ? 0 : audio.currentTime);
    audio.pause(); audio.src = ''; URL.revokeObjectURL(url);
    if ('mediaSession' in navigator) { for (const k of ['play', 'pause', 'previoustrack', 'nexttrack', 'seekbackward', 'seekforward', 'seekto']) { try { navigator.mediaSession.setActionHandler(k, null); } catch {} } navigator.mediaSession.metadata = null; }
    sessionAudio(); ecouteEtat = null;
  };
  window.addEventListener('hashchange', function f() { window.removeEventListener('hashchange', f); fermer(); });
  $('ecx').onclick = () => go(`#/matiere/${encodeURIComponent(m.code)}`);
  montrer(idx(etat.pos || 0)); etatPlay(); jouer();
}

const v1 = (v) => (Array.isArray(v) ? v[0] : v);
const itemLabel = (it) => v1(it.recto) || v1(it.question) || v1(it.affirmation) || v1(it.scenario) || '';

function boxSheet(m, x, b) {
  const its = x.items.filter((it) => (x.prog[it.id]?.box || 0) === b)
    .map((it) => ({ it, due: b ? dueDate(x.prog[it.id]) : 0 }))
    .sort((a, c) => a.due - c.due);
  const sh = openSheet(`
    <div class="between"><h2>${b ? `Boîte ${b}` : 'Cartes jamais vues'} · ${its.length}</h2><button class="icon-btn" data-close aria-label="Fermer">${ic('close')}</button></div>
    <p class="small muted" style="margin:0">${b ? `Une carte de la boîte ${b} revient ${INTERVALS[b] === 1 ? 'le lendemain' : INTERVALS[b] + ' jours'} après sa dernière montée.` : 'Ces cartes n’ont encore jamais été vues.'}</p>
    ${its.length ? `<button class="btn primary block" id="revbox">Réviser ces ${plural(its.length, 'carte')}</button>` : ''}
    <div class="list">${its.slice(0, 200).map(({ it, due }) => `<div class="card boxitem"><span class="small muted">${esc(shortChap(it.chapitreTitre))} · ${esc(typeLabel(it.type))}</span><span class="bt">${esc(itemLabel(it))}</span>${b ? `<span class="small ${isDue(x.prog[it.id]) ? 'due' : 'muted'}">${isDue(x.prog[it.id]) ? 'À revoir maintenant' : 'Prochaine révision ' + fmtDue(due)}</span>` : ''}</div>`).join('') || '<p class="muted small">Aucune carte ici pour l’instant.</p>'}</div>`, `c-${m.couleur}`);
  sh.back.querySelector('#revbox')?.addEventListener('click', () => { sh.close(); startSession({ code: m.code, kind: 'normal', ids: its.map((o) => o.it.id) }); });
}

function leitnerTuto(m) {
  openSheet(`
    <div class="between"><h2>La boîte de Leitner</h2><button class="icon-btn" data-close aria-label="Fermer">${ic('close')}</button></div>
    <p style="margin:0">Chaque carte vit dans l’une de 5 boîtes. Plus elle est haut, plus tu la revois rarement : c’est la <b>répétition espacée</b>.</p>
    <div class="tuto-boxes">${[1, 2, 3, 4, 5].map((b) => `<div class="tb b${b}"><b>B${b}</b><span>J+${INTERVALS[b]}</span></div>`).join('<span class="tarrow">›</span>')}</div>
    <ul class="tuto-list">
      <li><span class="tdot ok">↑</span><span><b>Bonne réponse, le jour prévu :</b> la carte monte d’une boîte et revient plus tard (le lendemain, puis 2, 4, 7 et 16 jours après).</span></li>
      <li><span class="tdot ko">↺</span><span><b>Erreur :</b> retour en boîte 1, à revoir dès le lendemain. Oublier fait partie de l’apprentissage.</span></li>
      <li><span class="tdot">≈</span><span><b>Révision en avance</b> (session libre, rafale) : c’est de l’entraînement. Ta journée compte, mais la carte ne monte pas, pour ne pas fausser l’espacement.</span></li>
      <li><span class="tdot">2×</span><span><b>Carte nouvelle :</b> elle peut monter deux fois le même jour si tu la réussis à nouveau au moins 5 h plus tard.</span></li>
      <li><span class="tdot">?</span><span><b>« C’était au pif » :</b> la carte reste dans sa boîte.</span></li>
    </ul>
    <p class="small muted" style="margin:0">La <b>session du jour</b> te propose uniquement les cartes à revoir aujourd’hui et des nouvelles. Retrouve ce tuto avec « Comment ça marche ? » sur la page d’une matière.</p>
    <button class="btn primary block" data-close>C’est parti</button>`, m ? `c-${m.couleur}` : 'c-orange');
}

// Bloque le défilement de la page derrière une fenêtre ouverte (y compris sur iPhone).
let lockedY = null;
function lockScroll() {
  if (lockedY !== null) return;
  lockedY = window.scrollY;
  Object.assign(document.body.style, { position: 'fixed', top: `-${lockedY}px`, left: '0', right: '0', width: '100%' });
}
function unlockScroll() {
  if (lockedY === null || document.querySelector('.sheet-back, .pause-ov')) return;
  Object.assign(document.body.style, { position: '', top: '', left: '', right: '', width: '' });
  window.scrollTo(0, lockedY); lockedY = null;
}
function openSheet(html, cls = '') {
  const back = document.createElement('div');
  back.className = 'sheet-back';
  back.innerHTML = `<div class="sheet ${cls}" role="dialog" aria-modal="true">${html}</div>`;
  lockScroll(); son('sheet');
  // Clavier iOS : il ne réduit pas la page, il la recouvre. On cale la fenêtre sur la zone
  // réellement visible (visualViewport) pour que le champ de saisie reste au-dessus du clavier.
  const vv = window.visualViewport;
  const fit = () => {
    if (!vv) return;
    back.style.top = vv.offsetTop + 'px'; back.style.height = vv.height + 'px'; back.style.bottom = 'auto';
    const f = document.activeElement;
    if (f && back.contains(f) && /^(TEXTAREA|INPUT)$/.test(f.tagName)) f.scrollIntoView({ block: 'center' });
  };
  if (vv) { vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit); }
  back.addEventListener('focusin', () => setTimeout(fit, 300));
  const close = () => { back.remove(); unlockScroll(); if (vv) { vv.removeEventListener('resize', fit); vv.removeEventListener('scroll', fit); } };
  back.onclick = (e) => { if (e.target === back) close(); };
  document.body.appendChild(back);
  back.querySelectorAll('[data-close]').forEach((b) => b.onclick = close);
  return { back, close };
}

function cfgSheet(m, x, st, onDone) {
  const cfg = getCfg(m.code);
  const pool = x.items.filter((it) => st.sel.size === 0 || st.sel.has(it.chapitre));
  const draw = () => {
    const counts = Object.fromEntries(TYPE_KEYS.map((k) => [k, pool.filter((it) => it.type === k && (cfg.niveau === 'tous' || (it.niveau || 1) === Number(cfg.niveau))).length]));
    const total = filtrerOuvertes(pool.filter((it) => matchCfg(it, cfg)), x.prog, cfg.toutOuvrir, x.items).length;
    sh.back.querySelector('.sheet').innerHTML = `
      <div class="between"><h2>Réglages de session</h2><button class="icon-btn" data-close aria-label="Fermer">${ic('close')}</button></div>
      <div class="field">Types de questions
        <div class="pills">${TYPES.map((t) => `<button class="pill" data-type="${t.key}" aria-pressed="${cfg.types.includes(t.key)}">${esc(t.label)} <span class="muted">${counts[t.key]}</span></button>`).join('')}</div>
        <div class="row"><button class="flag-btn" id="tall">Tout cocher</button><button class="flag-btn" id="tnone">Tout décocher</button></div>
      </div>
      <div class="field">Nombre de questions
        <div class="seg">${[10, 20, 30, 'tout'].map((n) => `<button data-n="${n}" aria-pressed="${String(cfg.n) === String(n)}">${n === 'tout' ? 'Tout' : n}</button>`).join('')}</div>
      </div>
      <div class="field">Difficulté
        <div class="seg">${[['tous', 'Tous'], ['1', 'Facile'], ['2', 'Moyen'], ['3', 'Difficile']].map(([k, l]) => `<button data-niv="${k}" aria-pressed="${String(cfg.niveau) === k}">${l}</button>`).join('')}</div>
      </div>
      <label class="switch"><input type="checkbox" id="chrono" ${cfg.chrono ? 'checked' : ''}><span><b>Chrono</b><span class="small muted" style="display:block">Temps adapté à la difficulté et à la longueur de chaque question (de 20 s à 3 min). Hors flashcards.</span></span></label>
      <label class="switch"><input type="checkbox" id="tout" ${cfg.toutOuvrir ? 'checked' : ''}><span><b>Tout débloquer</b><span class="small muted" style="display:block">Par défaut, chaque chapitre propose d’abord son socle. Les approfondissements s’ajoutent quand 75 % du socle est acquis, puis les détails. Utile avant les partiels.</span></span></label>
      <label class="switch"><input type="checkbox" id="refl" ${cfg.reflechir ? 'checked' : ''}><span><b>Réfléchir avant de voir les propositions</b><span class="small muted" style="display:block">La question s’affiche seule : tu formules ta réponse, puis tu découvres les choix (QCU, QCM).</span></span></label>
      <p class="small muted" style="margin:0">${st.sel.size ? `Dans les chapitres cochés : ${plural(total, 'question disponible', 'questions disponibles')}.` : `Dans toute la matière : ${plural(total, 'question disponible', 'questions disponibles')}. Coche des chapitres pour affiner.`}</p>
      <button class="btn primary block" data-close>Enregistrer</button>`;
    const q = (s) => sh.back.querySelectorAll(s);
    q('[data-type]').forEach((b) => b.onclick = () => {
      const k = b.dataset.type;
      cfg.types = cfg.types.includes(k) ? cfg.types.filter((t) => t !== k) : [...cfg.types, k];
      saveCfg(m.code, cfg); draw();
    });
    sh.back.querySelector('#tall').onclick = () => { cfg.types = TYPE_KEYS.slice(); saveCfg(m.code, cfg); draw(); };
    sh.back.querySelector('#tnone').onclick = () => { cfg.types = []; saveCfg(m.code, cfg); draw(); };
    q('[data-n]').forEach((b) => b.onclick = () => { cfg.n = b.dataset.n === 'tout' ? 'tout' : Number(b.dataset.n); saveCfg(m.code, cfg); draw(); });
    q('[data-niv]').forEach((b) => b.onclick = () => { cfg.niveau = b.dataset.niv === 'tous' ? 'tous' : Number(b.dataset.niv); saveCfg(m.code, cfg); draw(); });
    sh.back.querySelector('#chrono').onchange = (e) => { cfg.chrono = e.target.checked; saveCfg(m.code, cfg); };
    sh.back.querySelector('#refl').onchange = (e) => { cfg.reflechir = e.target.checked; saveCfg(m.code, cfg); };
    sh.back.querySelector('#tout').onchange = (e) => { cfg.toutOuvrir = e.target.checked; saveCfg(m.code, cfg); draw(); };
    q('[data-close]').forEach((b) => b.onclick = () => { sh.close(); onDone(); });
  };
  const sh = openSheet('', `c-${m.couleur}`);
  sh.back.onclick = (e) => { if (e.target === sh.back) { sh.close(); onDone(); } };
  draw();
}

function ficheSheet(m, chap, sectionId) {
  if (!chap || !chap.fiche) return;
  const sh = openSheet(`
    <div class="between"><h2 style="font-size:20px">${esc(chap.titre)}</h2><button class="icon-btn" data-close aria-label="Fermer">${ic('close')}</button></div>
    ${chap.fiche.map((s) => `<section class="fiche-sec ${s.id === sectionId ? 'hl' : ''}" id="fs-${esc(s.id)}">
      <h3>${esc(s.titre)}</h3><ul>${s.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>${figureHtml(s.figure)}</section>`).join('')}`, `c-${m.couleur}`);
  if (sectionId) setTimeout(() => sh.back.querySelector(`#fs-${CSS.escape(sectionId)}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 60);
}

function masteryInfo(m, x) {
  const { notions } = notionStats(x.items, x.prog);
  const count = (st) => notions.filter((n) => n.statut === st).length;
  const LAB = { maitrisee: 'Maîtrisée', encours: 'En cours', revoir: 'À revoir', nouvelle: 'Pas encore vue' };
  const chaps = x.contenu.chapitres.slice().sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
  const list = chaps.map((c) => {
    const ns = notions.filter((n) => n.chapitre === c.id);
    if (!ns.length) return '';
    const done = ns.filter((n) => n.statut === 'maitrisee').length;
    return `<details class="notions"><summary><span>${esc(c.titre)}</span><span class="small muted">${done}/${ns.length}</span></summary>
      <ul>${ns.map((n) => `<li><span class="ndot ${n.statut}" aria-hidden="true"></span><span class="nnom">${esc(n.nom)}</span><span class="small muted">${LAB[n.statut]}</span></li>`).join('')}</ul></details>`;
  }).join('');
  openSheet(`
    <div class="between"><h2>La maîtrise, comment ça marche ?</h2><button class="icon-btn" data-close aria-label="Fermer">${ic('close')}</button></div>
    <p style="margin:0">Chaque question se rattache à une <b>notion</b>. La maîtrise de la matière, c’est la part des notions que tu sais, pas des questions : une notion bien comprise compte pleinement, même si toutes ses questions ne sont pas encore passées.</p>
    <ul style="margin:0;padding-left:20px;line-height:1.7">
      <li>Une notion grimpe avec la boîte de Leitner de ses questions (boîte 1 : 25 %, boîte 2 : 50 %, boîte 3 : 75 %, boîtes 4-5 : 100 %).</li>
      <li>Elle est <b>maîtrisée</b> quand tu as réussi au moins 2 questions différentes dessus, ou la même à quelques jours d’écart. Avant ça, elle plafonne à 50 %.</li>
      <li>Une erreur la fait redescendre jusqu’à ce que tu la réussisses à nouveau.</li>
    </ul>
    <h3 class="section-title" style="margin-top:4px">Mes notions</h3>
    <div class="nlegend small"><span><span class="ndot maitrisee"></span>${count('maitrisee')} maîtrisée${count('maitrisee') > 1 ? 's' : ''}</span><span><span class="ndot encours"></span>${count('encours')} en cours</span><span><span class="ndot revoir"></span>${count('revoir')} à revoir</span><span><span class="ndot nouvelle"></span>${count('nouvelle')} pas vue${count('nouvelle') > 1 ? 's' : ''}</span></div>
    <div class="list" style="gap:8px">${list}</div>
    <button class="btn primary block" data-close>Compris</button>`, `c-${m.couleur}`);
}
const backBtn = () => `<a class="icon-btn" href="#/matieres" aria-label="Retour">${ic('back')}</a>`;

function examBlock(m) {
  return `<div class="card" style="padding:16px;display:flex;flex-direction:column;gap:10px">
    <h2 class="section-title">Examens</h2>
    ${(m.examens || []).map((e, i) => `<div class="between"><span><b>${esc(new Date(e.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }))}</b> ${e.label ? '· ' + esc(e.label) : ''}</span><button class="flag-btn" data-delex="${i}">Supprimer</button></div>`).join('') || '<p class="muted small" style="margin:0">Aucune date pour l’instant.</p>'}
    <form id="exf" class="list"><label class="field">Date<input type="date" name="d" required></label><label class="field">Intitulé (facultatif)<input name="l" placeholder="ex. QCM final, oral…"></label><button class="btn plain" type="submit">Ajouter la date</button></form>
  </div>`;
}
function bindExam(m, after) {
  const f = document.getElementById('exf');
  if (f) f.onsubmit = async (e) => {
    e.preventDefault(); if (!f.d.value) return;
    await S.saveMatiere(m.code, { examens: [...(m.examens || []), { date: f.d.value, label: f.l.value.trim() }] });
    Object.assign(m, S.getMatiere(m.code)); toast('Date ajoutée'); after ? after() : route();
  };
  document.querySelectorAll('[data-delex]').forEach((b) => b.onclick = async () => {
    const ex = (m.examens || []).filter((_, i) => i !== Number(b.dataset.delex));
    await S.saveMatiere(m.code, { examens: ex }); Object.assign(m, S.getMatiere(m.code)); after ? after() : route();
  });
}

function matiereSheet(m, onClose) {
  const back = document.createElement('div');
  back.className = 'sheet-back';
  const draw = () => {
    const mm = S.getMatiere(m.code);
    back.innerHTML = `<div class="sheet c-${mm.couleur}" role="dialog" aria-modal="true" aria-label="Réglages ${esc(mm.code)}">
      <div class="between"><h2>Réglages · ${esc(mm.code)}</h2><button class="icon-btn" data-close aria-label="Fermer">${ic('close')}</button></div>
      <label class="field">Nom<input id="nom" value="${esc(mm.nom)}"></label>
      <div class="field">Couleur<div class="row" style="flex-wrap:wrap">${S.COULEURS.map((c) => `<button class="chip m c-${c}" data-col="${c}" aria-pressed="${mm.couleur === c}" style="${mm.couleur === c ? 'outline:3px solid var(--m-acc)' : ''}">${c}</button>`).join('')}</div></div>
      <label class="row" style="font-weight:700"><input type="checkbox" id="neg" ${mm.negatif ? 'checked' : ''} style="width:22px;height:22px"> QCM à points négatifs (une mauvaise réponse retire un point)</label>
      ${examBlock(mm)}
    </div>`;
    back.querySelector('[data-close]').onclick = close;
    back.querySelector('#nom').onchange = async (e) => { await S.saveMatiere(m.code, { nom: e.target.value.trim() || mm.code }); };
    back.querySelectorAll('[data-col]').forEach((b) => b.onclick = async () => { await S.saveMatiere(m.code, { couleur: b.dataset.col }); Object.assign(m, S.getMatiere(m.code)); setHalo(m.couleur); draw(); });
    back.querySelector('#neg').onchange = async (e) => { await S.saveMatiere(m.code, { negatif: e.target.checked }); };
    bindExam(mm, () => { Object.assign(m, S.getMatiere(m.code)); draw(); });
  };
  const close = () => { back.remove(); unlockScroll(); route(); };
  back.onclick = (e) => { if (e.target === back) close(); };
  lockScroll(); document.body.appendChild(back); draw();
}

/* ================= Réviser une notion ================= */
// Rappel (flashcards) → compréhension (vrai/faux, QCU, associations…) → application (cas pratiques),
// puis les mêmes idées dans d'autres situations, pour manipuler la notion plutôt que l'apprendre par cœur.
const ETAPE = (it) => (it.type === 'flashcard' ? 0 : it.type === 'cas' ? 2 : 1);
function planNotion(items) {
  const base = shuffle(items).sort((a, b) => ETAPE(a) - ETAPE(b)).slice(0, 14);
  const out = base.map((it) => ({ it, v: 0 }));
  const autres = base.filter((it) => it.type !== 'flashcard' && nbVariantes(it) > 1);
  for (let k = 1; k <= 2; k++) for (const it of shuffle(autres)) if (k < nbVariantes(it) && out.length < 20) out.push({ it, v: k });
  // une variante ne suit jamais immédiatement la même question
  for (let i = 1; i < out.length; i++) if (out[i].it.id === out[i - 1].it.id) { const j = out.findIndex((o, n) => n > i && o.it.id !== out[i].it.id); if (j > 0) [out[i], out[j]] = [out[j], out[i]]; }
  return { items: out.map((o) => o.it), vix: out.map((o) => (nbVariantes(o.it) > 1 ? o.v : null)) };
}

/* ================= Avant de dormir ================= */
// Flashcards déjà rencontrées (on consolide, on n'apprend pas du neuf), sans chrono ni son, couleurs chaudes.
const estSoir = () => { const h = new Date().getHours(); return h >= 21 || h < 4; };
function planNuit(items, prog) {
  const fc = items.filter((it) => it.type === 'flashcard');
  const vues = fc.filter((it) => prog[it.id]?.box);
  const pool = vues.length >= 6 ? vues : fc;
  return prioritize(pool, prog).slice(0, 10);
}
function modeNuit(on) {
  setSilence(on);
  document.body.classList.toggle('nuit', on);
  if (on) document.documentElement.dataset.theme = 'sombre'; else applyTheme();
}
function nuitSheet(liste) {
  if (liste.length === 1) return startSession({ code: liste[0].m.code, kind: 'nuit' });
  const sh = openSheet(`
    <div class="between"><h2>Avant de dormir</h2><button class="icon-btn" data-close aria-label="Fermer">${ic('close')}</button></div>
    <p class="muted" style="margin:0">10 flashcards que tu as déjà vues, sans chrono ni son. Ce que tu revois juste avant de dormir se consolide pendant la nuit.</p>
    <div class="list">${liste.map((x) => `<button class="card cfg-card c-${x.m.couleur}" data-nuit="${esc(x.m.code)}"><span><b>${esc(x.m.code)}</b><span class="small muted" style="display:block">${esc(x.m.nom)}</span></span>${ic('moon')}</button>`).join('')}</div>`);
  sh.back.querySelectorAll('[data-nuit]').forEach((b) => b.onclick = () => { sh.close(); startSession({ code: b.dataset.nuit, kind: 'nuit' }); });
}

/* ================= Recherche, glossaire, auteur·rices ================= */
const RQ = { q: '', onglet: 'glossaire', code: null };
let INDEX = null, INDEX_KEY = '';
function getIndex() {
  const cs = S.tousContenus();
  const key = cs.map((c) => c.code + (c.importeLe || '')).join('|');
  if (key !== INDEX_KEY) { INDEX = R.construireIndex(cs); INDEX_KEY = key; }
  return INDEX;
}
const lettre = (t) => { const l = normalize(t).charAt(0).toUpperCase(); return /[A-Z]/.test(l) ? l : '#'; };
/** Clé de tri d'un·e auteur·rice : le nom de famille de la première personne citée. */
const cleAuteur = (n) => { const p = n.split(/ et |\s*\(|,/)[0].trim().split(' ').filter((w) => !/^(al\.|von|de|van|der)$/i.test(w)); return p[p.length - 1] || n; };
const trie = (a, b) => normalize(a).localeCompare(normalize(b));
const coul = (code) => S.getMatiere(code)?.couleur || 'orange';
const puce = (code) => `<span class="chip m c-${coul(code)} sm">${esc(code)}</span>`;

function viewRecherche(code) {
  tabbar(null); setHalo(code ? coul(code) : null);
  if (code !== null) RQ.code = code;
  const cs = S.tousContenus();
  const avecGloss = cs.filter((c) => c.glossaire?.length || c.auteurs?.length);
  $app.innerHTML = `
    <div class="row" style="gap:10px"><button class="icon-btn" id="rback" aria-label="Retour">${ic('back')}</button><label class="field search-field" style="flex:1"><span class="sr">Rechercher</span>${ic('search')}<input id="rq" type="search" placeholder="Une notion, un·e auteur·rice, une date…" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" value="${esc(RQ.q)}"></label></div>
    <div class="pills" id="rcodes">${[null, ...cs.map((c) => c.code)].map((c) => `<button class="pill ${c ? 'c-' + coul(c) : ''}" data-rcode="${c || ''}" aria-pressed="${RQ.code === c}">${c ? esc(c) : 'Toutes'}</button>`).join('')}</div>
    <div id="res" style="display:flex;flex-direction:column;gap:14px"></div>`;
  const draw = () => {
    const box = document.getElementById('res');
    const q = RQ.q.trim();
    if (!q) {
      if (!avecGloss.length) { box.innerHTML = `<div class="card empty">${stroopImg('etude', 'small')}<p><b>Tape un mot pour chercher dans tes fiches et tes questions.</b></p><p class="small muted">Le glossaire et les auteur·rices arrivent avec les nouvelles versions des fichiers de contenu.</p></div>`; return; }
      const sel = cs.filter((c) => !RQ.code || c.code === RQ.code);
      const liste = RQ.onglet === 'glossaire'
        ? sel.flatMap((c) => (c.glossaire || []).map((g) => ({ code: c.code, nom: g.terme, sous: g.def, g })))
        : sel.flatMap((c) => (c.auteurs || []).map((a) => ({ code: c.code, nom: a.nom, cle: cleAuteur(a.nom), sous: [a.reperes, a.apport].filter(Boolean).join(' · '), a })));
      liste.sort((a, b) => trie(a.cle || a.nom, b.cle || b.nom));
      const groupes = []; for (const e of liste) { const l = lettre(e.cle || e.nom); if (!groupes.length || groupes[groupes.length - 1].l !== l) groupes.push({ l, e: [] }); groupes[groupes.length - 1].e.push(e); }
      box.innerHTML = `<div class="seg rseg"><button data-onglet="glossaire" aria-pressed="${RQ.onglet === 'glossaire'}">Glossaire</button><button data-onglet="auteurs" aria-pressed="${RQ.onglet === 'auteurs'}">Auteur·rices</button></div>
        ${groupes.length ? `<div class="az">${groupes.map((g) => `<a href="#" data-az="${g.l}">${g.l}</a>`).join('')}</div>` : ''}
        ${groupes.map((g) => `<div class="glo-l" id="az-${g.l}">${g.l}</div><div class="list">${g.e.map((e, i) => `<button class="card glo" data-ent="${esc(e.code)}|${RQ.onglet}|${esc(e.nom)}"><span class="between" style="gap:8px"><b>${esc(e.nom)}</b>${RQ.code ? '' : puce(e.code)}</span><span class="small muted clamp2">${esc(e.sous)}</span></button>`).join('')}</div>`).join('') || '<p class="muted">Rien pour cette matière pour l’instant.</p>'}`;
      box.querySelectorAll('[data-onglet]').forEach((b) => b.onclick = () => { RQ.onglet = b.dataset.onglet; draw(); });
      box.querySelectorAll('[data-az]').forEach((a) => a.onclick = (ev) => { ev.preventDefault(); document.getElementById('az-' + a.dataset.az)?.scrollIntoView({ block: 'start', behavior: 'smooth' }); });
      box.querySelectorAll('[data-ent]').forEach((b) => b.onclick = () => ouvrirEntree(...b.dataset.ent.split('|')));
      return;
    }
    const res = R.chercher(getIndex(), q).filter((d) => !RQ.code || d.code === RQ.code);
    const termes = res.filter((d) => d.k === 'terme').slice(0, 6), auteurs = res.filter((d) => d.k === 'auteur').slice(0, 4);
    const fiches = res.filter((d) => d.k === 'fiche').slice(0, 8);
    const qs = res.filter((d) => d.k === 'question');
    const parNotion = new Map(); for (const d of qs) { const k = d.code + '|' + (d.e.notion || d.ch.titre); if (!parNotion.has(k)) parNotion.set(k, { code: d.code, notion: d.e.notion || d.ch.titre, ids: [] }); parNotion.get(k).ids.push(d.id); }
    const notions = [...parNotion.values()].slice(0, 8);
    const hl = (t) => R.surligner(esc(t), q);
    box.innerHTML = !res.length ? `<div class="card empty">${stroopImg('etude', 'small')}<p><b>Rien trouvé pour « ${esc(q)} ».</b></p><p class="small muted">Essaie un autre mot, ou le nom d’un·e auteur·rice.</p></div>` : `
      ${termes.length ? `<h2 class="section-title">Glossaire</h2><div class="list">${termes.map((d) => `<button class="card glo" data-ent="${esc(d.code)}|glossaire|${esc(d.g.terme)}"><span class="between" style="gap:8px"><b>${hl(d.g.terme)}</b>${puce(d.code)}</span><span class="small muted clamp2">${hl(d.g.def)}</span></button>`).join('')}</div>` : ''}
      ${auteurs.length ? `<h2 class="section-title">Auteur·rices</h2><div class="list">${auteurs.map((d) => `<button class="card glo" data-ent="${esc(d.code)}|auteurs|${esc(d.a.nom)}"><span class="between" style="gap:8px"><b>${hl(d.a.nom)}</b>${puce(d.code)}</span><span class="small muted clamp2">${hl([d.a.reperes, d.a.apport].filter(Boolean).join(' · '))}</span></button>`).join('')}</div>` : ''}
      ${notions.length ? `<h2 class="section-title">À réviser</h2><div class="list">${notions.map((n, i) => `<div class="card glo row" style="gap:10px"><span style="flex:1;min-width:0"><span class="between" style="gap:8px"><b>${hl(n.notion)}</b>${puce(n.code)}</span><span class="small muted">${plural(n.ids.length, 'question')}</span></span><button class="btn soft sm" data-rev="${i}">Réviser</button></div>`).join('')}</div>` : ''}
      ${fiches.length ? `<h2 class="section-title">Dans les fiches</h2><div class="list">${fiches.map((d, i) => `<button class="card glo" data-fi="${i}"><span class="between" style="gap:8px"><span class="small muted">${esc(shortChap(d.ch.titre))} · ${esc(d.sec.titre)}</span>${puce(d.code)}</span><span class="small">${hl(d.texte)}</span></button>`).join('')}</div>` : ''}`;
    box.querySelectorAll('[data-ent]').forEach((b) => b.onclick = () => ouvrirEntree(...b.dataset.ent.split('|')));
    box.querySelectorAll('[data-rev]').forEach((b) => b.onclick = () => { const n = notions[Number(b.dataset.rev)]; startSession({ code: n.code, kind: 'notion', ids: n.ids, titre: n.notion }); });
    box.querySelectorAll('[data-fi]').forEach((b) => b.onclick = () => { const d = fiches[Number(b.dataset.fi)]; ficheSheet(S.getMatiere(d.code), d.ch, d.sec.id); });
  };
  document.getElementById('rback').onclick = () => (history.length > 1 ? history.back() : go('#/'));
  const inp = document.getElementById('rq');
  let t = null;
  inp.oninput = () => { clearTimeout(t); t = setTimeout(() => { RQ.q = inp.value; draw(); }, 140); };
  inp.onkeydown = (e) => { if (e.key === 'Enter') inp.blur(); };
  document.querySelectorAll('[data-rcode]').forEach((b) => b.onclick = () => { RQ.code = b.dataset.rcode || null; setHalo(RQ.code ? coul(RQ.code) : null); document.querySelectorAll('[data-rcode]').forEach((x) => x.setAttribute('aria-pressed', String((x.dataset.rcode || null) === RQ.code))); draw(); });
  draw();
  if (!RQ.q && !code) setTimeout(() => inp.focus(), 50);
}

function ouvrirEntree(code, onglet, nom) {
  const c = S.tousContenus().find((x) => x.code === code); if (!c) return;
  if (onglet === 'glossaire') { const g = c.glossaire.find((x) => x.terme === nom); if (g) termeSheet(c, g); }
  else { const a = c.auteurs.find((x) => x.nom === nom); if (a) auteurSheet(c, a); }
}
/** Passages des fiches qui citent un mot (pour « Dans le cours »). */
function passages(c, mots) {
  const cibles = mots.map(normalize).filter((x) => x.length >= 3);
  const out = [];
  for (const ch of c.chapitres) for (const sec of ch.fiche || []) {
    const t = ' ' + normalize([sec.titre, ...sec.points].join(' ')) + ' ';
    if (cibles.some((x) => t.includes(' ' + x))) out.push({ ch, sec });
  }
  return out;
}
async function entreeSheet(c, { titre, sousTitre, corps, extra = '', ids, mots, notion }) {
  const m = S.getMatiere(c.code); const prog = await S.getProgres(c.code);
  const items = S.flatItems(c).filter((it) => ids.includes(it.id));
  const vus = items.filter((it) => prog[it.id]?.box).length, maitr = items.length ? mastery(items, prog) : 0;
  const ps = passages(c, mots).slice(0, 6);
  const sh = openSheet(`
    <div class="between" style="align-items:flex-start"><div>${puce(c.code)}<h2 style="font-size:22px;margin:8px 0 0">${esc(titre)}</h2>${sousTitre ? `<div class="small muted">${esc(sousTitre)}</div>` : ''}</div><button class="icon-btn" data-close aria-label="Fermer">${ic('close')}</button></div>
    <p style="margin:0;font-size:16px;line-height:1.5">${esc(corps)}</p>
    ${extra}
    ${ps.length ? `<div class="field">Dans le cours<div class="list">${ps.map((p, i) => `<button class="card cfg-card" data-ps="${i}"><span><b class="small">${esc(shortChap(p.ch.titre))}</b><span class="small muted" style="display:block">${esc(p.sec.titre)}</span></span>${ic('book')}</button>`).join('')}</div></div>` : ''}
    ${items.length ? `<div class="small muted">${plural(items.length, 'question liée', 'questions liées')} · ${vus} déjà vue${vus > 1 ? 's' : ''} · maîtrise ${pct(maitr)}</div>` : ''}
    <button class="cta cta-m" id="revn" ${items.length ? '' : 'disabled'}><span><span class="t">Réviser cette notion</span><span class="s">${items.length ? 'Rappel, compréhension, puis mise en situation' : 'Pas encore de question liée'}</span></span><span class="go">${ic('arrow')}</span></button>`, `c-${m?.couleur || 'orange'}`);
  sh.back.querySelectorAll('[data-ps]').forEach((b) => b.onclick = () => { const p = ps[Number(b.dataset.ps)]; sh.close(); ficheSheet(m, p.ch, p.sec.id); });
  sh.back.querySelectorAll('[data-voir]').forEach((b) => b.onclick = () => { const g = (c.glossaire || []).find((x) => normalize(x.terme) === normalize(b.dataset.voir)); sh.close(); if (g) termeSheet(c, g); else { RQ.q = b.dataset.voir; go('#/recherche'); } });
  sh.back.querySelector('#revn').onclick = () => { sh.close(); startSession({ code: c.code, kind: 'notion', ids, titre: notion }); };
}
function termeSheet(c, g) {
  const ids = R.questionsDuTerme(c, g);
  const gras = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  const extra = `${g.aussi?.length ? `<div class="small muted">Aussi : ${esc(g.aussi.join(', '))}</div>` : ''}
    ${g.criteres?.length ? `<div class="criteres"><div class="between"><b>Critères DSM-5</b><span class="small muted">en gras : l’essentiel du cours</span></div><ul>${g.criteres.map((c) => (c.includes(' · ') ? c.split(' · ').map((x) => `<li class="sub">${gras(x)}</li>`).join('') : `<li>${gras(c)}</li>`)).join('')}</ul></div>` : ''}
    ${g.exemple ? `<div class="reflechir" style="gap:4px"><b class="small">Exemple</b><span class="small">${esc(g.exemple)}</span></div>` : ''}
    ${g.voir?.length ? `<div class="field">Voir aussi<div class="pills">${g.voir.map((v) => `<button class="pill" data-voir="${esc(v)}">${esc(v)}</button>`).join('')}</div></div>` : ''}`;
  entreeSheet(c, { titre: g.terme, sousTitre: g.auteur || '', corps: g.def, extra, ids, mots: [g.terme, ...(g.aussi || [])], notion: g.terme });
}
function auteurSheet(c, a) {
  const nom = a.nom.split(/[ ,(]/)[0].length > 2 ? a.nom.replace(/\s*\(.*/, '') : a.nom;
  const cle = nom.split(' ').pop();
  const ids = R.questionsDuTerme(c, { terme: cle, aussi: a.aussi || [] });
  entreeSheet(c, { titre: a.nom, sousTitre: a.reperes || '', corps: a.apport, ids, mots: [cle, ...(a.aussi || [])], notion: a.nom });
}

/* ================= Labo écoute (test du futur mode écoute) ================= */
// Deux tests à faire sur le téléphone : les voix françaises disponibles, et la lecture audio écran verrouillé.
function wavBips(sec = 90) {
  // fichier WAV généré à la volée : un bip doux toutes les 5 secondes, pour vérifier la lecture en arrière-plan
  const sr = 16000, n = sr * sec, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) { const t = i / sr, k = t % 5; const a = k < 0.35 ? Math.sin(Math.PI * k / 0.35) * 0.35 : 0; v.setInt16(44 + i * 2, Math.round(a * Math.sin(2 * Math.PI * (k < 0.18 ? 660 : 880) * t) * 32767), true); }
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}
function laboEcoute() {
  const synth = window.speechSynthesis;
  const voix = () => (synth ? synth.getVoices().filter((x) => /^fr/i.test(x.lang)) : []);
  const ua = `${/iPhone|iPad/.test(navigator.userAgent) ? 'iPhone/iPad' : /Android/.test(navigator.userAgent) ? 'Android' : 'Ordinateur'} · ${matchMedia('(display-mode: standalone)').matches || navigator.standalone ? 'appli installée' : 'navigateur'}`;
  const sh = openSheet(`
    <div class="between"><h2>Labo écoute</h2><button class="icon-btn" data-close aria-label="Fermer">${ic('close')}</button></div>
    <p class="muted small" style="margin:0">Deux tests rapides pour préparer le mode écoute. Note ce qui se passe et raconte-le à Claude. (${esc(ua)})</p>
    <div class="field">1. Les voix du téléphone<div id="lvx" class="list"></div></div>
    <div class="field">2. Écran verrouillé<span class="small muted" style="font-weight:600">Lance le son (un bip toutes les 5 s pendant 1 min 30), verrouille ton téléphone, puis écoute : les bips continuent-ils ? Les commandes apparaissent-elles sur l’écran verrouillé ?</span>
      <div class="two"><button class="btn soft" id="lbip">${ic('play')}Lancer les bips</button><button class="btn plain" id="lstop">Arrêter</button></div><span class="small" id="lbipetat" style="font-weight:700"></span></div>
    <div class="field">2 bis. Avec Spotify<span class="small muted" style="font-weight:600">Lance une musique sur Spotify, reviens ici et essaie chaque façon (5 s de bips). Note pour chacune : Spotify se met-il en pause, baisse-t-il, reprend-il tout seul à la fin ?</span>
      <div class="two"><button class="btn soft" id="lbipC">Façon C</button><button class="btn soft" id="lbipD">Façon D</button></div><div class="two"><button class="btn plain" id="lbipA">Façon A</button><button class="btn plain" id="lbipB">Façon B</button></div><span class="small" id="lbipABetat" style="font-weight:700"></span></div>
    <div class="field">4. Voix naturelles<span class="small muted" style="font-weight:600">Calculées sur ton téléphone : le texte ne quitte jamais l’appli. Chaque voix (fichier public, sans rien de toi) se télécharge une fois, en Wi-Fi de préférence.</span>
      <div class="pills" id="pvx"></div>
      <div id="pmls" class="reflechir" style="display:none;gap:6px"><b class="small">125 voix différentes (femmes et hommes) : change de numéro, puis écoute</b><div class="row" style="gap:8px"><button class="btn plain sm" id="pmoins">−</button><span class="small" style="font-weight:800;flex:1;text-align:center" id="pnum">Voix n° 0</span><button class="btn plain sm" id="pplus">+</button><button class="btn plain sm" id="phasard">Au hasard</button></div></div>
      <div class="seg" id="pvit"><button data-vit="1" aria-pressed="true">Vitesse normale</button><button data-vit="0.85" aria-pressed="false">Plus lente</button></div>
      <label class="field"><span class="sr">Texte à lire</span><textarea id="ptxt" rows="3">Bonjour ! Je suis une voix de synthèse qui fonctionne directement sur ton téléphone. Est-ce que je te parais naturelle ?</textarea></label>
      <button class="btn soft" id="pgo">${ic('play')}Écouter cette voix</button><span class="small" id="petat" style="font-weight:700"></span></div>
    <div class="field">3. Voix écran verrouillé<span class="small muted" style="font-weight:600">Même test avec la voix du téléphone : lance la lecture, verrouille, écoute si elle continue.</span>
      <button class="btn soft" id="lvoixlock">${ic('play')}Lire un long passage</button></div>`);
  const phrase = 'Bonjour, je suis la voix du téléphone. Ceci est un simple test de lecture, pour savoir si je continue à parler quand l’écran est verrouillé.';
  const dire = (texte, v) => { if (!synth) return toast('Synthèse vocale indisponible ici'); synth.cancel(); const u = new SpeechSynthesisUtterance(texte); u.lang = 'fr-FR'; if (v) u.voice = v; u.rate = 0.95; synth.speak(u); };
  const remplir = () => {
    const vs = voix();
    sh.back.querySelector('#lvx').innerHTML = vs.length ? vs.map((x, i) => `<button class="card cfg-card" data-lv="${i}"><span><b>${esc(x.name)}</b><span class="small muted" style="display:block">${esc(x.lang)}${x.localService ? ' · sur le téléphone' : ' · en ligne'}</span></span>${ic('play')}</button>`).join('') : '<p class="small muted" style="margin:0">Aucune voix française trouvée (ou pas encore chargée).</p>';
    sh.back.querySelectorAll('[data-lv]').forEach((b) => b.onclick = () => dire(phrase, vs[Number(b.dataset.lv)]));
  };
  remplir(); if (synth) synth.onvoiceschanged = remplir;
  let audio = null;
  sh.back.querySelector('#lbip').onclick = () => {
    // « playback » : joue même en mode silencieux et autorise l'arrière-plan (Safari 16.4+)
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
    const etat = sh.back.querySelector('#lbipetat');
    audio?.pause(); audio = new Audio(wavBips()); audio.loop = false;
    audio.onplaying = () => { etat.textContent = 'Lecture en cours : tu devrais entendre un bip toutes les 5 secondes.'; };
    audio.onerror = () => { etat.textContent = 'Erreur de lecture du son (code ' + (audio.error?.code ?? '?') + ').'; };
    etat.textContent = 'Démarrage…';
    audio.play().catch((e) => { etat.textContent = 'Lecture refusée par le téléphone : ' + e.name + ' (' + e.message + ')'; });
    if ('mediaSession' in navigator) { navigator.mediaSession.metadata = new MediaMetadata({ title: 'Test du mode écoute', artist: 'Stroop Study', artwork: [{ src: 'assets/icons/icon-512.png', sizes: '512x512', type: 'image/png' }] }); navigator.mediaSession.setActionHandler('pause', () => audio?.pause()); navigator.mediaSession.setActionHandler('play', () => audio?.play()); }
  };
  // A = « transient-solo » (met les autres sons en pause, ils peuvent reprendre à la fin) ; B = « playback » puis on rend la main.
  // C = comme A, mais on libère complètement le son à la fin (élément vidé, session « auto ») ; D = Spotify baisse sans s'arrêter.
  const essai = (type, nom, liberer = false) => {
    const etat = sh.back.querySelector('#lbipABetat');
    try { if (navigator.audioSession) navigator.audioSession.type = type; } catch {}
    audio?.pause(); audio = new Audio(wavBips(5));
    const rendre = () => {
      if (liberer) { audio.removeAttribute('src'); audio.load(); }
      try { if (navigator.audioSession) navigator.audioSession.type = liberer ? 'auto' : 'ambient'; } catch {}
      etat.textContent = `${nom} terminée : Spotify a-t-il repris tout seul ?`;
    };
    audio.onended = rendre;
    audio.onplaying = () => { etat.textContent = `${nom} en cours (5 s)…`; };
    audio.play().catch((e) => { etat.textContent = `${nom} : lecture refusée (${e.name})`; });
  };
  sh.back.querySelector('#lbipA').onclick = () => essai('transient-solo', 'Façon A');
  sh.back.querySelector('#lbipB').onclick = () => essai('playback', 'Façon B');
  sh.back.querySelector('#lbipC').onclick = () => essai('transient-solo', 'Façon C', true);
  sh.back.querySelector('#lbipD').onclick = () => essai('transient', 'Façon D', true);
  let pvoix = 'pierre', pnum = 0, pvit = 1, nbLoc = 125;
  import('./voix.js').then((V) => V.nettoyer()).catch(() => {});
  const dessinerVoix = async () => {
    const V = await import('./voix.js');
    const box = sh.back.querySelector('#pvx');
    box.innerHTML = (await Promise.all(V.VOIX.map(async (v) => `<button class="pill" data-pv="${v.id}" aria-pressed="${v.id === pvoix}">${v.genre === 'm' ? '♂' : v.genre === 'f' ? '♀' : '♂♀'} ${esc(v.nom)} <span class="muted">${(await V.estTelechargee(v)) ? '✓' : v.mo + ' Mo'}</span></button>`))).join('');
    box.querySelectorAll('[data-pv]').forEach((b) => b.onclick = () => { pvoix = b.dataset.pv; dessinerVoix(); });
    sh.back.querySelector('#pmls').style.display = pvoix === 'mls' ? 'flex' : 'none';
    sh.back.querySelector('#pgo').innerHTML = `${ic('play')}Écouter ${pvoix === 'mls' ? `la voix MLS n° ${pnum}` : 'cette voix'}`;
    sh.back.querySelector('#pnum').textContent = `Voix n° ${pnum} sur ${nbLoc}`;
  };
  dessinerVoix();
  sh.back.querySelector('#pmoins').onclick = () => { pnum = (pnum - 1 + nbLoc) % nbLoc; dessinerVoix(); };
  sh.back.querySelector('#pplus').onclick = () => { pnum = (pnum + 1) % nbLoc; dessinerVoix(); };
  sh.back.querySelector('#phasard').onclick = () => { pnum = Math.floor(Math.random() * nbLoc); dessinerVoix(); };
  sh.back.querySelectorAll('[data-vit]').forEach((b) => b.onclick = () => { pvit = Number(b.dataset.vit); sh.back.querySelectorAll('[data-vit]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); });
  sh.back.querySelector('#pgo').onclick = async () => {
    const etat = (t) => { sh.back.querySelector('#petat').textContent = t; };
    const btn = sh.back.querySelector('#pgo'); btn.disabled = true;
    try {
      etat('Préparation…');
      const V = await import('./voix.js');
      const v = V.VOIX.find((x) => x.id === pvoix);
      const t0 = performance.now();
      const r = await V.synthese(v, sh.back.querySelector('#ptxt').value.trim() || 'Bonjour.', { locuteur: v.multi ? pnum : null, vitesse: pvit, progression: (x) => etat(`Téléchargement de la voix : ${Math.round(x * 100)} %`) });
      const t1 = performance.now();
      if (v.multi) nbLoc = r.nbLocuteurs;
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
      audio?.pause(); audio = new Audio(URL.createObjectURL(r.blob));
      audio.onended = () => { try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch {} };
      await audio.play();
      etat(`${v.nom}${v.multi ? ` n° ${pnum}` : ''} : ${r.secondes.toFixed(1)} s de parole, prêtes en ${((t1 - t0) / 1000).toFixed(1)} s.`);
      dessinerVoix();
    } catch (e) { etat('Erreur : ' + (e?.message || e)); console.error(e); }
    btn.disabled = false;
  };
  sh.back.querySelector('#lstop').onclick = () => { audio?.pause(); synth?.cancel(); };
  sh.back.querySelector('#lvoixlock').onclick = () => dire(Array(6).fill(phrase).join(' '), voix()[0]);
}

/* ================= Sessions ================= */
const SAVE_KEY = 'stroop-session';
function saveSession() { if (session && session.kind !== 'rafale') localStorage.setItem(SAVE_KEY, JSON.stringify(session)); }
function clearSaved() { localStorage.removeItem(SAVE_KEY); }
function loadSaved() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (!s || Date.now() - s.started > 36 * 3600 * 1000 || s.i >= s.ids.length) { clearSaved(); return null; }
    return s;
  } catch { return null; }
}

async function startSession({ code, chapitres = null, kind = 'normal', ids = null, titre = null }) {
  const contenu = await S.getContenu(code);
  const prog = await S.getProgres(code);
  const cfg = kind === 'jour' ? { types: TYPE_KEYS, n: 12, niveau: 'tous', chrono: getCfg(code).chrono } : getCfg(code);
  let items = S.flatItems(contenu);
  if (chapitres && chapitres.length) items = items.filter((it) => chapitres.includes(it.chapitre));
  let vix = null;
  if (kind === 'notion') ({ items, vix } = planNotion(items.filter((it) => ids.includes(it.id))));
  else if (kind === 'nuit') items = planNuit(items, prog);
  else if (ids) items = shuffle(items.filter((it) => ids.includes(it.id)));
  else if (kind === 'jour') items = prioritize(items.filter((it) => it.type !== 'flashcard' && isDue(prog[it.id])), prog).slice(0, 12);
  else if (kind === 'flash') items = prioritize(filtrerOuvertes(items.filter((it) => it.type === 'flashcard'), prog, cfg.toutOuvrir, items), prog).slice(0, 20);
  else if (kind === 'erreurs') items = shuffle(items.filter((it) => prog[it.id]?.err && it.type !== 'flashcard'));
  else {
    items = filtrerOuvertes(items.filter((it) => matchCfg(it, cfg)), prog, cfg.toutOuvrir, items);
    if (kind === 'rafale') items = prioritize(items, prog);
    else items = prioritize(items, prog).slice(0, cfg.n === 'tout' ? items.length : cfg.n);
  }
  if (!items.length) return toast('Rien à réviser avec ces réglages');
  clearSaved();
  const all = S.flatItems(contenu);
  session = {
    code, kind, ids: items.map((i) => i.id), base: items.map((i) => i.id), i: 0, started: Date.now(),
    endsAt: kind === 'rafale' ? Date.now() + 120000 : null,
    chrono: !!cfg.chrono && !['rafale', 'flash', 'notion', 'nuit'].includes(kind),
    reflechir: kind === 'notion' || (!!cfg.reflechir && kind !== 'rafale'), vix, titre,
    results: [], score: 0, m0: mastery(all, prog)
  };
  saveSession();
  go('#/session');
}

let timerId = null, qTimerId = null;
async function viewSession() {
  noTab();
  if (!session) { const s = loadSaved(); if (s) session = s; else return go('#/'); }
  if (session.pausedAt) session.pausedAt = null;
  modeNuit(session.kind === 'nuit');
  document.querySelector('.pause-ov')?.remove();
  const m = S.getMatiere(session.code); setHalo(m.couleur);
  const contenu = await S.getContenu(session.code);
  const prog = await S.getProgres(session.code);
  const byId = Object.fromEntries(S.flatItems(contenu).map((it) => [it.id, it]));
  const chapById = Object.fromEntries(contenu.chapitres.map((c) => [c.id, c]));
  clearInterval(timerId); clearInterval(qTimerId);

  const finish = () => {
    clearInterval(timerId); clearInterval(qTimerId); clearSaved(); son('end'); modeNuit(false);
    lastRecap = { ...session, matiere: m, m1: mastery(Object.values(byId), prog) };
    session = null; go('#/recap');
  };
  if (session.kind === 'rafale' && Date.now() >= session.endsAt) return finish();
  if (session.i >= session.ids.length) {
    if (session.kind === 'rafale') session.ids = session.ids.concat(prioritize((session.base || session.ids).map((id) => ({ id })), prog).map((x) => x.id));
    else return finish();
  }
  if (!byId[session.ids[session.i]]) { session.i++; return viewSession(); }
  let it = resolveVariants(byId[session.ids[session.i]], session.vix?.[session.i] ?? null);
  // QCM : une fois sur deux, une mauvaise proposition est retirée au hasard (jamais une bonne : l'explication
  // peut la citer), pour que le nombre de propositions varie. Il reste toujours au moins une mauvaise réponse.
  if (formatOf(it) === 'qcm' && !it.lettres && it.choix?.length >= 4 && it.choix.length - it.bonnes.length >= 2 && Math.random() < 0.5) {
    const candidats = it.choix.map((_, i) => i).filter((i) => !it.bonnes.includes(i));
    const retire = candidats[Math.floor(Math.random() * candidats.length)];
    const garde = it.choix.map((_, i) => i).filter((i) => i !== retire);
    it = { ...it, choix: garde.map((i) => it.choix[i]), bonnes: it.bonnes.filter((b) => b !== retire).map((b) => garde.indexOf(b)) };
  }
  const autreSituation = session.vix?.[session.i] > 0;
  const pBefore = { ...(prog[it.id] || {}) };
  const fmt = formatOf(it);
  const total = session.kind === 'rafale' ? null : session.ids.length;
  const progress = total ? Math.round((session.i / total) * 100) : Math.round(((120000 - (session.endsAt - Date.now())) / 120000) * 100);
  const timed = session.chrono && !['flashcard', 'redaction'].includes(it.type);
  const st = {
    flipped: false, answered: false, correct: null, pif: false, skip: false, timeout: false,
    picked: new Set(), text: '',
    // « lettres » : format examen a) b) c)… avec réponses combinées (« C et D ») → ordre fixe
    perm: it.lettres ? (it.choix || []).map((_, i) => i) : shuffle((it.choix || []).map((_, i) => i)),
    order: null, pairs: {}, sel: null, leftPerm: null, rightPerm: null, triPick: {}, triPerm: null,
    deadline: timed ? Date.now() + timeFor(it) * 1000 : null,
    shownAt: Date.now()
  };
  // temps passé sur la question (plafonné à 3 min pour ne pas compter une appli oubliée ouverte)
  const logTime = () => { if (st.answered) S.addTime(Math.min(Date.now() - st.shownAt, 180000) / 1000); };
  if (fmt === 'ordre') { do { st.order = shuffle(it.items.map((_, i) => i)); } while (it.items.length > 1 && st.order.every((v, i) => v === i)); }
  if (fmt === 'assoc') { st.leftPerm = shuffle(it.paires.map((_, i) => i)); st.rightPerm = shuffle(it.paires.map((_, i) => i)); }
  if (fmt === 'tri') st.triPerm = shuffle(it.items.map((_, i) => i));

  const isChoice = fmt === 'qcu' || fmt === 'qcm';
  const grade = () => {
    if (isChoice) return sameSet([...st.picked], it.bonnes);
    if (fmt === 'ordre') return st.order.every((v, i) => v === i);
    if (fmt === 'assoc') return it.paires.every((_, l) => Number(st.pairs[l]) === l);
    if (fmt === 'tri') return it.items.every(([, cat], idx) => st.triPick[idx] === cat);
    if (fmt === 'courte') { st.text = document.getElementById('rep')?.value || st.text; return checkCourte(st.text, it.reponses); }
    return false;
  };
  // Réponse complète quand le temps s'écoule : elle est validée telle quelle.
  const complete = () => {
    if (isChoice) return st.picked.size > 0;
    if (fmt === 'ordre') return !!st.moved;
    if (fmt === 'assoc') return Object.keys(st.pairs).length === it.paires.length;
    if (fmt === 'tri') return Object.keys(st.triPick).length === it.items.length;
    if (fmt === 'courte') return !!(document.getElementById('rep')?.value || st.text).trim();
    return false;
  };
  const answer = async (correct, extra = {}) => {
    if (st.answered) return;
    st.answered = true; st.correct = correct;
    clearInterval(qTimerId);
    const ns = nextState(pBefore, correct, null);
    son(!correct ? 'ko' : ns.box > (pBefore.box || 0) && !ns.practice ? 'up' : 'ok');
    await S.recordAnswer(session.code, it.id, ns);
    st.ns = ns;
    session.results.push({ id: it.id, correct, before: pBefore.box || 0, after: ns.box, practice: ns.practice, ...extra });
    session.combo = correct ? (session.combo || 0) + 1 : 0;
    if (session.kind !== 'nuit' && (session.combo === 3 || session.combo === 5 || (session.combo >= 10 && session.combo % 5 === 0))) setTimeout(() => stroopSerie(session.combo), 450);
    if (m.negatif && isChoice) session.score += correct ? 1 : extra.skip || extra.timeout ? 0 : -1;
    else if (correct) session.score += 1;
    saveSession();
  };
  const togglePif = async () => {
    st.pif = !st.pif;
    const ns = nextState(pBefore, true, st.pif ? 'pif' : null);
    await S.recordAnswer(session.code, it.id, ns, { countDay: false });
    st.ns = ns;
    const r = session.results[session.results.length - 1]; if (r) { r.after = ns.box; r.practice = ns.practice; }
    render();
  };
  const requalifier = async () => {
    if (!st.answered || st.correct) return;
    st.correct = true; st.requalifie = true;
    const ns = nextState(pBefore, true, null);
    await S.recordAnswer(session.code, it.id, ns, { countDay: false });
    st.ns = ns; son('ok');
    const r = session.results[session.results.length - 1];
    if (r && r.id === it.id) { r.correct = true; r.after = ns.box; r.practice = ns.practice; }
    session.score += 1; saveSession(); render();
  };
  const advance = () => { clearInterval(qTimerId); logTime(); session.i++; saveSession(); viewSession(); };

  const head = () => `
    <div class="sess-top">
      <button class="icon-btn" id="quit" aria-label="Quitter la session">${ic('close')}</button>
      <span class="bar"><span id="pbar" style="width:${progress}%"></span></span>
      <button class="icon-btn" id="pause" aria-label="Pause">${ic('pause')}</button>
      <span class="timer" id="tim">${total ? `${session.i + 1} / ${total}` : session.endsAt <= Date.now() ? 'Dernière !' : fmtTime(session.endsAt - Date.now())}</span>
    </div>
    <div class="row" style="flex-wrap:wrap"><span class="chip m">${esc(m.code)} · ${esc(shortChap(it.chapitreTitre))}</span><span class="chip">${esc(typeLabel(it.type))}</span>${it.prio ? `<span class="chip prio p${it.prio}">${PRIO_NOMS[it.prio]}</span>` : ''}<span class="chip">${!pBefore.seen && !pBefore.box ? 'Nouvelle question' : pBefore.err ? 'Ratée la dernière fois' : isDue(pBefore) ? `À revoir aujourd’hui · boîte ${pBefore.box}` : `Entraînement · boîte ${pBefore.box}`}</span>${autreSituation ? '<span class="chip">Autre situation</span>' : ''}${session.kind === 'rafale' ? `<span class="chip">${ic('bolt')} ${session.results.length}</span>` : ''}</div>
    ${timed && !st.answered ? (() => { const left = st.deadline - Date.now(); return `<div class="qtimer" aria-hidden="true"><span id="qbar" class="${left < 5000 ? 'late' : ''}" style="width:${Math.max(0, (left / (timeFor(it) * 1000)) * 100)}%"></span></div>`; })() : ''}`;

  const ficheLink = () => {
    const chap = chapById[it.chapitre];
    const sec = chap?.fiche?.find((s) => s.id === it.section);
    return sec ? `<button class="flag-btn fiche-link" id="fiche">${ic('book')}Revoir le cours : ${esc(sec.titre)}</button>` : '';
  };
  const feedback = (extraHtml = '') => {
    if (!st.answered) return '';
    const title = st.timeout ? (st.autoValid ? (st.correct ? 'Temps écoulé, mais ta réponse était juste !' : 'Temps écoulé : ta réponse a été validée telle quelle.') : 'Temps écoulé !') : st.skip ? 'Pas de souci, on la reverra.' : st.requalifie ? 'C’est noté : réponse comptée juste.' : st.correct ? 'Bien joué !' : 'Pas tout à fait.';
    return `<div class="feedback ${st.correct ? 'ok' : 'ko'}" role="status"><b>${title}</b>${extraHtml}${esc(it.explication || '')}${figureHtml(it.figureCorrection)}${boxNote()}
      ${!st.correct ? ficheLink() : ''}</div>`;
  };
  const boxNote = () => {
    const ns = st.ns; if (!ns) return '';
    let t;
    if (!st.correct) t = (pBefore.box || 0) > 1 ? `Retour en boîte 1 : à revoir demain.` : `Boîte 1 : à revoir demain.`;
    else if (ns.practice) t = `Entraînement : cette carte n’était pas encore à revoir (prochaine révision ${fmtDue(dueDate(ns))}). Sa boîte ne bouge pas.`;
    else if (ns.box > (pBefore.box || 0)) t = `Monte en boîte ${ns.box} : à revoir ${fmtDue(dueDate(ns))}.`;
    else t = `Reste en boîte ${ns.box} : à revoir ${fmtDue(dueDate(ns))}.`;
    return `<span class="boxnote">${esc(t)}</span>`;
  };
  const footer = (canValidate, validateLabel = 'Valider') => st.answered
    ? `${fmt === 'courte' && !st.correct && !st.skip && st.text.trim() ? '<button class="btn soft block" id="jaibon">J’avais bon : ma réponse veut dire la même chose</button>' : ''}${st.correct ? `<button class="flag-btn pif" id="pif" aria-pressed="${st.pif}">${st.pif ? '✓ Noté : c’était au pif' : 'C’était au pif ?'}</button>` : ''}<button class="btn primary block" id="next">Continuer${ic('next')}</button>`
    : `<div class="two"><button class="btn plain" id="skip">Je ne sais pas</button><button class="btn primary" id="val" ${canValidate ? '' : 'disabled'}>${validateLabel}</button></div>`;
  const scenario = () => (it.type === 'cas' ? `<div class="scenario"><span class="lab">Cas pratique</span><p>${esc(it.scenario)}</p></div>` : '') + figureHtml(it.figure);
  const flag = () => `<button class="flag-btn" id="flag">${ic('flag')}Signaler</button>`;

  const render = () => {
    let body = '', foot = '';
    if (fmt === 'flashcard') {
      $app.innerHTML = `<div class="c-${m.couleur}" style="display:flex;flex-direction:column;gap:16px;flex:1">
        ${head()}
        <div class="stage"><span class="ghost-card" aria-hidden="true"></span>
          <button class="fcard" id="card">
            <span class="swipe-tag no" id="tno" aria-hidden="true">À revoir</span><span class="swipe-tag yes" id="tyes" aria-hidden="true">Je sais</span>
            <span class="lab">${st.flipped ? 'Réponse' : /\?\s*$/.test(it.recto || '') ? 'Question' : 'Définis'}</span>
            <span class="body">${st.flipped ? `<span class="verso">${esc(it.verso)}</span>${figureHtml(it.figureVerso)}` : `<span class="recto">${esc(it.recto)}</span>${figureHtml(it.figure)}`}</span>
            <span class="sr">${st.flipped ? '' : ' Touche pour voir la réponse.'}</span><span class="hint" aria-hidden="true">${ic('flip')}${st.flipped ? 'Glisse à droite si tu savais, à gauche sinon' : 'Touche pour retourner'}</span>
          </button>
        </div>
        ${st.flipped ? `<div class="two"><button class="btn no" id="no">${ic('back')}À revoir</button><button class="btn primary" id="yes">Je sais${ic('next')}</button></div>
        <button class="flag-btn" id="half" style="align-self:center">Je savais à moitié</button>` : '<div style="height:8px"></div>'}
        <div class="between">${flag()}${st.flipped ? ficheLink() : ''}</div>
      </div>`;
      const card = document.getElementById('card');
      card.onclick = () => { if (card.dataset.dragged) { delete card.dataset.dragged; return; } st.flipped = !st.flipped; son('flip'); render(); };
      if (st.flipped) {
        document.getElementById('no').onclick = async () => { await answer(false); advance(); };
        document.getElementById('yes').onclick = async () => { await answer(true); advance(); };
        document.getElementById('half').onclick = async () => {
          st.answered = true; st.correct = true; son('ok');
          const ns = nextState(pBefore, true, 'pif');
          await S.recordAnswer(session.code, it.id, ns);
          session.results.push({ id: it.id, correct: true, before: pBefore.box || 0, after: ns.box, practice: ns.practice });
          session.score += 1; advance();
        };
        bindSwipe(card, async (dir) => { await answer(dir > 0); advance(); });
      }
      bindCommon();
      return;
    }

    const qText = esc(it.question || it.affirmation || '');
    if (isChoice) {
      const multi = fmt === 'qcm';
      const good = new Set(it.bonnes);
      body = `<div class="qkind ${multi ? 'multi' : 'single'}">${multi ? '<span class="qk-ic">☑︎</span><span><b>QCM</b> · plusieurs réponses possibles, coche toutes les bonnes</span>' : `<span class="qk-ic">◉</span><span><b>QCU</b> · ${it.lettres ? 'format partiel, une seule bonne réponse sur 5' : 'une seule bonne réponse'}</span>`}${m.negatif ? '<span class="neg">points négatifs</span>' : ''}</div>
        <h2 class="qt">${qText}</h2>
        ${session.reflechir && !st.answered && !st.vu ? `<div class="reflechir">${stroopImg('etude', 'mini pense')}<b>Prends le temps de formuler ta réponse</b><span class="small">Dans ta tête ou à voix haute : la définition, le mécanisme, l’auteur·rice, un exemple… Puis compare avec les propositions.</span><button class="btn soft" id="voir">Voir les propositions</button></div>` : `<div class="list">${st.perm.map((i) => {
          const on = st.picked.has(i); let cls = '', lab = '', sr = '';
          if (st.answered) {
            if (good.has(i) && on) { cls = 'ok'; sr = 'bonne réponse, tu l’as cochée'; }
            else if (good.has(i)) { cls = 'miss'; lab = multi ? 'Oubliée' : 'La bonne'; sr = multi ? 'bonne réponse, tu ne l’as pas cochée' : 'c’était la bonne réponse'; }
            else if (on) { cls = 'ko'; lab = 'Pas celle-ci'; sr = 'mauvaise réponse, tu l’as cochée'; }
          }
          const mark = cls === 'ko' ? IC.close : on || cls ? IC.check : '';
          return `<button class="choice ${cls}" data-i="${i}" aria-pressed="${on}" ${st.answered ? 'disabled' : ''}><span class="mk ${multi ? 's' : 'r'}">${mark ? `<svg class="ic" viewBox="0 0 24 24">${mark}</svg>` : ''}</span><span>${it.lettres ? `<b>${'abcdefgh'[i]})</b> ` : ''}${esc(it.choix[i])}${sr ? `<span class="sr"> (${sr})</span>` : ''}</span>${lab ? `<span class="mlab" aria-hidden="true">${lab}</span>` : ''}</button>`;
        }).join('')}</div>`}`;
      foot = footer(st.picked.size > 0);
    } else if (fmt === 'vf') {
      body = `<h2 class="qt">${qText}</h2>
        <div class="two">${[[true, 'Vrai'], [false, 'Faux']].map(([v, l]) => {
          let cls = 'plain';
          if (st.answered) cls = v === it.vrai ? 'okb' : (st.pickedVf === v ? 'kob' : 'plain');
          return `<button class="btn ${cls} vf" data-vf="${v}" ${st.answered ? 'disabled' : ''}>${l}</button>`;
        }).join('')}</div>`;
      foot = st.answered ? footer(true) : `<button class="flag-btn" id="skip" style="align-self:center">Je ne sais pas</button>`;
    } else if (fmt === 'ordre') {
      body = `<h2 class="qt">${qText}</h2><p class="small muted" style="margin:0">Utilise les flèches pour remettre les éléments dans l’ordre.</p>
        <ol class="olist">${st.order.map((idx, pos) => {
          const cls = st.answered ? (idx === pos ? 'ok' : 'ko') : '';
          return `<li class="oitem ${cls}"><span class="onum">${pos + 1}</span><span class="otxt">${esc(it.items[idx])}</span>
            ${st.answered ? '' : `<span class="oarrows"><button class="icon-btn sm" data-up="${pos}" aria-label="Monter" ${pos === 0 ? 'disabled' : ''}><svg class="ic" viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg></button><button class="icon-btn sm" data-down="${pos}" aria-label="Descendre" ${pos === st.order.length - 1 ? 'disabled' : ''}><svg class="ic" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></button></span>`}</li>`;
        }).join('')}</ol>
        ${st.answered && !st.correct ? `<div class="card" style="padding:12px"><b class="small">Le bon ordre</b><ol class="small" style="margin:6px 0 0;padding-left:20px">${it.items.map((t) => `<li>${esc(t)}</li>`).join('')}</ol></div>` : ''}`;
      foot = footer(true);
    } else if (fmt === 'assoc') {
      const colors = ['#FF9A52', '#5F98EC', '#58BF82', '#9C7DEB', '#EE79A9', '#EBC03F', '#4FC3C7', '#B08968'];
      const rightToLeft = Object.fromEntries(Object.entries(st.pairs).map(([l, r]) => [r, l]));
      const pairNo = {}; Object.keys(st.pairs).forEach((l) => { pairNo[l] = Math.max(0, (st.pairOrder || []).indexOf(Number(l))); });
      const dot = (l) => `<span class="adot" style="background:${colors[pairNo[l] % colors.length]}">${pairNo[l] + 1}</span>`;
      const isSel = (side, i) => st.sel && st.sel.side === side && st.sel.i === i;
      body = `<h2 class="qt">${qText}</h2><p class="small muted" style="margin:0">Touche deux éléments, un dans chaque colonne, pour les associer. Touche une paire pour la défaire.</p>
        <div class="assoc">
          <div class="list">${st.leftPerm.map((l) => {
            const r = st.pairs[l]; const paired = r !== undefined;
            const ok = st.answered ? Number(r) === l : null;
            return `<button class="aitem ${isSel('l', l) ? 'sel' : ''} ${ok === true ? 'ok' : ok === false ? 'ko' : ''}" data-left="${l}" ${st.answered ? 'disabled' : ''}>${paired ? dot(l) : ''}${esc(it.paires[l][0])}</button>`;
          }).join('')}</div>
          <div class="list">${st.rightPerm.map((r) => {
            const l = rightToLeft[r];
            return `<button class="aitem right ${isSel('r', r) ? 'sel' : ''}" data-right="${r}" ${st.answered ? 'disabled' : ''}>${l !== undefined ? dot(l) : ''}${esc(it.paires[r][1])}</button>`;
          }).join('')}</div>
        </div>
        ${st.answered && !st.correct ? `<div class="card" style="padding:12px"><b class="small">Les bonnes paires</b><ul class="small" style="margin:6px 0 0;padding-left:18px">${it.paires.map((p) => `<li>${esc(p[0])} → ${esc(p[1])}</li>`).join('')}</ul></div>` : ''}`;
      foot = footer(Object.keys(st.pairs).length === it.paires.length);
    } else if (fmt === 'tri') {
      body = `<h2 class="qt">${qText}</h2>
        <div class="list">${st.triPerm.map((idx) => {
          const [txt, cat] = it.items[idx]; const pick = st.triPick[idx];
          const cls = st.answered ? (pick === cat ? 'ok' : 'ko') : '';
          return `<div class="titem ${cls}"><span class="ttxt">${esc(txt)}</span>
            <div class="seg tseg">${it.categories.map((c, ci) => `<button data-tri="${idx}" data-cat="${ci}" aria-pressed="${pick === ci}" class="${st.answered ? (ci === cat ? 'segok' : pick === ci ? 'segko' : '') : ''}" ${st.answered ? 'disabled' : ''}>${esc(c)}</button>`).join('')}</div>
            ${st.answered && pick !== cat ? `<span class="small tfix">${pick === undefined ? 'Non classé' : 'Pas « ' + esc(it.categories[pick]) + ' »'} → c’était « ${esc(it.categories[cat])} »</span>` : ''}</div>`;
        }).join('')}</div>`;
      foot = footer(Object.keys(st.triPick).length === it.items.length);
    } else if (fmt === 'redaction') {
      // Question de rédaction : on écrit (ou on formule dans sa tête), puis on compare aux points attendus.
      const pts = st.points || (st.points = new Set());
      const n = it.attendus.length, k = pts.size;
      body = `<h2 class="qt">${qText}</h2>
        ${!st.vu ? `<label class="field"><span class="sr">Ta réponse</span><textarea id="red" rows="7" placeholder="Rédige ta réponse, ou fais-la dans ta tête, puis compare au corrigé. Rien n’est enregistré.">${esc(st.text)}</textarea></label>`
          : `${st.text.trim() ? `<details class="card red-brouillon"><summary class="small"><b>Ta réponse</b></summary><p class="small" style="white-space:pre-wrap;margin:8px 0 0">${esc(st.text)}</p></details>` : ''}
          <p class="small muted" style="margin:0">${st.answered ? 'Les points attendus :' : 'Coche les points que tu avais dans ta réponse :'}</p>
          <div class="list">${it.attendus.map((a, i) => `<button class="choice ${st.answered ? (pts.has(i) ? 'ok' : 'miss') : ''}" data-pt="${i}" aria-pressed="${pts.has(i)}" ${st.answered ? 'disabled' : ''}><span class="mk s">${pts.has(i) ? `<svg class="ic" viewBox="0 0 24 24">${IC.check}</svg>` : ''}</span><span>${esc(a)}</span></button>`).join('')}</div>
          ${it.corrige && st.answered ? `<div class="card" style="padding:12px"><b class="small">Exemple de rédaction</b><p class="small" style="margin:6px 0 0;white-space:pre-wrap">${esc(it.corrige)}</p></div>` : ''}`}`;
      foot = st.answered ? footer(true) : !st.vu
        ? `<div class="two"><button class="btn plain" id="skip">Je ne sais pas</button><button class="btn primary" id="voirRed">Voir le corrigé</button></div>`
        : `<button class="btn primary block" id="valRed">J’avais ${k} point${k > 1 ? 's' : ''} sur ${n}</button>`;
    } else if (fmt === 'courte') {
      body = `<h2 class="qt">${qText}</h2>
        <label class="field"><span class="sr">Ta réponse</span><input id="rep" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Ta réponse…" value="${esc(st.text)}" ${st.answered ? 'disabled' : ''} enterkeyhint="done"></label>
        ${st.answered && !st.correct ? `<div class="small" style="font-weight:800">Réponse attendue : ${esc(it.reponses[0])}</div>` : ''}`;
      foot = footer(true);
    }
    $app.innerHTML = `<div class="c-${m.couleur}" style="display:flex;flex-direction:column;gap:14px;flex:1">
      ${head()}${scenario()}<div class="q">${body}${feedback()}</div><div style="flex:1"></div>${foot}${flag()}</div>`;

    // Interactions
    document.getElementById('voir')?.addEventListener('click', () => { if (st.vu) return; st.vu = true; son('flip'); const p = document.querySelector('.reflechir .pense'); if (p && !calme()) { p.classList.remove('pense'); setTimeout(render, 380); } else render(); });
    $app.querySelectorAll('[data-i]').forEach((b) => b.onclick = () => {
      const i = Number(b.dataset.i);
      if (fmt === 'qcm') { st.picked.has(i) ? st.picked.delete(i) : st.picked.add(i); } else { st.picked = new Set([i]); }
      son('tap'); render(); $app.querySelector(`[data-i="${i}"]`)?.focus({ preventScroll: true });
    });
    $app.querySelectorAll('[data-vf]').forEach((b) => b.onclick = async () => { st.pickedVf = b.dataset.vf === 'true'; await answer(st.pickedVf === it.vrai); render(); });
    $app.querySelectorAll('[data-up]').forEach((b) => b.onclick = () => { const p = Number(b.dataset.up); [st.order[p - 1], st.order[p]] = [st.order[p], st.order[p - 1]]; st.moved = true; son('tap'); render(); });
    $app.querySelectorAll('[data-down]').forEach((b) => b.onclick = () => { const p = Number(b.dataset.down); [st.order[p + 1], st.order[p]] = [st.order[p], st.order[p + 1]]; st.moved = true; son('tap'); render(); });
    const isSame = (sel, side, i) => sel && sel.side === side && sel.i === i;
    const tapAssoc = (side, i) => {
      const l0 = side === 'l' ? i : Object.keys(st.pairs).map(Number).find((k) => Number(st.pairs[k]) === i);
      if (l0 !== undefined && st.pairs[l0] !== undefined) {
        delete st.pairs[l0]; st.pairOrder = (st.pairOrder || []).filter((x) => x !== l0); st.sel = null; return render();
      }
      if (!st.sel || st.sel.side === side) { st.sel = isSame(st.sel, side, i) ? null : { side, i }; son('tap'); return render(); }
      const l = side === 'l' ? i : st.sel.i, r = side === 'r' ? i : st.sel.i;
      st.pairs[l] = r; st.pairOrder = [...(st.pairOrder || []), l]; st.sel = null;
      son('pair'); render();
    };
    $app.querySelectorAll('[data-left]').forEach((b) => b.onclick = () => tapAssoc('l', Number(b.dataset.left)));
    $app.querySelectorAll('[data-right]').forEach((b) => b.onclick = () => tapAssoc('r', Number(b.dataset.right)));
    $app.querySelectorAll('[data-tri]').forEach((b) => b.onclick = () => { st.triPick[Number(b.dataset.tri)] = Number(b.dataset.cat); son('tap'); render(); });
    const rep = document.getElementById('rep');
    if (rep && !st.answered) {
      rep.oninput = () => { st.text = rep.value; };
      rep.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById('val')?.click(); } };
      setTimeout(() => rep.focus(), 30);
    }
    const red = document.getElementById('red');
    if (red) red.oninput = () => { st.text = red.value; };
    document.getElementById('voirRed')?.addEventListener('click', () => { st.vu = true; son('flip'); render(); });
    $app.querySelectorAll('[data-pt]').forEach((b) => b.onclick = () => { const i = Number(b.dataset.pt); st.points.has(i) ? st.points.delete(i) : st.points.add(i); son('tap'); render(); });
    document.getElementById('valRed')?.addEventListener('click', async () => { await answer(st.points.size / it.attendus.length >= 0.7); render(); });
    const val = document.getElementById('val');
    if (val) val.onclick = async () => { await answer(grade()); render(); };
    document.getElementById('skip')?.addEventListener('click', async () => { st.skip = true; await answer(false, { skip: true }); render(); });
    document.getElementById('next')?.addEventListener('click', advance);
    document.getElementById('pif')?.addEventListener('click', togglePif);
    document.getElementById('jaibon')?.addEventListener('click', requalifier);
    bindCommon();
  };

  function bindCommon() {
    document.getElementById('quit').onclick = () => {
      clearInterval(timerId); clearInterval(qTimerId); logTime();
      if (session.results.length && session.kind !== 'rafale') { saveSession(); toast('Session gardée : tu pourras la reprendre'); }
      else if (!session.results.length) clearSaved();
      if (session.kind === 'rafale' && session.results.length) return finish();
      modeNuit(false); session = null; go('#/');
    };
    document.getElementById('flag').onclick = () => flagSheet(session.code, it);
    document.getElementById('pause').onclick = () => {
      session.pausedAt = Date.now(); son('pause');
      const ov = document.createElement('div');
      ov.className = 'pause-ov';
      ov.innerHTML = `<div class="pause-box">${stroopImg('dodo')}<h2>En pause</h2><p class="muted" style="margin:0">Le chrono est arrêté. Prends ton temps !</p><button class="btn primary" id="resumeP">${ic('play')}Reprendre</button></div>`;
      document.body.appendChild(ov); lockScroll();
      ov.querySelector('#resumeP').onclick = () => {
        const d = Date.now() - session.pausedAt; session.pausedAt = null; son('reprise');
        if (st.deadline) st.deadline += d;
        st.shownAt += d;
        if (session.endsAt) session.endsAt += d;
        ov.remove(); unlockScroll();
      };
    };
    document.getElementById('fiche')?.addEventListener('click', () => ficheSheet(m, chapById[it.chapitre], it.section));
  }

  render();
  if (timed) {
    const totalMs = timeFor(it) * 1000;
    qTimerId = setInterval(async () => {
      if (st.answered) return clearInterval(qTimerId);
      if (session?.pausedAt) return;
      const left = st.deadline - Date.now();
      const b = document.getElementById('qbar');
      if (b) { b.style.width = Math.max(0, (left / totalMs) * 100) + '%'; b.classList.toggle('late', left < 5000); }
      const sec = Math.ceil(left / 1000);
      if (sec <= 5 && sec >= 1 && sec !== st.lastTick) { st.lastTick = sec; son('tick'); }
      if (left <= 0) {
        clearInterval(qTimerId); st.timeout = true;
        if (complete()) { st.autoValid = true; await answer(grade(), { timeout: true }); } else await answer(false, { timeout: true });
        render();
      }
    }, 200);
  }
  if (session.kind === 'rafale') {
    timerId = setInterval(() => {
      if (!session || session.pausedAt) return;
      const left = session.endsAt - Date.now();
      const t = document.getElementById('tim'); const b = document.getElementById('pbar');
      if (t) t.textContent = fmtTime(left);
      if (b) b.style.width = Math.min(100, Math.round(((120000 - left) / 120000) * 100)) + '%';
      if (left <= 0) {
        // le temps est écoulé : on laisse finir la question en cours, la rafale se termine à la suivante
        clearInterval(timerId);
        if (t) t.textContent = 'Dernière !';
        if (b) b.style.width = '100%';
        if (!document.querySelector('#next')) toast('Temps écoulé : termine cette question !');
      }
    }, 500);
  }
}
function fmtDue(t) {
  const d0 = new Date(today()).getTime();
  const days = Math.round((t - d0) / 86400000);
  if (days <= 0) return 'aujourd’hui';
  if (days === 1) return 'demain';
  return 'le ' + new Date(t).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}
/** 45 → « 45 min » ; 62 → « 1 h 02 » ; 120 → « 2 h ». */
const fmtMin = (m) => { m = Math.round(m); if (m < 60) return `${m} min`; const h = Math.floor(m / 60), r = m % 60; return r ? `${h} h ${String(r).padStart(2, '0')}` : `${h} h`; };
const fmtTime = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const shortChap = (t) => (t || '').split(' · ')[0];

function bindSwipe(card, onSwipe) {
  let x0 = null, dx = 0;
  const tno = document.getElementById('tno'), tyes = document.getElementById('tyes');
  card.addEventListener('pointerdown', (e) => { x0 = e.clientX; dx = 0; card.classList.add('drag'); card.setPointerCapture?.(e.pointerId); });
  card.addEventListener('pointermove', (e) => {
    if (x0 === null) return;
    dx = e.clientX - x0;
    card.style.transform = `translateX(${dx}px) rotate(${dx / 20}deg)`;
    tyes.style.opacity = Math.max(0, Math.min(1, dx / 90)); tno.style.opacity = Math.max(0, Math.min(1, -dx / 90));
  });
  const end = () => {
    if (x0 === null) return;
    card.classList.remove('drag'); x0 = null;
    if (Math.abs(dx) > 90) {
      card.dataset.dragged = '1';
      card.style.transform = `translateX(${dx > 0 ? 500 : -500}px) rotate(${dx > 0 ? 20 : -20}deg)`; card.style.opacity = '0';
      setTimeout(() => onSwipe(dx), 180);
    } else {
      if (Math.abs(dx) > 8) card.dataset.dragged = '1';
      card.style.transform = ''; tyes.style.opacity = 0; tno.style.opacity = 0;
    }
  };
  card.addEventListener('pointerup', end); card.addEventListener('pointercancel', end);
}

function flagSheet(code, it) {
  const label = itemLabel(it);
  const sh = openSheet(`
    <div class="between"><h2>Signaler</h2><button class="icon-btn" data-close aria-label="Fermer">${ic('close')}</button></div>
    <p class="muted small" style="margin:0">${esc(label)}</p>
    <label class="field">Qu’est-ce qui ne va pas ?<textarea id="note" rows="3" placeholder="ex. réponse fausse, question pas claire, manque de contexte…"></textarea></label>
    <button class="btn primary block" id="send">Signaler</button>
    <p class="muted small" style="margin:0">Retrouve tes signalements dans Profil, pour les transmettre à Claude.</p>`);
  sh.back.querySelector('#send').onclick = async () => { await S.flagItem(code, it.id, sh.back.querySelector('#note').value.trim()); sh.close(); toast('Merci, c’est noté !'); };
  sh.back.querySelector('#note').focus();
}

/* ================= Récap ================= */
function viewRecap() {
  noTab();
  const r = lastRecap; if (!r) return go('#/');
  setHalo(r.matiere.couleur);
  const n = r.results.length; const ok = r.results.filter((x) => x.correct).length;
  const up = r.results.filter((x) => x.correct && x.after > x.before).length; const down = r.results.filter((x) => x.after < x.before).length;
  const practice = r.results.filter((x) => x.practice).length;
  const errs = [...new Set(r.results.filter((x) => !x.correct).map((x) => x.id))];
  const titles = { flash: 'Flashcards terminées !', jour: 'Session du jour terminée !', rafale: 'Fin de la rafale !', erreurs: 'Erreurs revues !', normal: 'Session terminée !', notion: r.titre ? `${r.titre} : notion travaillée !` : 'Notion travaillée !', nuit: 'Bonne nuit !' };
  const gain = (r.m1 ?? 0) - (r.m0 ?? 0);
  const arcNouveau = estArcEnCiel(S.getUser()) && localStorage.getItem('stroop-arc-recap') !== today();
  if (arcNouveau) { localStorage.setItem('stroop-arc-recap', today()); setTimeout(() => son('sport'), 300); }
  $app.innerHTML = `<section class="recap c-${r.matiere.couleur}">
    ${r.kind === 'nuit' ? `<div class="stroop-zone"><div class="bubble"><span class="who">Stroop</span>Ton cerveau continue le travail pendant que tu dors. Moi aussi, je vais faire dodo… Zzz</div>${stroopImg('dodo')}</div>` : arcNouveau ? `<div class="stroop-zone"><div class="bubble"><span class="who">Stroop</span>Et de ${NB_ARC()} ! Toutes tes matières dans la même journée : journée arc-en-ciel 🌈</div>${stroopImg('arcenciel')}</div>` : `<div class="stroop-zone"><div class="bubble"><span class="who">Stroop</span>${n ? (ok / n >= 0.8 ? 'Wahou, quelle forme ! Je fais la fête.' : ok / n >= 0.5 ? 'Beau travail, ça rentre !' : 'Chaque erreur d’aujourd’hui, c’est une réussite de demain.') : 'On se refait ça bientôt ?'}</div>${stroopImg(n && ok / n < 0.5 ? 'etude' : 'fete')}</div>`}
    <h1>${titles[r.kind] || titles.normal}</h1>
    <div class="stats">
      <div class="stat"><b>${n}</b><span>réponses</span></div>
      <div class="stat"><b>${n ? pct(Math.round((ok / n) * 100)) : '–'}</b><span>réussite</span></div>
      <div class="stat"><b>${up}</b><span>${up > 1 ? 'montées' : 'montée'} de boîte</span></div>
    </div>
    ${r.m0 !== undefined ? `<div class="chip m">Maîtrise ${esc(r.code)} : ${pct(r.m0)} → ${pct(r.m1)}${gain > 0 ? ` (+${gain})` : ''}</div>` : ''}
    ${practice ? `<p class="muted small" style="margin:0">${plural(practice, 'carte révisée', 'cartes révisées')} en avance : ${practice > 1 ? 'c’était de l’entraînement, leurs boîtes ne bougent pas' : 'c’était de l’entraînement, sa boîte ne bouge pas'}.</p>` : ''}
    ${r.matiere.negatif ? `<div class="chip m">Score avec points négatifs : ${r.score}</div>` : ''}
    ${down ? `<p class="muted small" style="margin:0">${plural(down, 'question')} ${down > 1 ? 'sont redescendues' : 'est redescendue'} en boîte 1 : ${down > 1 ? 'elles reviendront' : 'elle reviendra'} vite.</p>` : ''}
    <div class="actions" style="width:100%">
      ${errs.length ? `<button class="btn soft block" id="again">${ic('redo')}Revoir mes ${plural(errs.length, 'erreur')}</button>` : ''}
      <a class="btn primary block" href="#/matiere/${encodeURIComponent(r.code)}">Retour à ${esc(r.code)}</a>
      <a class="btn plain block" href="#/">Accueil</a>
    </div></section>`;
  document.getElementById('again')?.addEventListener('click', () => {
    clearSaved();
    session = { code: r.code, kind: 'erreurs', ids: shuffle(errs), base: errs, i: 0, started: Date.now(), endsAt: null, chrono: false, results: [], score: 0, m0: r.m1 };
    saveSession(); go('#/session');
  });
}

/* ================= Progrès ================= */
async function viewProgres() {
  tabbar('#/progres'); setHalo(null);
  const u = S.getUser();
  const s = streak(u.jours);
  const keys = Object.keys(u.jours).sort();
  // séries : actuelle (depuis quand) et meilleure (du… au…)
  let best = 0, cur = 0, prev = null, bestStart = null, bestEnd = null, runStart = null;
  for (const k of keys) {
    if (!u.jours[k]) continue;
    const dd = new Date(k);
    if (prev && Math.round((dd - prev) / 86400000) === 1) cur++; else { cur = 1; runStart = k; }
    if (cur >= best) { best = cur; bestStart = runStart; bestEnd = k; }
    prev = dd;
  }
  const temps = u.temps || {};
  const totalRep = keys.reduce((a, k) => a + (u.jours[k] || 0), 0);
  const joursTravailles = keys.filter((k) => u.jours[k]).length;
  const joursArc = Object.keys(u.joursM || {}).filter((k) => estArcEnCiel(u, k)).length;
  const totalMin = Math.round(Object.values(temps).reduce((a, v) => a + v, 0) / 60);
  const all = await Promise.all(S.matieres().map(matiereStats));
  const avec = all.filter((x) => x.contenu);
  const couleurOf = Object.fromEntries(S.matieres().map((m) => [m.code, m.couleur]));
  const fmtD = (k) => new Date(k).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

  // ----- Mémoire -----
  let bonnes = 0, fausses = 0; const boites = [0, 0, 0, 0, 0, 0];
  const notions = [];
  for (const x of avec) {
    for (const it of x.items) {
      const p = x.prog[it.id]; if (!p) continue;
      bonnes += p.ok ?? (p.box && !p.err ? 1 : 0); fausses += p.ko ?? (p.err ? 1 : 0);
      if (p.box) boites[p.box]++;
    }
    for (const n of notionStats(x.items, x.prog).notions) if (n.vus) notions.push({ ...n, code: x.m.code, couleur: x.m.couleur });
  }
  const reussite = bonnes + fausses ? Math.round((bonnes / (bonnes + fausses)) * 100) : null;
  const gravees = boites[4] + boites[5], consol = boites[3], appr = boites[1] + boites[2], enMemoire = gravees + consol + appr;
  const forts = notions.filter((n) => n.statut === 'maitrisee').sort((a, b) => b.score - a.score || b.vus - a.vus).slice(0, 5);
  const faibles = notions.filter((n) => n.statut === 'revoir' || n.score < 0.5).sort((a, b) => (a.statut === 'revoir' ? 0 : 1) - (b.statut === 'revoir' ? 0 : 1) || a.score - b.score || b.vus - a.vus).slice(0, 5);

  // ----- Rythme -----
  const jour = (dec) => { const d = new Date(); d.setDate(d.getDate() - dec); return today(d); };
  const j30 = Array.from({ length: 30 }, (_, i) => jour(29 - i));
  const lundi = (dec) => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - dec * 7); return d; };
  const semaine = (dec) => { const d0 = lundi(dec); return Array.from({ length: 7 }, (_, i) => { const d = new Date(d0); d.setDate(d0.getDate() + i); return today(d); }); };
  const somme = (ks, f) => ks.reduce((a, k) => a + f(k), 0);
  const cette = semaine(0), derniere = semaine(1);
  const sem = (ks) => ({ rep: somme(ks, (k) => u.jours[k] || 0), min: Math.round(somme(ks, (k) => temps[k] || 0) / 60), jours: ks.filter((k) => u.jours[k]).length });
  const S0 = sem(cette), S1 = sem(derniere);
  const evo = (a, b) => (!b ? (a ? '<span class="evo up">nouveau</span>' : '') : `<span class="evo ${a >= b ? 'up' : 'down'}">${a >= b ? '▲' : '▼'} ${Math.abs(Math.round(((a - b) / b) * 100))} %</span>`);
  const meilleurJour = keys.reduce((m, k) => ((u.jours[k] || 0) > (u.jours[m] || 0) ? k : m), keys[0]);
  const plusLong = Object.keys(temps).reduce((m, k) => ((temps[k] || 0) > (temps[m] || 0) ? k : m), Object.keys(temps)[0]);
  let mode = 'rep';
  const graphe = () => {
    const val = (k) => (mode === 'rep' ? u.jours[k] || 0 : Math.round((temps[k] || 0) / 60));
    const max = Math.max(1, ...j30.map(val));
    const W = 300, H = 110, bw = W / 30;
    const barres = j30.map((k, i) => {
      const v = val(k), h = v ? Math.max(3, (v / max) * (H - 18)) : 0;
      const jm = u.joursM?.[k]; const top = jm ? Object.entries(jm).sort((a, b) => b[1] - a[1])[0][0] : null;
      const col = top && couleurOf[top] ? `var(--${couleurOf[top]}-acc)` : 'var(--muted)';
      return `<g class="ry-b" data-i="${i}"><rect x="${i * bw + 1.5}" y="${H - h}" width="${bw - 3}" height="${h}" rx="3" fill="${v ? col : 'var(--ghost)'}"/>${v ? '' : `<rect x="${i * bw + 1.5}" y="${H - 3}" width="${bw - 3}" height="3" rx="1.5" fill="var(--ghost)"/>`}</g>`;
    }).join('');
    const etiq = [0, 10, 20, 29].map((i) => `<text x="${i === 29 ? W : i === 0 ? 0 : i * bw + bw / 2}" y="${H + 13}" text-anchor="${i === 29 ? 'end' : i === 0 ? 'start' : 'middle'}" font-size="9" fill="var(--muted)">${new Date(j30[i]).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</text>`).join('');
    return `<svg viewBox="0 0 ${W} ${H + 16}" width="100%" role="img" aria-label="${mode === 'rep' ? 'Réponses' : 'Temps de révision'} des 30 derniers jours. Touche une barre pour voir le détail du jour."><text x="0" y="9" font-size="9" fill="var(--muted)">max ${mode === 'rep' ? max : fmtMin(max)}</text><rect class="ry-guide" x="0" y="0" width="${bw}" height="${H}" rx="4"/>${barres}${etiq}</svg>`;
  };

  $app.innerHTML = `<div class="between"><h1>Progrès</h1>${stroopImg(joursArc ? 'arcenciel' : 'etude', 'prog')}</div>
    <div class="stats">
      <button class="stat" data-stat><b>${totalMin ? fmtMin(totalMin) : '0 min'}</b><span>de révision</span></button>
      <button class="stat" data-stat><b>${bonnes}</b><span>${bonnes > 1 ? 'bonnes réponses' : 'bonne réponse'}</span></button>
      <button class="stat" data-stat><b>${s}</b><span>${s > 1 ? 'jours d’affilée' : 'jour d’affilée'}</span></button>
    </div>

    <h2 class="section-title">Ton rythme</h2>
    <div class="card" style="padding:14px;display:flex;flex-direction:column;gap:10px">
      <div class="between"><b style="white-space:nowrap">30 jours</b><div class="seg rseg" style="width:auto"><button data-mode="rep" aria-pressed="true" style="padding:0 12px">Réponses</button><button data-mode="min" aria-pressed="false" style="padding:0 12px">Temps</button></div></div>
      <div class="ry-info" id="ryInfo" aria-live="polite"></div>
      <div id="graphe" class="ry-graphe">${graphe()}</div>
      ${avec.length ? `<div class="nlegend small">${avec.map((x) => `<span><span class="ndot" style="background:var(--${x.m.couleur}-acc)"></span>${esc(x.m.code)}</span>`).join('')}</div>` : ''}
    </div>
    <div class="card" style="padding:14px;display:flex;flex-direction:column;gap:8px">
      <b>Cette semaine</b><span class="small muted" style="margin-top:-6px">par rapport à la semaine dernière</span>
      <div class="cmp"><span>Réponses</span><b>${S0.rep}</b>${evo(S0.rep, S1.rep)}</div>
      <div class="cmp"><span>Temps</span><b>${fmtMin(S0.min)}</b>${evo(S0.min, S1.min)}</div>
      <div class="cmp"><span>Jours révisés</span><b>${S0.jours}/7</b><span class="small muted">${S1.jours}/7 avant</span></div>
    </div>
    <div class="records">
      <div class="card rec"><span class="small muted">Meilleure journée</span><b>${meilleurJour && u.jours[meilleurJour] ? plural(u.jours[meilleurJour], 'réponse') : '–'}</b><span class="small muted">${meilleurJour && u.jours[meilleurJour] ? fmtD(meilleurJour) : ''}</span></div>
      <div class="card rec"><span class="small muted">Plus longue séance</span><b>${plusLong && temps[plusLong] ? fmtMin(Math.round(temps[plusLong] / 60)) : '–'}</b><span class="small muted">${plusLong && temps[plusLong] ? fmtD(plusLong) : ''}</span></div>
      <div class="card rec"><span class="small muted">Meilleure série</span><b>${plural(best, 'jour')}</b><span class="small muted">${best > 1 && bestStart ? `du ${fmtD(bestStart)}` : ''}</span></div>
    </div>

    <h2 class="section-title">Ta mémoire</h2>
    <div class="card" style="padding:14px;display:flex;flex-direction:column;gap:10px">
      <div><b class="title" style="font-size:30px">${gravees}</b> <span class="small muted">${gravees > 1 ? 'cartes gravées' : 'carte gravée'}</span></div>${reussite != null ? `<span class="chip" style="align-self:flex-start">${reussite} % de bonnes réponses</span>` : ''}
      <span class="small muted" style="margin-top:-6px">Cartes en boîte 4 ou 5 : revues plusieurs fois avec succès, à des jours d’écart. Elles sont ancrées dans ta mémoire à long terme.</span>
      ${enMemoire ? `<div class="pile"><span style="flex:${appr};background:var(--ghost)"></span><span style="flex:${consol};background:#9DB8F0"></span><span style="flex:${gravees};background:#4F7FE0"></span></div>
      <div class="nlegend small"><span><span class="ndot" style="background:var(--ghost);box-shadow:inset 0 0 0 1.5px var(--line)"></span>En apprentissage · ${appr}</span><span><span class="ndot" style="background:#9DB8F0"></span>En consolidation · ${consol}</span><span><span class="ndot" style="background:#4F7FE0"></span>Gravées · ${gravees}</span></div>` : '<span class="small muted">Réponds à quelques questions pour voir ta mémoire se remplir.</span>'}
    </div>
    ${forts.length || faibles.length ? `<div class="card" style="padding:14px;display:flex;flex-direction:column;gap:8px">
      ${forts.length ? `<b>Tes points forts</b>${forts.map((n) => `<div class="nrow"><span class="chip m c-${n.couleur} sm">${esc(n.code)}</span><span class="small" style="flex:1">${esc(n.nom)}</span><span class="small muted">${Math.round(n.score * 100)} %</span></div>`).join('')}` : ''}
      ${faibles.length ? `<b style="margin-top:6px">À retravailler</b>${faibles.map((n, i) => `<div class="nrow"><span class="chip m c-${n.couleur} sm">${esc(n.code)}</span><span class="small" style="flex:1">${esc(n.nom)}</span><button class="btn soft sm" data-faible="${i}">Réviser</button></div>`).join('')}` : ''}
    </div>` : ''}

    <h2 class="section-title">Par matière</h2>
    <div class="list">${avec.map((x) => `
      <a class="card c-${x.m.couleur}" href="#/matiere/${encodeURIComponent(x.m.code)}" style="padding:14px;display:flex;flex-direction:column;gap:8px;text-decoration:none">
        <div class="between"><b class="title" style="color:var(--m-ink)">${esc(x.m.code)}</b><b>${pct(x.maitrise)}</b></div>
        <span class="bar"><span style="width:${x.maitrise}%"></span></span>
        <span class="small muted">Vu : ${x.vus}/${x.total} · ${x.due} à revoir · ${plural(x.erreurs, 'erreur')} en attente</span>
      </a>`).join('') || '<div class="card empty muted">Rien pour l’instant : importe du contenu pour commencer.</div>'}</div>`;

  // Détail d'un jour, comme l'app Santé : toucher une barre, puis glisser le doigt pour passer d'un jour à l'autre.
  let sel = null;
  const gEl = document.getElementById('graphe'), info = document.getElementById('ryInfo');
  const minDe = (k) => (temps[k] || 0) / 60;
  const tps = (k) => { const m = minDe(k); return !m ? '0 min' : m < 1 ? 'moins d’1 min' : fmtMin(m); };
  const infoDefaut = () => {
    const actifs = j30.filter((k) => u.jours[k] || temps[k]);
    const totM = somme(j30, minDe), totR = somme(j30, (k) => u.jours[k] || 0);
    return `<span class="ry-k">Sur 30 jours</span><span class="ry-v"><b>${fmtMin(totM)}</b> · ${plural(totR, 'réponse')}</span><span class="ry-s">${actifs.length ? `en moyenne ${fmtMin(totM / actifs.length)} les jours où tu révises` : 'Touche une barre pour voir le détail d’un jour'}</span>`;
  };
  const infoJour = (k) => {
    const jm = u.joursM?.[k] || {};
    const mats = Object.entries(jm).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
    const d = new Date(k).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    return `<span class="ry-k">${esc(k === today() ? 'Aujourd’hui' : d.charAt(0).toUpperCase() + d.slice(1))}</span><span class="ry-v"><b>${tps(k)}</b> · ${plural(u.jours[k] || 0, 'réponse')}</span><span class="ry-s">${mats.length ? mats.map(([c, n]) => `<span class="ry-m"><span class="ndot" style="background:var(--${couleurOf[c] || 'muted'}-acc)"></span>${esc(c)} · ${n}</span>`).join('') : 'Pas de révision ce jour-là'}</span>`;
  };
  const montrer = () => {
    info.innerHTML = sel === null ? infoDefaut() : infoJour(j30[sel]);
    info.classList.toggle('on', sel !== null);
    const svg = gEl.querySelector('svg'); if (!svg) return;
    svg.classList.toggle('ry-sel', sel !== null);
    svg.querySelectorAll('.ry-b').forEach((g) => g.classList.toggle('on', Number(g.dataset.i) === sel));
    const gd = svg.querySelector('.ry-guide'); if (gd && sel !== null) gd.setAttribute('x', String(sel * (300 / 30)));
  };
  const indexAt = (x) => { const r = gEl.querySelector('svg').getBoundingClientRect(); return Math.min(29, Math.max(0, Math.floor(((x - r.left) / r.width) * 30))); };
  const choisir = (i) => { if (i === sel) return; sel = i; montrer(); navigator.vibrate?.(6); };
  let appui = false, depart = null;
  gEl.addEventListener('pointerdown', (e) => { appui = true; depart = sel; gEl.setPointerCapture?.(e.pointerId); choisir(indexAt(e.clientX)); });
  gEl.addEventListener('pointermove', (e) => { if (appui) choisir(indexAt(e.clientX)); });
  const fin = (e) => { if (!appui) return; appui = false; if (e.type === 'pointerup' && depart === sel && depart !== null && !gEl._bouge) { sel = null; montrer(); } gEl._bouge = false; };
  gEl.addEventListener('pointermove', () => { if (appui) gEl._bouge = true; });
  gEl.addEventListener('pointerup', fin); gEl.addEventListener('pointercancel', fin);
  document.removeEventListener('pointerdown', window._ryOut);
  window._ryOut = (e) => { if (sel !== null && gEl.isConnected && !gEl.contains(e.target) && !e.target.closest('[data-mode]')) { sel = null; montrer(); } };
  document.addEventListener('pointerdown', window._ryOut);
  montrer();
  $app.querySelectorAll('[data-mode]').forEach((b) => b.onclick = () => { mode = b.dataset.mode; $app.querySelectorAll('[data-mode]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); gEl.innerHTML = graphe(); montrer(); });
  $app.querySelectorAll('[data-faible]').forEach((b) => b.onclick = () => { const n = faibles[Number(b.dataset.faible)]; startSession({ code: n.code, kind: 'notion', ids: n.ids, titre: n.nom }); });
  $app.querySelectorAll('[data-stat]').forEach((b) => b.onclick = () => openSheet(`
    <div class="between"><h2>Tes chiffres</h2><button class="icon-btn" data-close aria-label="Fermer">${ic('close')}</button></div>
    <ul class="list" style="list-style:none;margin:0;padding:0;gap:12px">
      <li><b>${totalMin ? fmtMin(totalMin) : '0 min'} de révision</b><br><span class="small muted">Temps passé sur les questions depuis le 13 novembre, sur ${plural(joursTravailles, 'jour')} de révision.</span></li>
      <li><b>${plural(bonnes, 'bonne réponse', 'bonnes réponses')}</b><br><span class="small muted">Sur ${plural(totalRep, 'réponse')} au total${reussite != null ? `, soit ${reussite} % de réussite` : ''}.</span></li>
      <li><b>Série actuelle : ${plural(s, 'jour')}</b><br><span class="small muted">${s ? `Tu révises chaque jour depuis le ${fmtD(runStart)}. Une réponse dans la journée suffit à la prolonger.` : 'Réponds à une question aujourd’hui pour lancer une série.'}</span></li>
      <li><b>Meilleure série : ${plural(best, 'jour')}</b><br><span class="small muted">${best && bestStart ? (best > 1 ? `Du ${fmtD(bestStart)} au ${fmtD(bestEnd)}.` : `Le ${fmtD(bestEnd)}.`) : 'Pas encore de série.'}</span></li>
      <li><b>${plural(joursArc, 'journée arc-en-ciel', 'journées arc-en-ciel')} 🌈</b><br><span class="small muted">${joursArc ? 'Les jours où tu as révisé tes' : 'Révise tes'} ${NB_ARC()} matières dans la même journée${joursArc ? '.' : ' pour débloquer Stroop arc-en-ciel.'}</span></li>
    </ul>
    <button class="btn primary block" data-close>OK</button>`));
}

/* ================= Notifications ================= */
function notifCard() {
  const e = N.etat(), n = S.getNotif();
  const msg = {
    bientot: 'Les rappels arrivent bientôt : ils ne sont pas encore branchés.',
    installer: 'Sur iPhone, les rappels ne fonctionnent que si tu ouvres l’appli depuis son icône sur l’écran d’accueil (Partager → Sur l’écran d’accueil).',
    impossible: 'Ce navigateur ne permet pas les notifications.',
    refuse: 'Les notifications sont bloquées pour l’appli. Pour les réactiver : Réglages de l’iPhone → Notifications → Stroop Study.'
  }[e];
  const on = e === 'actif';
  return `<div class="card" style="padding:16px;display:flex;flex-direction:column;gap:12px">
    <div class="between"><h2 class="section-title">Activer les rappels</h2>${msg ? '' : `<label class="tgl"><input type="checkbox" id="notifOn" ${on ? 'checked' : ''}><span></span><b class="sr">Activer les rappels</b></label>`}</div>
    ${msg ? `<p class="muted small" style="margin:0">${msg}</p>` : `
    <p class="muted small" style="margin:0">Jamais plus de 2 par jour, et seulement si tu n’as pas encore révisé.</p>
    <div class="list" style="gap:10px;${on ? '' : 'opacity:.5;pointer-events:none'}">
      <label class="nrow"><input type="checkbox" data-np="rappel" ${n.rappel ? 'checked' : ''}><span><b>Rappel du jour</b><br><span class="small muted">En semaine, et tous les jours dans les 2 semaines avant un examen</span></span><input type="time" id="nh" value="${esc(n.heure)}"></label>
      <label class="nrow"><input type="checkbox" data-np="serie" ${n.serie ? 'checked' : ''}><span><b>Série en danger</b><br><span class="small muted">Si ta série dure depuis 3 jours ou plus</span></span><input type="time" id="ns" value="${esc(n.soir)}"></label>
      <label class="nrow"><input type="checkbox" data-np="examens" ${n.examens ? 'checked' : ''}><span><b>Compte à rebours</b><br><span class="small muted">J-14, J-7, J-3 et J-1 avant un examen (dates à saisir dans chaque matière)</span></span></label>
    </div>`}
  </div>`;
}
function bindNotifCard() {
  const t = document.getElementById('notifOn');
  if (t) t.onchange = async () => {
    try {
      if (t.checked) { const ok = await N.activer(); toast(ok ? 'Rappels activés' : 'Rappels non autorisés'); }
      else { await N.desactiver(); toast('Rappels désactivés'); }
    } catch (e) { console.error(e); toast('Impossible d’activer les rappels pour l’instant'); }
    viewProfil('rappels');
  };
  $app.querySelectorAll('[data-np]').forEach((c) => c.onchange = () => S.saveNotif({ [c.dataset.np]: c.checked }));
  const nh = document.getElementById('nh'); if (nh) nh.onchange = () => S.saveNotif({ heure: nh.value || '09:30' }).then(() => toast('Heure enregistrée'));
  const ns = document.getElementById('ns'); if (ns) ns.onchange = () => S.saveNotif({ soir: ns.value || '18:30' }).then(() => toast('Heure enregistrée'));
}
function inviteNotif() {
  const sh = openSheet(`
    <div style="display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center">
      <img class="stroop" src="assets/stroop/stroop-contente.webp" alt="" style="width:110px;height:110px">
      <h2>Je te fais signe ?</h2>
      <p style="margin:0">Un petit rappel le matin en semaine si tu n’as pas encore révisé, un message si ta série est en danger, et un compte à rebours avant tes examens.</p>
      <p class="muted small" style="margin:0">Jamais plus de 2 par jour. Tu pourras tout régler dans Profil.</p>
    </div>
    <button class="btn primary block" id="nYes">Activer les rappels</button>
    <button class="flag-btn" data-close style="align-self:center">Plus tard</button>`);
  N.reporter();
  sh.back.querySelector('#nYes').onclick = async () => {
    try { const ok = await N.activer(); toast(ok ? 'Rappels activés' : 'Rappels non autorisés'); } catch (e) { console.error(e); toast('Impossible d’activer les rappels pour l’instant'); }
    sh.close();
  };
}

/* ================= Profil ================= */
const PROFIL_SECTIONS = [
  { id: 'compte', icon: 'user', titre: 'Mon compte', sous: 'Prénom, semestre, déconnexion' },
  { id: 'rappels', icon: 'bell', titre: 'Rappels', sous: 'Heures et types' },
  { id: 'affichage', icon: 'sun', titre: 'Apparence et sons', sous: 'Thème, sons, volume' },
  { id: 'bibliotheque', icon: 'books', titre: 'Bibliothèque', sous: 'Contenus partagés' , admin: 'Importer du contenu, invité·es' },
  { id: 'signalements', icon: 'flag', titre: 'Signalements', sous: 'Questions à corriger' },
  { id: 'testeurs', icon: 'chart', titre: 'Testeur·ses', sous: 'Statistiques des invité·es', adminSeul: true },
  { id: 'aide', icon: 'help', titre: 'Aide', sous: 'Leitner, maîtrise, version' },
  { id: 'donnees', icon: 'download', titre: 'Mes données', sous: 'Exporter' }
];

// ---- Statistiques des testeur·ses (admin) : par personne, puis par question, tous comptes confondus.
const duree = (s) => { const m = Math.round((s || 0) / 60); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`; };
const somme = (o) => Object.values(o || {}).reduce((a, b) => a + (Number(b) || 0), 0);
function dateCourte(j) { if (!j) return '—'; const [a, m, d] = j.split('-').map(Number); const n = Math.round((new Date(today()) - new Date(a, m - 1, d)) / 864e5); return n <= 0 ? 'aujourd’hui' : n === 1 ? 'hier' : `il y a ${n} j`; }
async function testeursHtml(stats) {
  if (stats === null) return `<div class="card" style="padding:16px;display:flex;flex-direction:column;gap:12px"><p class="muted small" style="margin:0">Pour voir les statistiques, mets à jour les règles Firebase une fois : copie-les, colle-les dans Firebase (<b>Firestore → Règles</b>) et clique sur <b>Publier</b>.</p><button class="btn plain block" id="copyrules">${ic('copy')}Copier les règles</button></div>`;
  const pers = stats.map((u) => {
    let vus = 0, ok = 0; const mats = [];
    for (const [code, items] of Object.entries(u.progres)) { let n = 0; for (const p of Object.values(items)) { vus += p.seen || 0; ok += p.ok || 0; n += p.seen || 0; } if (n) mats.push(code); }
    const jours = Object.keys(u.jours || {}).filter((j) => u.jours[j] > 0).sort();
    return { nom: u.moi ? `${u.prenom || 'Toi'} (toi)` : u.prenom || u.email || 'Sans prénom', email: u.email || '', moi: u.moi, vus, ok, mats, actifs: jours.length, dernier: jours[jours.length - 1] || '', temps: somme(u.temps) };
  }).sort((a, b) => (b.dernier || '').localeCompare(a.dernier || '') || b.vus - a.vus);
  const autres = pers.filter((p) => !p.moi);
  const il7 = today(new Date(Date.now() - 6 * 864e5));
  const actifs7 = autres.filter((p) => p.dernier && p.dernier >= il7).length;
  // Par question : toutes les réponses, tous comptes confondus (anonyme).
  const parQ = {}, parM = {};
  for (const u of stats) for (const [code, items] of Object.entries(u.progres)) for (const [id, p] of Object.entries(items)) {
    if (!p.seen) continue;
    const q = (parQ[code + '|' + id] = parQ[code + '|' + id] || { code, id, pers: 0, seen: 0, ko: 0 }); q.pers++; q.seen += p.seen || 0; q.ko += p.ko || 0;
    const m = (parM[code] = parM[code] || { seen: 0, ok: 0, pers: new Set() }); m.seen += p.seen || 0; m.ok += p.ok || 0; m.pers.add(u.uid);
  }
  const labels = {};
  for (const code of new Set(Object.values(parQ).map((q) => q.code))) { const c = await S.getContenu(code); if (c) for (const it of S.flatItems(c)) labels[code + '|' + it.id] = it; }
  const ratees = Object.values(parQ).filter((q) => q.pers >= 2 && q.seen >= 3 && labels[q.code + '|' + q.id]).map((q) => ({ ...q, taux: q.ko / q.seen })).sort((a, b) => b.taux - a.taux || b.seen - a.seen).slice(0, 15);
  const pc = (x) => `${Math.round(x * 100)} %`;
  const card = (h) => `<div class="card" style="padding:16px;display:flex;flex-direction:column;gap:12px">${h}</div>`;
  return card(`<h2 class="section-title">Vue d’ensemble</h2>
      <div class="between"><span class="small">Testeur·ses inscrit·es</span><b>${autres.length}</b></div>
      <div class="between"><span class="small">Actif·ves ces 7 derniers jours</span><b>${actifs7}</b></div>
      <div class="between"><span class="small">Réponses données (hors toi)</span><b>${autres.reduce((a, p) => a + p.vus, 0)}</b></div>
      <div class="between"><span class="small">Temps passé (hors toi)</span><b>${duree(autres.reduce((a, p) => a + p.temps, 0))}</b></div>`)
    + card(`<h2 class="section-title">Par personne</h2>${pers.length ? `<div class="list">${pers.map((p) => `<div style="display:flex;flex-direction:column;gap:2px;padding:8px 0;border-bottom:1px solid var(--line)"><div class="between"><b class="small">${esc(p.nom)}</b><span class="small muted">${esc(dateCourte(p.dernier))}</span></div><span class="small muted">${p.actifs} jour${p.actifs > 1 ? 's' : ''} · ${duree(p.temps)} · ${p.vus} réponse${p.vus > 1 ? 's' : ''}${p.vus ? ` · ${pc(p.ok / p.vus)} de réussite` : ''}</span>${p.mats.length ? `<span class="small muted">${esc(p.mats.join(', '))}</span>` : ''}${p.email && !p.moi ? `<span class="small muted" style="overflow:hidden;text-overflow:ellipsis">${esc(p.email)}</span>` : ''}</div>`).join('')}</div>` : '<p class="muted small" style="margin:0">Personne pour l’instant.</p>'}
      <p class="muted small" style="margin:0">Les comptes créés avant la version 2.17 n’affichent leur adresse qu’après leur prochaine ouverture de l’appli.</p>`)
    + card(`<h2 class="section-title">Par matière</h2>${Object.keys(parM).length ? Object.entries(parM).sort().map(([code, m]) => `<div class="between"><span class="small"><b>${esc(code)}</b> · ${m.pers.size} personne${m.pers.size > 1 ? 's' : ''}</span><span class="small">${m.seen} rép. · ${pc(m.ok / m.seen)}</span></div>`).join('') : '<p class="muted small" style="margin:0">Aucune réponse pour l’instant.</p>'}`)
    + card(`<h2 class="section-title">Questions les plus ratées</h2><p class="muted small" style="margin:0">Tous les comptes, toi comprise ; questions vues par au moins 2 personnes. Une question très ratée est souvent mal posée.</p>${ratees.length ? `<div class="list">${ratees.map((q) => `<div style="display:flex;flex-direction:column;gap:2px;padding:8px 0;border-bottom:1px solid var(--line)"><div class="between"><b class="small">${esc(q.code)} · ${esc(q.id)}</b><b class="small" style="color:var(--koS)">${pc(q.taux)} d’erreurs</b></div><span class="small muted">${esc(itemLabel(labels[q.code + '|' + q.id]).slice(0, 140))}</span><span class="small muted">${q.pers} personnes · ${q.seen} réponses</span></div>`).join('')}</div>` : '<p class="muted small" style="margin:0">Pas encore assez de réponses.</p>'}`);
}

function versionsHtml() {
  const L = S.contenusImportes();
  if (!L.length) return '<p class="muted small" style="margin:0">Aucun contenu importé pour l’instant.</p>';
  const quand = (t) => `le ${new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} à ${new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} · `;
  return `<div class="list">${L.map((c) => `<div class="between"><div style="min-width:0"><b>${esc(c.code)}</b> <span class="small muted">${esc(c.nom)}</span><div class="small muted">${c.importeLe ? quand(c.importeLe) : ''}${plural(c.nbElements, 'question')}</div></div><span class="vtag">${c.revision ? `v${c.revision}` : '—'}</span></div>`).join('')}</div>
  <p class="muted small" style="margin:8px 0 0">Compare avec le nom du dernier fichier envoyé par Claude (PAT1_contenu_v5 → v5). « — » : importé avant le suivi des versions ; réimporte-le pour l’afficher.</p>`;
}

async function viewProfil(section) {
  tabbar('#/profil'); setHalo(null);
  const u = S.getUser();
  const theme = localStorage.getItem('theme') || 'auto';
  const flags = await S.allFlags();
  const flagsInv = S.isAdmin() ? await S.flagsInvites() : [];
  const testeurs = section === 'testeurs' && S.isAdmin() ? await testeursHtml(await S.statsTesteurs()) : '';
  const card = (html) => `<div class="card" style="padding:16px;display:flex;flex-direction:column;gap:12px">${html}</div>`;
  const etatRappels = { actif: 'Activés', inactif: 'Désactivés', bientot: 'Bientôt', installer: 'À installer', impossible: 'Indisponibles', refuse: 'Bloqués' }[N.etat()];
  const badge = { rappels: etatRappels, signalements: (flags.length + (flagsInv?.length || 0)) ? String(flags.length + (flagsInv?.length || 0)) : '', affichage: getSons().on ? '' : 'Sons coupés' };
  const SEC = {
    compte: card(`
      <label class="field">Prénom<input id="prenom" value="${esc(u.prenom || '')}" autocomplete="given-name"></label>
      <label class="field">Semestre en cours<input id="sem" value="${esc(u.semestre || '')}" placeholder="ex. L1-S2"></label>
      <p class="muted small" style="margin:0">Connecté·e avec ${esc(auth.currentUser?.email || '')}</p>`) + `<button class="btn no block" id="logout">Me déconnecter</button>`,
    rappels: notifCard(),
    affichage: card(`<div class="field">Apparence<div class="seg" role="group">${[['auto', 'Auto'], ['clair', 'Clair'], ['sombre', 'Sombre']].map(([k, l]) => `<button data-th="${k}" aria-pressed="${theme === k}">${l}</button>`).join('')}</div></div>`) + card(`
      <div class="between"><h2 class="section-title">Sons</h2><label class="tgl"><input type="checkbox" id="sonOn" ${getSons().on ? 'checked' : ''}><span></span><b class="sr">Activer les sons</b></label></div>
      <div class="row" style="gap:12px;${getSons().on ? '' : 'opacity:.5'}"><span class="small muted">Volume</span><input type="range" id="sonVol" min="0" max="100" step="5" value="${Math.round(getSons().vol * 100)}" style="flex:1"><button class="flag-btn" id="sonTest">Écouter</button></div>
      <label class="switch" style="${getSons().on ? '' : 'opacity:.5'}"><input type="checkbox" id="sonSil" ${getSons().silencieux ? 'checked' : ''}><span><b>Même en mode silencieux</b><span class="small muted" style="display:block">Sur iPhone, les sons passent même quand le téléphone est en silencieux (la musique en cours baisse un instant).</span></span></label>
      <p class="muted small" style="margin:0">Sur iPhone, les sons suivent le bouton silencieux.</p>`),
    bibliotheque: S.isAdmin() ? card(`
      <h2 class="section-title">Importer du contenu</h2>
      <p class="muted small" style="margin:0">Dépose les fichiers .json que Claude t’a préparés. Si une matière existe déjà, son contenu est remplacé et la progression de chacun·e est conservée.</p>
      <div id="drop" class="dropzone">
        ${ic('upload')}
        <b>Glisse tes fichiers .json ici</b>
        <span class="small muted">ou</span>
        <label class="btn primary">Choisir des fichiers<input type="file" id="file" accept=".json,application/json" multiple class="sr"></label>
      </div>
      <div id="imp" class="list"></div>`) + card(`
      <h2 class="section-title">Versions importées</h2>
      <div id="vers">${versionsHtml()}</div>`) + card(`
      <h2 class="section-title">Invité·es · ${(S.getAcces()?.membres || []).length}</h2>
      <p class="muted small" style="margin:0">Ces personnes voient la même bibliothèque que toi, avec leur propre progression. Elles doivent se connecter avec cette adresse.</p>
      <div class="list">${(S.getAcces()?.membres || []).map((e) => `<div class="between"><span>${esc(e)}</span><button class="flag-btn" data-rm="${esc(e)}">Retirer</button></div>`).join('')}</div>
      <form id="inv" class="row"><label class="sr" for="invmail">Adresse e-mail</label><input id="invmail" type="email" placeholder="adresse@gmail.com" style="flex:1;border:2px solid var(--line);background:var(--card);border-radius:14px;padding:12px 14px;font-size:16px;min-width:0"><button class="btn primary" type="submit">Inviter</button></form>`)
      : card(`<p class="muted small" style="margin:0">${S.libOk() ? 'Tu as accès au contenu commun. Ta progression n’appartient qu’à toi.' : `Tu n’as pas encore accès au contenu commun. Donne cette adresse à l’admin : <b>${esc(auth.currentUser?.email || '')}</b>`}</p>`),
    signalements: card(`<h2 class="section-title">Mes signalements</h2>${flags.length ? `<div class="list">${flags.map((f) => `<div class="between" style="align-items:flex-start"><div><b class="small">${esc(f.matiere)} · ${esc(f.item.id)}</b><div class="small muted">${esc(itemLabel(f.item))}</div>${f.flag.note ? `<div class="small">« ${esc(f.flag.note)} »</div>` : ''}</div><button class="flag-btn" data-unflag="${esc(f.matiere)}|${esc(f.item.id)}">Retirer</button></div>`).join('')}</div>` : '<p class="muted small" style="margin:0">Aucun signalement. Pendant une session, touche « Signaler » sous une question qui te semble fausse ou mal posée.</p>'}`)
      + (S.isAdmin() ? card(`<h2 class="section-title">Signalements des invité·es</h2>${flagsInv === null ? `<p class="muted small" style="margin:0">Pour les voir, mets à jour les règles Firebase une fois : copie-les, puis colle-les dans Firebase (<b>Firestore → Règles</b>) et clique sur <b>Publier</b>.</p><button class="btn plain block" id="copyrules">${ic('copy')}Copier les règles</button>` : flagsInv.length ? `<div class="list">${flagsInv.map((f) => `<div class="between" style="align-items:flex-start"><div><b class="small">${esc(f.code)} · ${esc(f.item)}</b> <span class="small muted">par ${esc(f.prenom || f.email || 'un·e invité·e')}</span><div class="small muted">${esc(f.it ? itemLabel(f.it) : 'Question introuvable dans le contenu actuel')}</div>${f.note ? `<div class="small">« ${esc(f.note)} »</div>` : ''}</div><button class="flag-btn" data-unflaginv="${esc(f.sid)}">Retirer</button></div>`).join('')}</div>` : '<p class="muted small" style="margin:0">Aucun signalement de tes invité·es pour l’instant.</p>'}`) : '')
      + ((flags.length || flagsInv?.length) ? `<button class="btn plain block" id="copyflags">${ic('copy')}Copier tout pour Claude</button>` : ''),
    aide: `<button class="card cfg-card" id="laboE"><span><b>Labo écoute</b><span class="small muted" style="display:block">2 minutes de tests pour préparer le futur mode écoute</span></span>${ic('next')}</button>
    <button class="card cfg-card" id="instP"><span><b>Installer Stroop sur mon téléphone</b><span class="small muted" style="display:block">Le tuto iPhone et Android, à partager aussi</span></span>${ic('next')}</button>
      <button class="card cfg-card" id="tutoP"><span><b>Comment fonctionne la boîte de Leitner ?</b><span class="small muted" style="display:block">Le petit tuto des 5 boîtes</span></span>${ic('next')}</button>
      ${card(`<b>Et la maîtrise ?</b><p class="muted small" style="margin:0">Dans chaque matière, touche le cercle de maîtrise pour voir comment elle se calcule et la liste de tes notions.</p>`)}
      <p class="muted small" style="margin:0;text-align:center">Stroop Study · version ${VERSION}</p>`,
    testeurs: testeurs,
    donnees: card(`<p class="muted small" style="margin:0">Télécharge une copie de ta progression et de tes réglages (fichier .json).</p><button class="btn plain block" id="export">${ic('download')}Exporter mes données</button>`)
  };
  const sec = PROFIL_SECTIONS.find((x) => x.id === section && (!x.adminSeul || S.isAdmin()));
  if (sec) {
    $app.innerHTML = `<div class="row" style="gap:12px"><a class="icon-btn" href="#/profil" aria-label="Retour">${ic('back')}</a><h1 style="margin:0">${esc(sec.titre)}</h1></div>${SEC[sec.id]}`;
  } else {
    const initiale = (u.prenom || auth.currentUser?.email || '?').trim().charAt(0).toUpperCase();
    $app.innerHTML = `<h1>Profil</h1>
      <div class="card" style="padding:16px;display:flex;align-items:center;gap:14px">
        <span class="avatar">${esc(initiale)}</span>
        <span style="flex:1;min-width:0"><b style="font-size:18px">${esc(u.prenom || 'Toi')}</b><span class="small muted" style="display:block;overflow:hidden;text-overflow:ellipsis">${esc(u.semestre || '')} · ${esc(auth.currentUser?.email || '')}</span></span>
      </div>
      <div class="card menu">${PROFIL_SECTIONS.filter((x) => !x.adminSeul || S.isAdmin()).map((x) => `<a class="menu-row" href="#/profil/${x.id}"><span class="menu-ic">${ic(x.icon)}</span><span class="menu-txt"><b>${esc(x.titre)}</b><span class="small muted">${esc(S.isAdmin() && x.admin ? x.admin : x.sous)}</span></span>${badge[x.id] ? `<span class="menu-badge">${esc(badge[x.id])}</span>` : ''}${ic('next')}</a>`).join('')}</div>
      <p class="muted small" style="margin:0;text-align:center">version ${VERSION}</p>`;
    return;
  }
  bindNotifCard();
  const sonOn = document.getElementById('sonOn'); if (sonOn) sonOn.onchange = (e) => { setSons({ on: e.target.checked }); if (e.target.checked) son('ok'); viewProfil(section); };
  const sonSil = document.getElementById('sonSil'); if (sonSil) sonSil.onchange = (e) => { setSons({ silencieux: e.target.checked }); sessionAudio(); son('ok'); };
  const sonVol = document.getElementById('sonVol'); if (sonVol) sonVol.onchange = (e) => { setSons({ vol: Number(e.target.value) / 100 }); son('ok'); };
  const sonTest = document.getElementById('sonTest'); if (sonTest) sonTest.onclick = () => son('up');
  const prenom = document.getElementById('prenom'); if (prenom) prenom.onchange = (e) => S.saveUser({ prenom: e.target.value.trim() }).then(() => toast('Enregistré'));
  const sem = document.getElementById('sem'); if (sem) sem.onchange = (e) => S.saveUser({ semestre: e.target.value.trim() || 'L1-S1' }).then(() => toast('Enregistré'));
  $app.querySelectorAll('[data-th]').forEach((b) => b.onclick = () => { localStorage.setItem('theme', b.dataset.th); S.saveUser({ theme: b.dataset.th }); applyTheme(); viewProfil(section); });
  document.getElementById('inv')?.addEventListener('submit', async (e) => {
    e.preventDefault(); const v = document.getElementById('invmail').value.trim();
    if (!v || !v.includes('@')) return toast('Adresse e-mail invalide');
    await S.setMembres([...(S.getAcces()?.membres || []), v]); toast('Invitation enregistrée'); viewProfil(section);
  });
  $app.querySelectorAll('[data-rm]').forEach((b) => b.onclick = async () => { await S.setMembres((S.getAcces()?.membres || []).filter((x) => x !== b.dataset.rm)); viewProfil(section); });
  const fileIn = document.getElementById('file');
  const importFiles = async (files, forcer = false) => {
    const out = document.getElementById('imp');
    if (!forcer) out.innerHTML = '';
    for (const file of files) {
      try {
        if (!file.name.toLowerCase().endsWith('.json')) throw new Error('Ce n\u2019est pas un fichier .json.');
        const data = JSON.parse(await file.text());
        const info = await S.importContenu(data, file.name, { forcer }); son('ok');
        const vers = document.getElementById('vers'); if (vers) vers.innerHTML = versionsHtml();
        out.insertAdjacentHTML('beforeend', `<div class="feedback ok"><b>${esc(info.code)}${info.revision ? ` v${info.revision}` : ''} importé !</b>${plural(info.nbChapitres, 'chapitre')}, ${plural(info.nbElements, 'élément')}${info.glossaire ? `, ${plural(info.glossaire, 'terme')} de glossaire, ${plural(info.auteurs, 'auteur·rice', 'auteur·rices')}` : ''}. <a href="#/matiere/${encodeURIComponent(info.code)}">Voir ${esc(info.code)}</a></div>`);
      } catch (er) {
        const msg = er instanceof SyntaxError ? 'Le fichier est abîmé ou incomplet.' : er.message;
        if (er.ancienne) {
          const box = document.createElement('div'); box.className = 'feedback ko';
          box.innerHTML = `<b>${esc(file.name)} : version plus ancienne</b>${esc(msg)}<button class="btn plain sm" style="margin-top:8px">Importer quand même la v${er.ancienne.revision}</button>`;
          box.querySelector('button').onclick = () => { box.remove(); importFiles([file], true); };
          out.appendChild(box); son('ko');
        } else out.insertAdjacentHTML('beforeend', `<div class="feedback ko"><b>${esc(file.name)} : import impossible</b>${esc(msg)}</div>`);
      }
    }
  };
  if (fileIn) fileIn.onchange = async (e) => { await importFiles([...e.target.files]); e.target.value = ''; };
  const drop = document.getElementById('drop');
  if (drop) {
    ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'dragend'].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove('over')));
    drop.addEventListener('drop', async (e) => { e.preventDefault(); drop.classList.remove('over'); await importFiles([...(e.dataTransfer?.files || [])]); });
  }
  $app.querySelectorAll('[data-unflaginv]').forEach((b) => b.onclick = async () => { await S.retirerFlagInvite(b.dataset.unflaginv); viewProfil(section); });
  document.getElementById('copyrules')?.addEventListener('click', async () => {
    try { const r = (await (await fetch('firestore.rules', { cache: 'no-store' })).text()).split('ADMIN_UID').join(auth.currentUser.uid); await navigator.clipboard.writeText(r); toast('Règles copiées ! Colle-les dans Firebase'); } catch { toast('Copie impossible sur cet appareil'); }
  });
  $app.querySelectorAll('[data-unflag]').forEach((b) => b.onclick = async () => { const [c, id] = b.dataset.unflag.split('|'); await S.unflagItem(c, id); viewProfil(section); });
  document.getElementById('copyflags')?.addEventListener('click', async () => {
    const txt = 'Signalements de mon appli de révisions :\n\n' + flags.map((f) => `- ${f.matiere} · ${f.item.id} · « ${itemLabel(f.item)} »${f.flag.note ? ` → ${f.flag.note}` : ''}`).join('\n')
      + ((flagsInv || []).length ? '\n\nSignalements de mes invité·es :\n\n' + flagsInv.map((f) => `- ${f.code} · ${f.item}${f.it ? ` · « ${itemLabel(f.it)} »` : ''} (${f.prenom || f.email || 'invité·e'})${f.note ? ` → ${f.note}` : ''}`).join('\n') : '');
    try { await navigator.clipboard.writeText(txt); toast('Copié ! Colle-le dans ta conversation avec Claude'); } catch { toast('Copie impossible sur cet appareil'); }
  });
  const tutoP = document.getElementById('tutoP'); if (tutoP) tutoP.onclick = () => leitnerTuto(null);
  const instP = document.getElementById('instP'); if (instP) instP.onclick = () => installSheet();
  const laboE = document.getElementById('laboE'); if (laboE) laboE.onclick = () => laboEcoute();
  const exp = document.getElementById('export'); if (exp) exp.onclick = async () => {
    const data = await S.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `stroop-study-export-${today()}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const lo = document.getElementById('logout'); if (lo) lo.onclick = async () => { session = null; clearSaved(); await signOut(auth); };
}

/* ================= Démarrage ================= */
getRedirectResult(auth).catch((e) => { if (!auth.currentUser) viewLogin('google', authError(e)); });
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (!user) return viewLogin();
  $app.innerHTML = `<div class="splash">${stroopImg('etude')}<p>Stroop ouvre ses cahiers…</p></div>`;
  try {
    const u = await S.loadUser(user.uid, user.displayName, user.email);
    if (u.theme && !localStorage.getItem('theme')) { localStorage.setItem('theme', u.theme); applyTheme(); }
    await Promise.all([S.loadAcces(), S.loadLibrary()]);
    route();
    // Demande à iOS de ne pas effacer les données de l'appli (réponses pas encore envoyées, voix) en cas de place manquante.
    navigator.storage?.persist?.().catch(() => {});
  } catch (e) {
    console.error(e);
    if (String(e?.code || e?.message).includes('permission')) return viewSetup(user.uid);
    $app.innerHTML = `<div class="card empty"><p><b>Impossible de charger tes données.</b></p><p class="muted small">${esc(e.message)}</p><button class="btn plain" onclick="location.reload()">Réessayer</button></div>`;
  }
});

// Évite que le navigateur ouvre un fichier lâché à côté de la zone de dépôt.
['dragover', 'drop'].forEach((ev) => window.addEventListener(ev, (e) => { if (!e.target.closest?.('#drop')) e.preventDefault(); }));

/* ================= Sons de l'interface ================= */
// Le quiz a ses propres sons (bonne réponse, erreur…) ; ici, un retour discret sur le reste de l'appli.
const QUIZ = '.q, .stage, [data-tri], [data-i], [data-vf], [data-left], [data-right], [data-up], [data-down], #val, #skip, #yes, #no, #half, #pause, #resumeP, #card, label.switch, label.tgl, input';
document.addEventListener('click', (e) => {
  const el = e.target.closest('button, a, [data-stroop]');
  if (!el || el.disabled || el.closest(QUIZ) || el.matches(QUIZ)) return;
  if (el.matches('[data-stroop]')) return son('stroop');
  if (el.closest('.tabbar')) return son('tab');
  if (el.classList.contains('cta')) return son('go');
  if (el.matches('[data-chap], [data-partie], #all')) return son('check');
  if (el.matches('[data-close]')) return;
  son('nav');
}, true);
document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.matches?.('input[type=checkbox]') && el.id !== 'sonOn' && !el.closest('.q')) son(el.checked ? 'on' : 'off');
}, true);

if ('serviceWorker' in navigator) {
  // Mise à jour automatique : on vérifie s'il y a une nouvelle version à chaque retour dans l'appli,
  // et on recharge dès qu'elle est installée (sauf en pleine session de révision).
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
    const verifier = () => reg.update().catch(() => {});
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') verifier(); });
    setInterval(verifier, 30 * 60 * 1000);
  }).catch(() => {}));
  let rechargee = false;
  const avaitUnSW = !!navigator.serviceWorker.controller; // premier lancement : pas de rechargement
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (rechargee || !avaitUnSW) return;
    const recharger = () => { rechargee = true; sessionStorage.setItem('stroop-maj', '1'); location.reload(); };
    if (location.hash.startsWith('#/session')) window.addEventListener('hashchange', function f() { if (!location.hash.startsWith('#/session')) { window.removeEventListener('hashchange', f); recharger(); } });
    else recharger();
  });
  if (sessionStorage.getItem('stroop-maj')) { sessionStorage.removeItem('stroop-maj'); setTimeout(() => toast(`Stroop est à jour (version ${VERSION})`), 1200); }
}
