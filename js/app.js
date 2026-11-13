// Stroop Study — application principale (routeur + écrans).
import { figureHtml } from './figures.js';
import { son, getSons, setSons } from './sons.js';
import * as N from './notifs.js';
import {
  auth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  sendEmailVerification, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut
} from './firebase.js';
import * as S from './store.js';
import { today, isDue, dueDate, nextState, mastery, notionStats, seenCount, prioritize, shuffle, streak, INTERVALS } from './leitner.js';
import { TYPES, TYPE_KEYS, NIVEAUX, typeLabel, timeFor, formatOf, checkCourte, sameSet, resolveVariants } from './types.js';

const VERSION = '2.9.1';
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
  cards: '<path d="M8 4h11v14H8zM5 7v13h11"/>'
};
const ic = (n, cls = 'ic') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${IC[n]}</svg>`;
const STROOP = { dodo: 'stroop-dodo', contente: 'stroop-contente', sport: 'stroop-sport', fete: 'stroop-fete', etude: 'stroop-etude', arcenciel: 'stroop-arcenciel' };
/* Journée arc-en-ciel : au moins une réponse dans chacune des matières qui ont du contenu (6 à terme), le même jour. */
const avecContenuCodes = () => S.contenusImportes().map((c) => c.code);
const NB_ARC = () => avecContenuCodes().length;
const matieresDuJour = (u, k = today()) => { const ok = new Set(avecContenuCodes()); return Object.keys(u.joursM?.[k] || {}).filter((c) => ok.has(c) && u.joursM[k][c] > 0).length; };
const estArcEnCiel = (u, k = today()) => NB_ARC() > 1 && matieresDuJour(u, k) >= NB_ARC();
const stroopImg = (mood, cls = '') => `<img class="stroop a-${mood} ${cls}" src="assets/stroop/${STROOP[mood]}.webp" alt="Stroop la loutre" width="176" height="176" data-stroop>`;
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
    if (page === 'session') return viewSession();
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
    <span class="chip" aria-label="Série de ${s} jours"><svg class="ic flame" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" stroke="none" d="M12 2c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.2 1.7 1 2.7 2 3-.5-3 .3-5.8 1-8.5z"/></svg><b class="title">${s}</b><span class="muted">${s > 1 ? 'jours' : 'jour'}</span></span>
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
    img.classList.remove('wiggle'); void img.offsetWidth; img.classList.add('wiggle');
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
  $app.innerHTML = `<h1>Matières</h1>` + sems.map((sem) => `
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
const matSel = {}; // sélection de chapitres mémorisée par matière
const CFG_KEY = (code) => `stroop-cfg-${code}`;
function getCfg(code) {
  let c = null;
  try { c = JSON.parse(localStorage.getItem(CFG_KEY(code)) || 'null'); } catch { c = null; }
  c = c || {};
  return {
    // depuis la 2.8, les flashcards ont leur propre mode : décochées par défaut dans les quiz
    types: Array.isArray(c.types) ? c.types.filter((t) => TYPE_KEYS.includes(t) && (c.v >= 3 || t !== 'flashcard')) : TYPE_KEYS.filter((t) => t !== 'flashcard'),
    n: c.n ?? 20,
    niveau: c.niveau ?? 'tous',
    chrono: c.v >= 2 ? !!c.chrono : true
  };
}
const saveCfg = (code, cfg) => localStorage.setItem(CFG_KEY(code), JSON.stringify({ ...cfg, v: 3 }));
const matchCfg = (it, cfg) => cfg.types.includes(it.type) && (cfg.niveau === 'tous' || (it.niveau || 1) === Number(cfg.niveau));
function cfgSummary(cfg) {
  const t = cfg.types.length === TYPE_KEYS.length ? 'tous les types' : plural(cfg.types.length, 'type');
  const n = cfg.n === 'tout' ? 'toutes les questions' : `${cfg.n} questions`;
  const niv = cfg.niveau === 'tous' ? 'tous niveaux' : NIVEAUX[cfg.niveau].toLowerCase();
  return `${t} · ${n} · ${niv} · chrono ${cfg.chrono ? 'activé' : 'désactivé'}`;
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
  const st = matSel[code] || (matSel[code] = { sel: new Set() });
  const chaps = x.contenu.chapitres.slice().sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
  const render = () => {
    const cfg = getCfg(code);
    const selItems = x.items.filter((it) => st.sel.has(it.chapitre) && matchCfg(it, cfg));
    const errItems = x.items.filter((it) => st.sel.has(it.chapitre) && x.prog[it.id]?.err && it.type !== 'flashcard');
    const flashItems = x.items.filter((it) => it.type === 'flashcard' && (!st.sel.size || st.sel.has(it.chapitre)));
    const flashDue = flashItems.filter((it) => { const p = x.prog[it.id]; return !p || !p.box || isDue(p); }).length;
    const all = chaps.every((c) => st.sel.has(c.id));
    const ex = nextExam(m);
    const nb = cfg.n === 'tout' ? selItems.length : Math.min(cfg.n, selItems.length);
    $app.innerHTML = `
    <div class="between">${backBtn()}<button class="icon-btn" id="gear" aria-label="Réglages de la matière">${ic('gear')}</button></div>
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
          return `${partHead}<div class="chaprow">
            <button class="chap" data-chap="${esc(c.id)}" aria-pressed="${st.sel.has(c.id)}">
              <span class="box" aria-hidden="true"><svg class="ic" viewBox="0 0 24 24">${IC.check}</svg></span>
              <span class="info"><span class="between"><span class="name">${esc(c.titre)}</span><span class="small muted">${pct(mm)}</span></span>
              <span class="bar duo"><span class="seen" style="width:${Math.round((vus / ids.length) * 100)}%"></span><span style="width:${mm}%"></span></span></span>
            </button>
            ${c.fiche?.length ? `<button class="icon-btn fiche-btn" data-fiche="${esc(c.id)}" aria-label="Fiche de cours : ${esc(c.titre)}">${ic('book')}</button>` : ''}
          </div>`;
        }).join('')}
      </div>
      <button class="card cfg-card" id="cfg"><span><b>Réglages de session</b><span class="small muted" style="display:block">${esc(cfgSummary(cfg))}</span></span><span class="flag-btn" style="color:var(--m-ink);font-weight:800">Modifier</span></button>
      <div class="actions">
        <button class="cta cta-m" id="go" ${selItems.length ? '' : 'disabled'}><span><span class="t">Lancer la session</span><span class="s">${st.sel.size ? (selItems.length ? `${plural(st.sel.size, 'chapitre')} · ${plural(nb, 'question')}` : 'Aucune question avec ces réglages') : 'Coche au moins un chapitre'}</span></span><span class="go">${ic('arrow')}</span></button>
        <div class="two">
          <button class="btn soft" id="rafale" ${selItems.length ? '' : 'disabled'}>${ic('bolt')}Rafale 2 min</button>
          <button class="btn soft" id="flash" style="white-space:nowrap" ${flashItems.length ? '' : 'disabled'}>${ic('cards')}Flashcards${flashItems.length ? ` <span class="nb">${flashDue || flashItems.length}</span>` : ''}</button>
        </div>
        <button class="btn plain block" id="err" ${errItems.length ? '' : 'disabled'}>${ic('redo')}Mes erreurs · ${errItems.length}</button>
      </div>
    </div>`;
    $app.querySelectorAll('[data-chap]').forEach((b) => b.onclick = () => { const id = b.dataset.chap; st.sel.has(id) ? st.sel.delete(id) : st.sel.add(id); render(); });
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
  };
  render();
  if (!localStorage.getItem('stroop-tuto-leitner')) { localStorage.setItem('stroop-tuto-leitner', '1'); leitnerTuto(m); }
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
    const total = pool.filter((it) => matchCfg(it, cfg)).length;
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

async function startSession({ code, chapitres = null, kind = 'normal', ids = null }) {
  const contenu = await S.getContenu(code);
  const prog = await S.getProgres(code);
  const cfg = kind === 'jour' ? { types: TYPE_KEYS, n: 12, niveau: 'tous', chrono: getCfg(code).chrono } : getCfg(code);
  let items = S.flatItems(contenu);
  if (chapitres && chapitres.length) items = items.filter((it) => chapitres.includes(it.chapitre));
  if (ids) items = shuffle(items.filter((it) => ids.includes(it.id)));
  else if (kind === 'jour') items = prioritize(items.filter((it) => it.type !== 'flashcard' && isDue(prog[it.id])), prog).slice(0, 12);
  else if (kind === 'flash') items = prioritize(items.filter((it) => it.type === 'flashcard'), prog).slice(0, 20);
  else if (kind === 'erreurs') items = shuffle(items.filter((it) => prog[it.id]?.err && it.type !== 'flashcard'));
  else {
    items = items.filter((it) => matchCfg(it, cfg));
    if (kind === 'rafale') items = prioritize(items, prog);
    else items = prioritize(items, prog).slice(0, cfg.n === 'tout' ? items.length : cfg.n);
  }
  if (!items.length) return toast('Rien à réviser avec ces réglages');
  clearSaved();
  const all = S.flatItems(contenu);
  session = {
    code, kind, ids: items.map((i) => i.id), base: items.map((i) => i.id), i: 0, started: Date.now(),
    endsAt: kind === 'rafale' ? Date.now() + 120000 : null,
    chrono: !!cfg.chrono && kind !== 'rafale' && kind !== 'flash',
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
  document.querySelector('.pause-ov')?.remove();
  const m = S.getMatiere(session.code); setHalo(m.couleur);
  const contenu = await S.getContenu(session.code);
  const prog = await S.getProgres(session.code);
  const byId = Object.fromEntries(S.flatItems(contenu).map((it) => [it.id, it]));
  const chapById = Object.fromEntries(contenu.chapitres.map((c) => [c.id, c]));
  clearInterval(timerId); clearInterval(qTimerId);

  const finish = () => {
    clearInterval(timerId); clearInterval(qTimerId); clearSaved(); son('end');
    lastRecap = { ...session, matiere: m, m1: mastery(Object.values(byId), prog) };
    session = null; go('#/recap');
  };
  if (session.kind === 'rafale' && Date.now() >= session.endsAt) return finish();
  if (session.i >= session.ids.length) {
    if (session.kind === 'rafale') session.ids = session.ids.concat(prioritize((session.base || session.ids).map((id) => ({ id })), prog).map((x) => x.id));
    else return finish();
  }
  if (!byId[session.ids[session.i]]) { session.i++; return viewSession(); }
  const it = resolveVariants(byId[session.ids[session.i]]);
  const pBefore = { ...(prog[it.id] || {}) };
  const fmt = formatOf(it);
  const total = session.kind === 'rafale' ? null : session.ids.length;
  const progress = total ? Math.round((session.i / total) * 100) : Math.round(((120000 - (session.endsAt - Date.now())) / 120000) * 100);
  const timed = session.chrono && it.type !== 'flashcard';
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
  const advance = () => { clearInterval(qTimerId); logTime(); session.i++; saveSession(); viewSession(); };

  const head = () => `
    <div class="sess-top">
      <button class="icon-btn" id="quit" aria-label="Quitter la session">${ic('close')}</button>
      <span class="bar"><span id="pbar" style="width:${progress}%"></span></span>
      <button class="icon-btn" id="pause" aria-label="Pause">${ic('pause')}</button>
      <span class="timer" id="tim">${total ? `${session.i + 1} / ${total}` : session.endsAt <= Date.now() ? 'Dernière !' : fmtTime(session.endsAt - Date.now())}</span>
    </div>
    <div class="row" style="flex-wrap:wrap"><span class="chip m">${esc(m.code)} · ${esc(shortChap(it.chapitreTitre))}</span><span class="chip">${esc(typeLabel(it.type))}</span><span class="chip">${pBefore.box ? 'Boîte ' + pBefore.box : 'Nouveau'}</span>${session.kind === 'rafale' ? `<span class="chip">${ic('bolt')} ${session.results.length}</span>` : ''}</div>
    ${timed && !st.answered ? (() => { const left = st.deadline - Date.now(); return `<div class="qtimer" aria-hidden="true"><span id="qbar" class="${left < 5000 ? 'late' : ''}" style="width:${Math.max(0, (left / (timeFor(it) * 1000)) * 100)}%"></span></div>`; })() : ''}`;

  const ficheLink = () => {
    const chap = chapById[it.chapitre];
    const sec = chap?.fiche?.find((s) => s.id === it.section);
    return sec ? `<button class="flag-btn fiche-link" id="fiche">${ic('book')}Revoir le cours : ${esc(sec.titre)}</button>` : '';
  };
  const feedback = (extraHtml = '') => {
    if (!st.answered) return '';
    const title = st.timeout ? (st.autoValid ? (st.correct ? 'Temps écoulé, mais ta réponse était juste !' : 'Temps écoulé : ta réponse a été validée telle quelle.') : 'Temps écoulé !') : st.skip ? 'Pas de souci, on la reverra.' : st.correct ? 'Bien joué !' : 'Pas tout à fait.';
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
    ? `${st.correct ? `<button class="flag-btn pif" id="pif" aria-pressed="${st.pif}">${st.pif ? '✓ Noté : c’était au pif' : 'C’était au pif ?'}</button>` : ''}<button class="btn primary block" id="next">Continuer${ic('next')}</button>`
    : `<div class="two"><button class="btn plain" id="skip">Je ne sais pas</button><button class="btn primary" id="val" ${canValidate ? '' : 'disabled'}>${validateLabel}</button></div>`;
  const scenario = () => (it.type === 'cas' ? `<div class="scenario"><span class="lab">Cas pratique</span><p>${esc(it.scenario)}</p></div>` : '') + figureHtml(it.figure);
  const flag = () => `<button class="flag-btn" id="flag">${ic('flag')}Signaler</button>`;

  const render = () => {
    let body = '', foot = '';
    if (fmt === 'flashcard') {
      $app.innerHTML = `<div class="c-${m.couleur}" style="display:flex;flex-direction:column;gap:16px;flex:1">
        ${head()}
        <div class="stage"><span class="ghost-card" aria-hidden="true"></span>
          <button class="fcard" id="card" aria-label="${st.flipped ? 'Réponse' : 'Retourner la carte'}">
            <span class="swipe-tag no" id="tno">À revoir</span><span class="swipe-tag yes" id="tyes">Je sais</span>
            <span class="lab">${st.flipped ? 'Réponse' : /\?\s*$/.test(it.recto || '') ? 'Question' : 'Définis'}</span>
            <span class="body">${st.flipped ? `<span class="verso">${esc(it.verso)}</span>${figureHtml(it.figureVerso)}` : `<span class="recto">${esc(it.recto)}</span>${figureHtml(it.figure)}`}</span>
            <span class="hint">${ic('flip')}${st.flipped ? 'Glisse à droite si tu savais, à gauche sinon' : 'Touche pour retourner'}</span>
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
        <div class="list">${st.perm.map((i) => {
          const on = st.picked.has(i); let cls = '';
          if (st.answered) { if (good.has(i)) cls = 'ok'; else if (on) cls = 'ko'; }
          return `<button class="choice ${cls}" data-i="${i}" aria-pressed="${on}" ${st.answered ? 'disabled' : ''}><span class="mk ${multi ? 's' : 'r'}">${on || (st.answered && good.has(i)) ? `<svg class="ic" viewBox="0 0 24 24">${IC.check}</svg>` : ''}</span><span>${it.lettres ? `<b>${'abcdefgh'[i]})</b> ` : ''}${esc(it.choix[i])}</span></button>`;
        }).join('')}</div>`;
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
    } else if (fmt === 'courte') {
      body = `<h2 class="qt">${qText}</h2>
        <label class="field"><span class="sr">Ta réponse</span><input id="rep" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Ta réponse…" value="${esc(st.text)}" ${st.answered ? 'disabled' : ''} enterkeyhint="done"></label>
        ${st.answered && !st.correct ? `<div class="small" style="font-weight:800">Réponse attendue : ${esc(it.reponses[0])}</div>` : ''}`;
      foot = footer(true);
    }
    $app.innerHTML = `<div class="c-${m.couleur}" style="display:flex;flex-direction:column;gap:14px;flex:1">
      ${head()}${scenario()}<div class="q">${body}${feedback()}</div><div style="flex:1"></div>${foot}${flag()}</div>`;

    // Interactions
    $app.querySelectorAll('[data-i]').forEach((b) => b.onclick = () => {
      const i = Number(b.dataset.i);
      if (fmt === 'qcm') { st.picked.has(i) ? st.picked.delete(i) : st.picked.add(i); } else { st.picked = new Set([i]); }
      son('tap'); render();
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
    const val = document.getElementById('val');
    if (val) val.onclick = async () => { await answer(grade()); render(); };
    document.getElementById('skip')?.addEventListener('click', async () => { st.skip = true; await answer(false, { skip: true }); render(); });
    document.getElementById('next')?.addEventListener('click', advance);
    document.getElementById('pif')?.addEventListener('click', togglePif);
    bindCommon();
  };

  function bindCommon() {
    document.getElementById('quit').onclick = () => {
      clearInterval(timerId); clearInterval(qTimerId); logTime();
      if (session.results.length && session.kind !== 'rafale') { saveSession(); toast('Session gardée : tu pourras la reprendre'); }
      else if (!session.results.length) clearSaved();
      if (session.kind === 'rafale' && session.results.length) return finish();
      session = null; go('#/');
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
  const titles = { flash: 'Flashcards terminées !', jour: 'Session du jour terminée !', rafale: 'Fin de la rafale !', erreurs: 'Erreurs revues !', normal: 'Session terminée !' };
  const gain = (r.m1 ?? 0) - (r.m0 ?? 0);
  const arcNouveau = estArcEnCiel(S.getUser()) && localStorage.getItem('stroop-arc-recap') !== today();
  if (arcNouveau) { localStorage.setItem('stroop-arc-recap', today()); setTimeout(() => son('sport'), 300); }
  $app.innerHTML = `<section class="recap c-${r.matiere.couleur}">
    ${arcNouveau ? `<div class="stroop-zone"><div class="bubble"><span class="who">Stroop</span>Et de ${NB_ARC()} ! Toutes tes matières dans la même journée : journée arc-en-ciel 🌈</div>${stroopImg('arcenciel')}</div>` : `<div class="stroop-zone"><div class="bubble"><span class="who">Stroop</span>${n ? (ok / n >= 0.8 ? 'Wahou, quelle forme ! Je fais la fête.' : ok / n >= 0.5 ? 'Beau travail, ça rentre !' : 'Chaque erreur d’aujourd’hui, c’est une réussite de demain.') : 'On se refait ça bientôt ?'}</div>${stroopImg(n && ok / n < 0.5 ? 'etude' : 'fete')}</div>`}
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
  let best = 0, cur = 0, prev = null;
  for (const k of keys) {
    if (!u.jours[k]) continue;
    const d = new Date(k); if (prev && (d - prev) / 86400000 === 1) cur++; else cur = 1;
    best = Math.max(best, cur); prev = d;
  }
  // séries : actuelle (depuis quand) et meilleure (du… au…)
  let bestStart = null, bestEnd = null, runStart = null; prev = null; cur = 0;
  for (const k of keys) {
    if (!u.jours[k]) continue;
    const dd = new Date(k);
    if (prev && (dd - prev) / 86400000 === 1) cur++; else { cur = 1; runStart = k; }
    if (cur >= best && cur) { bestStart = runStart; bestEnd = k; }
    prev = dd;
  }
  const totalRep = keys.reduce((a, k) => a + (u.jours[k] || 0), 0);
  const joursTravailles = keys.filter((k) => u.jours[k]).length;
  const joursArc = Object.keys(u.joursM || {}).filter((k) => estArcEnCiel(u, k)).length;
  const totalMin = Math.round(Object.values(u.temps || {}).reduce((a, v) => a + v, 0) / 60);
  const all = await Promise.all(S.matieres().map(matiereStats));
  const couleurOf = Object.fromEntries(S.matieres().map((m) => [m.code, m.couleur]));
  // 5 dernières semaines : chaque case prend la couleur de la matière la plus travaillée ce jour-là
  const d = new Date(); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow - 28);
  let cal = '';
  for (let w = 0; w < 5; w++) {
    cal += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px">';
    for (let i = 0; i < 7; i++) {
      const k = today(d); const n = u.jours[k] || 0; const fut = k > today();
      const lvl = n === 0 ? 0 : n < 10 ? 1 : n < 30 ? 2 : 3;
      const jm = u.joursM?.[k];
      const top = jm ? Object.entries(jm).sort((a, b) => b[1] - a[1])[0][0] : null;
      const col = top && couleurOf[top] ? `var(--${couleurOf[top]}-acc)` : 'var(--muted)';
      const style = fut ? 'background:transparent' : lvl === 0 ? 'background:var(--ghost)' : `background:${col};opacity:${[0, 0.4, 0.7, 1][lvl]}`;
      const label = `${k} : ${plural(n, 'réponse')}${top ? ', surtout ' + top : ''}`;
      cal += `<span title="${esc(label)}" aria-label="${esc(label)}" style="aspect-ratio:1;border-radius:10px;${style};${k === today() ? 'outline:2px dashed var(--ink);outline-offset:-2px' : ''}"></span>`;
      d.setDate(d.getDate() + 1);
    }
    cal += '</div>';
  }
  const fmtD = (k) => new Date(k).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  const usedCols = [...new Set(Object.values(u.joursM || {}).flatMap((jm) => Object.keys(jm)))].filter((c) => couleurOf[c]);
  $app.innerHTML = `<div class="between"><h1>Progrès</h1>${joursArc ? `<img class="stroop small a-arcenciel" src="assets/stroop/stroop-arcenciel.webp" alt="Stroop arc-en-ciel" style="width:88px;height:88px">` : `<img class="stroop small a-etude" src="assets/stroop/stroop-etude.webp" alt="Stroop studieux" style="width:88px;height:88px">`}</div>
    <div class="stats">
      <button class="stat" data-stat><b>${s}</b><span>${s > 1 ? 'jours d’affilée' : 'jour d’affilée'}</span></button>
      <button class="stat" data-stat><b>${best}</b><span>meilleure série</span></button>
      <button class="stat" data-stat><b>${totalRep}</b><span>${totalRep > 1 ? 'réponses' : 'réponse'}</span></button>
    </div>
    <div class="card" style="padding:14px;display:flex;flex-direction:column;gap:6px">
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;text-align:center" class="small muted">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((x) => `<span>${x}</span>`).join('')}</div>
      ${cal}
      ${usedCols.length ? `<div class="nlegend small" style="margin-top:6px">${usedCols.map((c) => `<span><span class="ndot" style="background:var(--${couleurOf[c]}-acc)"></span>${esc(c)}</span>`).join('')}</div>` : ''}
    </div>
    <h2 class="section-title">Par matière</h2>
    <div class="list">${all.filter((x) => x.contenu).map((x) => `
      <a class="card c-${x.m.couleur}" href="#/matiere/${encodeURIComponent(x.m.code)}" style="padding:14px;display:flex;flex-direction:column;gap:8px;text-decoration:none">
        <div class="between"><b class="title" style="color:var(--m-ink)">${esc(x.m.code)}</b><b>${pct(x.maitrise)}</b></div>
        <span class="bar"><span style="width:${x.maitrise}%"></span></span>
        <span class="small muted">${x.due} à revoir · ${x.neufs} jamais ${x.neufs > 1 ? 'vus' : 'vu'} · ${plural(x.erreurs, 'erreur')} en attente</span>
      </a>`).join('') || '<div class="card empty muted">Rien pour l’instant : importe du contenu pour commencer.</div>'}</div>`;
  $app.querySelectorAll('[data-stat]').forEach((b) => b.onclick = () => openSheet(`
    <div class="between"><h2>Tes chiffres</h2><button class="icon-btn" data-close aria-label="Fermer">${ic('close')}</button></div>
    <ul class="list" style="list-style:none;margin:0;padding:0;gap:12px">
      <li><b>Série actuelle : ${plural(s, 'jour')}</b><br><span class="small muted">${s ? `Tu révises chaque jour depuis le ${fmtD(runStart)}. Une réponse dans la journée suffit à la prolonger.` : 'Réponds à une question aujourd’hui pour lancer une série.'}</span></li>
      <li><b>Meilleure série : ${plural(best, 'jour')}</b><br><span class="small muted">${best && bestStart ? (best > 1 ? `Ton record de jours de révision d’affilée, du ${fmtD(bestStart)} au ${fmtD(bestEnd)}.` : `Ton record de jours de révision d’affilée (le ${fmtD(bestEnd)}).`) : 'Pas encore de série.'}</span></li>
      <li><b>${plural(joursArc, 'journée arc-en-ciel', 'journées arc-en-ciel')} 🌈</b><br><span class="small muted">${joursArc ? 'Les jours où tu as révisé tes' : 'Révise tes'} ${NB_ARC()} matières dans la même journée${joursArc ? '.' : ' pour débloquer Stroop arc-en-ciel.'}</span></li>
      <li><b>${plural(totalRep, 'réponse')}</b><br><span class="small muted">Sur ${plural(joursTravailles, 'jour')} de révision${totalMin ? `, pour environ ${fmtMin(totalMin)} de révision depuis le 13 novembre` : ''}.</span></li>
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
  { id: 'aide', icon: 'help', titre: 'Aide', sous: 'Leitner, maîtrise, version' },
  { id: 'donnees', icon: 'download', titre: 'Mes données', sous: 'Exporter' }
];

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
    aide: `<button class="card cfg-card" id="instP"><span><b>Installer Stroop sur mon téléphone</b><span class="small muted" style="display:block">Le tuto iPhone et Android, à partager aussi</span></span>${ic('next')}</button>
      <button class="card cfg-card" id="tutoP"><span><b>Comment fonctionne la boîte de Leitner ?</b><span class="small muted" style="display:block">Le petit tuto des 5 boîtes</span></span>${ic('next')}</button>
      ${card(`<b>Et la maîtrise ?</b><p class="muted small" style="margin:0">Dans chaque matière, touche le cercle de maîtrise pour voir comment elle se calcule et la liste de tes notions.</p>`)}
      <p class="muted small" style="margin:0;text-align:center">Stroop Study · version ${VERSION}</p>`,
    donnees: card(`<p class="muted small" style="margin:0">Télécharge une copie de ta progression et de tes réglages (fichier .json).</p><button class="btn plain block" id="export">${ic('download')}Exporter mes données</button>`)
  };
  const sec = PROFIL_SECTIONS.find((x) => x.id === section);
  if (sec) {
    $app.innerHTML = `<div class="row" style="gap:12px"><a class="icon-btn" href="#/profil" aria-label="Retour">${ic('back')}</a><h1 style="margin:0">${esc(sec.titre)}</h1></div>${SEC[sec.id]}`;
  } else {
    const initiale = (u.prenom || auth.currentUser?.email || '?').trim().charAt(0).toUpperCase();
    $app.innerHTML = `<h1>Profil</h1>
      <div class="card" style="padding:16px;display:flex;align-items:center;gap:14px">
        <span class="avatar">${esc(initiale)}</span>
        <span style="flex:1;min-width:0"><b style="font-size:18px">${esc(u.prenom || 'Toi')}</b><span class="small muted" style="display:block;overflow:hidden;text-overflow:ellipsis">${esc(u.semestre || '')} · ${esc(auth.currentUser?.email || '')}</span></span>
      </div>
      <div class="card menu">${PROFIL_SECTIONS.map((x) => `<a class="menu-row" href="#/profil/${x.id}"><span class="menu-ic">${ic(x.icon)}</span><span class="menu-txt"><b>${esc(x.titre)}</b><span class="small muted">${esc(S.isAdmin() && x.admin ? x.admin : x.sous)}</span></span>${badge[x.id] ? `<span class="menu-badge">${esc(badge[x.id])}</span>` : ''}${ic('next')}</a>`).join('')}</div>
      <p class="muted small" style="margin:0;text-align:center">version ${VERSION}</p>`;
    return;
  }
  bindNotifCard();
  const sonOn = document.getElementById('sonOn'); if (sonOn) sonOn.onchange = (e) => { setSons({ on: e.target.checked }); if (e.target.checked) son('ok'); viewProfil(section); };
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
  const importFiles = async (files) => {
    const out = document.getElementById('imp');
    out.innerHTML = '';
    for (const file of files) {
      try {
        if (!file.name.toLowerCase().endsWith('.json')) throw new Error('Ce n\u2019est pas un fichier .json.');
        const data = JSON.parse(await file.text());
        const info = await S.importContenu(data, file.name); son('ok');
        const vers = document.getElementById('vers'); if (vers) vers.innerHTML = versionsHtml();
        out.insertAdjacentHTML('beforeend', `<div class="feedback ok"><b>${esc(info.code)}${info.revision ? ` v${info.revision}` : ''} importé !</b>${plural(info.nbChapitres, 'chapitre')}, ${plural(info.nbElements, 'élément')}. <a href="#/matiere/${encodeURIComponent(info.code)}">Voir ${esc(info.code)}</a></div>`);
      } catch (er) {
        const msg = er instanceof SyntaxError ? 'Le fichier est abîmé ou incomplet.' : er.message;
        out.insertAdjacentHTML('beforeend', `<div class="feedback ko"><b>${esc(file.name)} : import impossible</b>${esc(msg)}</div>`);
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
    await S.loadAcces();
    await S.loadLibrary();
    route();
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
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
