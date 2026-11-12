// Stroop · Révisions — application principale (routeur + écrans).
import {
  auth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  sendEmailVerification, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut
} from './firebase.js';
import * as S from './store.js';
import { today, isDue, nextState, mastery, prioritize, shuffle, streak } from './leitner.js';

const VERSION = '1.1.0';
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
  book: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10v16H5.5A1.5 1.5 0 0 1 4 18.5zM14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14z"/>',
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
  copy: '<path d="M9 9h10v10H9zM5 15V5h10"/>'
};
const ic = (n, cls = 'ic') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${IC[n]}</svg>`;
const STROOP = { dodo: 'stroop-dodo', contente: 'stroop-contente', sport: 'stroop-sport', fete: 'stroop-fete' };
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
    if (page === 'profil') return await viewProfil();
    return await viewHome();
  } catch (e) {
    console.error(e);
    $app.innerHTML = `<div class="card empty"><p><b>Oups, un souci.</b></p><p class="muted small">${esc(e.message)}</p><a class="btn plain" href="#/">Revenir à l'accueil</a></div>`;
  }
}
window.addEventListener('hashchange', route);

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
        ${stroopImg('contente')}
      </div>
      <h1>Connexion</h1>
      ${err ? `<p class="feedback ko" role="alert">${esc(err)}</p>` : ''}
      <button class="btn plain block" id="google" style="min-height:58px">${GOOGLE_SVG}Continuer avec Google</button>
      <button class="flag-btn" id="mail" style="align-self:center">Utiliser une adresse e-mail à la place</button>
    </section>`;
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
  if (!contenu) return { m, contenu: null, total: 0, due: 0, neufs: 0, maitrise: 0, erreurs: 0 };
  const prog = await S.getProgres(m.code);
  const items = S.flatItems(contenu);
  const ids = items.map((i) => i.id);
  let due = 0, neufs = 0, erreurs = 0;
  for (const it of items) {
    const p = prog[it.id];
    if (!p || !p.box) neufs++; else if (isDue(p)) due++;
    if (p?.err) erreurs++;
  }
  return { m, contenu, prog, items, total: items.length, due, neufs, maitrise: mastery(ids, prog), erreurs };
}

function nextExam(m) {
  const now = new Date(today()).getTime();
  return (m.examens || []).map((e) => ({ ...e, t: new Date(e.date).getTime() })).filter((e) => e.t >= now).sort((a, b) => a.t - b.t)[0];
}
const daysUntil = (t) => Math.round((t - new Date(today()).getTime()) / 86400000);

function weekStrip(jours) {
  const d = new Date(); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow);
  const L = ['L', 'M', 'M', 'J', 'V', 'S', 'D']; const t = today();
  let html = '';
  for (let i = 0; i < 7; i++) {
    const k = today(d); const done = !!jours[k]; const isT = k === t; const fut = k > t;
    const cls = done ? 'done' : isT ? 'today' : fut ? 'future' : 'miss';
    html += `<div class="day"><span class="l">${L[i]}</span><span class="d ${cls}${isT ? ' today' : ''}" aria-label="${k}${done ? ', validé' : ''}">${done ? ic('check', 'ic') : d.getDate()}</span></div>`;
    d.setDate(d.getDate() + 1);
  }
  return `<div class="card week" aria-label="Ma semaine">${html}</div>`;
}

/* ================= Accès à la bibliothèque ================= */
const needsVerif = () => auth.currentUser && !auth.currentUser.emailVerified && !S.isAdmin();
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
    <div class="stroop-zone"><div class="bubble"><span class="who">Stroop</span>Presque prête ! Il reste à ouvrir ta base de données.</div>${stroopImg('dodo')}</div>
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
  const mood = !fait ? 'dodo' : s >= 5 ? 'sport' : 'contente';
  const avecContenu = all.filter((x) => x.contenu);
  const best = [...avecContenu].sort((a, b) => (b.due + b.neufs) - (a.due + a.neufs))[0];
  const todo = best ? Math.min(12, best.due + best.neufs) : 0;

  let bubble;
  if (!avecContenu.length) bubble = S.isAdmin() ? 'Zzz… Importe ton premier contenu dans Profil et on commence !' : 'Zzz… Le contenu n’est pas encore arrivé. Je fais une petite sieste en attendant.';
  else if (mood === 'dodo') bubble = s ? `Zzz… Ta série de ${plural(s, 'jour')} m’attend. Une carte suffit à me réveiller !` : 'Zzz… Une seule carte suffit pour me réveiller.';
  else if (mood === 'sport') bubble = `${s} jours d’affilée ! Super Stroop est à fond, on continue ?`;
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
  ${weekStrip(u.jours)}
  ${saved ? `<button class="cta" id="resume"><span><span class="t">Reprendre ma session</span><span class="s">${esc(saved.code)} · ${saved.i}/${saved.ids.length} · là où tu t’étais arrêtée</span></span><span class="go">${ic('arrow')}</span></button>` : ''}
  ${best || !S.isAdmin() ? (best ? `<button class="cta" id="daily" ${todo ? '' : 'disabled'}><span><span class="t">Session du jour</span><span class="s">${todo ? `${esc(best.m.code)} · ${plural(todo, 'carte')} · environ ${Math.max(2, Math.round(todo / 2))} min` : 'Rien à revoir pour l’instant'}</span></span><span class="go">${ic('arrow')}</span></button>` : '') : `<a class="cta" href="#/profil"><span><span class="t">Importer du contenu</span><span class="s">Ajoute ton premier fichier de révisions</span></span><span class="go">${ic('arrow')}</span></a>`}
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
  document.getElementById('resume')?.addEventListener('click', () => { session = saved; go('#/session'); });
  document.getElementById('daily')?.addEventListener('click', () => startSession({ code: best.m.code, kind: 'jour' }));
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
async function viewMatiere(code) {
  tabbar('#/matieres');
  const m = S.getMatiere(code);
  if (!m) return go('#/matieres');
  setHalo(m.couleur);
  const x = await matiereStats(m);
  if (!x.contenu) {
    $app.innerHTML = `${backBtn()}<div class="c-${m.couleur}"><div class="mat-head"><div><div class="code">${esc(m.code)}</div><b>${esc(m.nom)}</b></div></div></div>
      <div class="card empty"><img class="stroop small a-dodo" src="assets/stroop/stroop-dodo.webp" alt=""><p><b>Pas encore de contenu ici.</b></p>${S.isAdmin() ? '<p class="muted small">Envoie tes supports à Claude, puis importe le fichier qu’il te donne depuis l’onglet Profil.</p><a class="btn plain" href="#/profil">Aller à l’import</a>' : '<p class="muted small">Il arrivera dès qu’il sera ajouté à la bibliothèque commune.</p>'}</div>
      ${examBlock(m)}`;
    bindExam(m);
    return;
  }
  const st = matSel[code] || (matSel[code] = { sel: new Set(), mode: 'tout' });
  const chaps = x.contenu.chapitres.slice().sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
  const render = () => {
    const filt = (it) => st.mode === 'tout' || (st.mode === 'flash' ? it.type === 'flashcard' : it.type !== 'flashcard');
    const selItems = x.items.filter((it) => st.sel.has(it.chapitre) && filt(it));
    const errItems = selItems.filter((it) => x.prog[it.id]?.err);
    const all = chaps.every((c) => st.sel.has(c.id));
    const ex = nextExam(m);
    $app.innerHTML = `
    <div class="between">${backBtn()}<button class="icon-btn" id="gear" aria-label="Réglages de la matière">${ic('gear')}</button></div>
    <div class="c-${m.couleur}" style="display:flex;flex-direction:column;gap:16px">
      <div class="mat-head">
        <div style="min-width:0"><div class="code">${esc(m.code)}</div><b>${esc(m.nom)}</b>
          <div class="small muted">${plural(x.total, 'élément')} · ${plural(x.erreurs, 'erreur')} à revoir${ex ? ` · examen J-${daysUntil(ex.t)}` : ''}</div></div>
        <div class="ring" role="img" aria-label="Maîtrise ${x.maitrise} %" style="background:conic-gradient(var(--m-acc) 0 ${x.maitrise}%, var(--ghost) ${x.maitrise}% 100%)"><div><b>${pct(x.maitrise)}</b><small>maîtrise</small></div></div>
      </div>
      <div class="seg" role="group" aria-label="Type d’exercices">
        ${[['tout', 'Tout'], ['flash', 'Flashcards'], ['quiz', 'Quiz']].map(([k, l]) => `<button data-mode="${k}" aria-pressed="${st.mode === k}">${l}</button>`).join('')}
      </div>
      <div class="between"><h2 class="section-title">Chapitres à réviser</h2><button class="flag-btn" id="all" style="color:var(--m-ink);font-weight:800">${all ? 'Tout décocher' : 'Tout cocher'}</button></div>
      <div class="list">
        ${chaps.map((c) => {
          const ids = c.elements.map((e) => e.id); const mm = mastery(ids, x.prog);
          const due = c.elements.filter((e) => isDue(x.prog[e.id])).length;
          return `<button class="chap" data-chap="${esc(c.id)}" aria-pressed="${st.sel.has(c.id)}">
            <span class="box" aria-hidden="true"><svg class="ic" viewBox="0 0 24 24">${IC.check}</svg></span>
            <span class="info"><span class="between"><span class="name">${esc(c.titre)}</span><span class="small muted">${due}/${ids.length}</span></span>
            <span class="bar"><span style="width:${mm}%"></span></span></span></button>`;
        }).join('')}
      </div>
      <div class="actions">
        <button class="cta" id="go" ${selItems.length ? '' : 'disabled'}><span><span class="t">Lancer la session</span><span class="s">${st.sel.size ? `${plural(st.sel.size, 'chapitre')} · ${plural(Math.min(20, selItems.length), 'élément')}` : 'Coche au moins un chapitre'}</span></span><span class="go">${ic('arrow')}</span></button>
        <div class="two">
          <button class="btn soft" id="rafale" ${selItems.length ? '' : 'disabled'}>${ic('bolt')}Rafale 2 min</button>
          <button class="btn plain" id="err" ${errItems.length ? '' : 'disabled'}>${ic('redo')}Mes erreurs · ${errItems.length}</button>
        </div>
      </div>
    </div>`;
    $app.querySelectorAll('[data-mode]').forEach((b) => b.onclick = () => { st.mode = b.dataset.mode; render(); });
    $app.querySelectorAll('[data-chap]').forEach((b) => b.onclick = () => { const id = b.dataset.chap; st.sel.has(id) ? st.sel.delete(id) : st.sel.add(id); render(); });
    document.getElementById('all').onclick = () => { if (all) st.sel.clear(); else chaps.forEach((c) => st.sel.add(c.id)); render(); };
    const opts = { code, chapitres: [...st.sel], mode: st.mode };
    document.getElementById('go').onclick = () => startSession({ ...opts, kind: 'normal' });
    document.getElementById('rafale').onclick = () => startSession({ ...opts, kind: 'rafale' });
    document.getElementById('err').onclick = () => startSession({ ...opts, kind: 'erreurs' });
    document.getElementById('gear').onclick = () => matiereSheet(m, render);
  };
  render();
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
  const close = () => { back.remove(); route(); };
  back.onclick = (e) => { if (e.target === back) close(); };
  document.body.appendChild(back); draw();
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

async function startSession({ code, chapitres = null, mode = 'tout', kind = 'normal' }) {
  const contenu = await S.getContenu(code);
  const prog = await S.getProgres(code);
  let items = S.flatItems(contenu);
  if (chapitres && chapitres.length) items = items.filter((it) => chapitres.includes(it.chapitre));
  if (mode === 'flash') items = items.filter((it) => it.type === 'flashcard');
  if (mode === 'quiz') items = items.filter((it) => it.type !== 'flashcard');
  if (kind === 'erreurs') items = shuffle(items.filter((it) => prog[it.id]?.err));
  else if (kind === 'rafale') items = shuffle(items);
  else items = prioritize(items, prog).slice(0, kind === 'jour' ? 12 : 20);
  if (!items.length) return toast('Rien à réviser dans cette sélection');
  clearSaved();
  session = {
    code, kind, ids: items.map((i) => i.id), i: 0, started: Date.now(),
    endsAt: kind === 'rafale' ? Date.now() + 120000 : null,
    results: [], score: 0, base: items.map((i) => i.id)
  };
  saveSession();
  go('#/session');
}

let timerId = null;
async function viewSession() {
  noTab();
  if (!session) { const s = loadSaved(); if (s) session = s; else return go('#/'); }
  const m = S.getMatiere(session.code); setHalo(m.couleur);
  const contenu = await S.getContenu(session.code);
  const prog = await S.getProgres(session.code);
  const byId = Object.fromEntries(S.flatItems(contenu).map((it) => [it.id, it]));
  clearInterval(timerId);

  const finish = () => {
    clearInterval(timerId); clearSaved();
    lastRecap = { ...session, matiere: m };
    session = null; go('#/recap');
  };
  if (session.kind === 'rafale' && Date.now() >= session.endsAt) return finish();
  if (session.i >= session.ids.length) {
    if (session.kind === 'rafale') { session.ids = session.ids.concat(shuffle(session.base || session.ids)); }
    else return finish();
  }
  const it = byId[session.ids[session.i]];
  if (!it) { session.i++; return viewSession(); }
  const p = prog[it.id] || {};
  const total = session.kind === 'rafale' ? null : session.ids.length;
  const progress = total ? Math.round((session.i / total) * 100) : Math.round(((120000 - (session.endsAt - Date.now())) / 120000) * 100);
  const st = { flipped: false, conf: null, picked: new Set(), answered: false };

  const head = () => `
    <div class="sess-top">
      <button class="icon-btn" id="quit" aria-label="Quitter la session">${ic('close')}</button>
      <span class="bar"><span id="pbar" style="width:${progress}%"></span></span>
      <span class="timer" id="tim">${total ? `${session.i + 1} / ${total}` : fmtTime(session.endsAt - Date.now())}</span>
    </div>
    <div class="row" style="flex-wrap:wrap"><span class="chip m">${esc(m.code)} · ${esc(shortChap(it.chapitreTitre))}</span><span class="chip">${p.box ? 'Boîte ' + p.box : 'Nouveau'}</span>${session.kind === 'rafale' ? `<span class="chip">${ic('bolt')} ${session.results.length} réponses</span>` : ''}</div>`;

  const confRow = () => `<div class="conf" role="group" aria-label="Ma confiance">${[['sure', 'Sûre'], ['hesitante', 'Hésitante'], ['pif', 'Au pif']].map(([k, l]) => `<button data-conf="${k}" aria-pressed="${st.conf === k}">${l}</button>`).join('')}</div>`;

  const answer = async (correct, extra = {}) => {
    if (st.answered && it.type === 'flashcard') return;
    st.answered = true;
    const before = p.box || 0;
    const ns = nextState(p, correct, st.conf);
    await S.recordAnswer(session.code, it.id, ns);
    session.results.push({ id: it.id, correct, before, after: ns.box, ...extra });
    if (m.negatif && it.type !== 'flashcard') session.score += correct ? 1 : extra.skip ? 0 : -1;
    else if (correct) session.score += 1;
  };
  const advance = () => { session.i++; saveSession(); viewSession(); };

  const render = () => {
    const flag = `<button class="flag-btn" id="flag">${ic('flag')}Signaler cette ${it.type === 'flashcard' ? 'carte' : 'question'}</button>`;
    if (it.type === 'flashcard') {
      $app.innerHTML = `<div class="c-${m.couleur}" style="display:flex;flex-direction:column;gap:16px;flex:1">
        ${head()}
        <div class="stage"><span class="ghost-card" aria-hidden="true"></span>
          <button class="fcard" id="card" aria-label="${st.flipped ? 'Réponse' : 'Retourner la carte'}">
            <span class="swipe-tag no" id="tno">À revoir</span><span class="swipe-tag yes" id="tyes">Je sais</span>
            <span class="lab">${st.flipped ? 'Réponse' : 'Définis'}</span>
            <span class="body">${st.flipped ? `<span class="verso">${esc(it.verso)}</span>` : `<span class="recto">${esc(it.recto)}</span>`}</span>
            <span class="hint">${ic('flip')}${st.flipped ? 'Glisse à droite si tu savais, à gauche sinon' : 'Touche pour retourner'}</span>
          </button>
        </div>
        ${st.flipped ? `<div class="small muted" style="text-align:center;margin-bottom:-6px">Tu étais…</div>${confRow()}
        <div class="two"><button class="btn no" id="no">${ic('back')}À revoir</button><button class="btn primary" id="yes">Je sais${ic('next')}</button></div>` : '<div style="height:8px"></div>'}
        ${flag}
      </div>`;
      const card = document.getElementById('card');
      card.onclick = () => { if (card.dataset.dragged) { delete card.dataset.dragged; return; } st.flipped = !st.flipped; render(); };
      if (st.flipped) {
        document.getElementById('no').onclick = async () => { await answer(false); advance(); };
        document.getElementById('yes').onclick = async () => { await answer(true); advance(); };
        bindSwipe(card, async (dir) => { await answer(dir > 0); advance(); });
      }
    } else {
      const multi = it.type === 'qcm';
      const good = new Set(it.bonnes);
      const correct = st.answered ? (st.picked.size === good.size && [...st.picked].every((i) => good.has(i))) : null;
      $app.innerHTML = `<div class="c-${m.couleur}" style="display:flex;flex-direction:column;gap:14px;flex:1">
        ${head()}
        <div class="q">
          <span class="small muted">${multi ? 'QCM · plusieurs bonnes réponses possibles' : 'QCU · une seule bonne réponse'}${m.negatif ? ' · points négatifs' : ''}</span>
          <h2 class="qt">${esc(it.question)}</h2>
          <div class="list">${it.choix.map((c, i) => {
            let cls = ''; const on = st.picked.has(i);
            if (st.answered) { if (good.has(i)) cls = 'ok'; else if (on) cls = 'ko'; }
            return `<button class="choice ${cls}" data-i="${i}" aria-pressed="${on}" ${st.answered ? 'disabled' : ''}><span class="mk ${multi ? 's' : 'r'}">${on || (st.answered && good.has(i)) ? `<svg class="ic" viewBox="0 0 24 24">${IC.check}</svg>` : ''}</span><span>${esc(c)}</span></button>`;
          }).join('')}</div>
          ${st.answered ? `<div class="feedback ${correct ? 'ok' : 'ko'}" role="status"><b>${st.skip ? 'Pas de souci, on la reverra.' : correct ? 'Bien joué !' : 'Pas tout à fait.'}</b>${esc(it.explication || '')}</div>` : ''}
        </div>
        <div style="flex:1"></div>
        ${st.answered ? `<button class="btn primary block" id="next">Continuer${ic('next')}</button>` : `${confRow()}
        <div class="two"><button class="btn plain" id="skip">Je ne sais pas</button><button class="btn primary" id="val" ${st.picked.size ? '' : 'disabled'}>Valider</button></div>`}
        ${flag}
      </div>`;
      $app.querySelectorAll('[data-i]').forEach((b) => b.onclick = () => {
        const i = Number(b.dataset.i);
        if (multi) { st.picked.has(i) ? st.picked.delete(i) : st.picked.add(i); } else { st.picked = new Set([i]); }
        render();
      });
      if (!st.answered) {
        document.getElementById('val').onclick = async () => {
          const ok = st.picked.size === good.size && [...st.picked].every((i) => good.has(i));
          await answer(ok); render();
        };
        document.getElementById('skip').onclick = async () => { st.skip = true; await answer(false, { skip: true }); render(); };
      } else document.getElementById('next').onclick = advance;
    }
    $app.querySelectorAll('[data-conf]').forEach((b) => b.onclick = () => { st.conf = st.conf === b.dataset.conf ? null : b.dataset.conf; render(); });
    document.getElementById('quit').onclick = () => {
      clearInterval(timerId);
      if (session.results.length && session.kind !== 'rafale') { saveSession(); toast('Session gardée : tu pourras la reprendre'); }
      else if (!session.results.length) clearSaved();
      if (session.kind === 'rafale' && session.results.length) return finish();
      session = null; go('#/');
    };
    document.getElementById('flag').onclick = () => flagSheet(session.code, it);
  };
  render();
  if (session.kind === 'rafale') {
    timerId = setInterval(() => {
      const left = session.endsAt - Date.now();
      const t = document.getElementById('tim'); const b = document.getElementById('pbar');
      if (t) t.textContent = fmtTime(left);
      if (b) b.style.width = Math.min(100, Math.round(((120000 - left) / 120000) * 100)) + '%';
      if (left <= 0) finish();
    }, 500);
  }
}
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
  const back = document.createElement('div'); back.className = 'sheet-back';
  back.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="Signaler">
    <div class="between"><h2>Signaler</h2><button class="icon-btn" data-close aria-label="Fermer">${ic('close')}</button></div>
    <p class="muted small" style="margin:0">${esc(it.recto || it.question)}</p>
    <label class="field">Qu’est-ce qui ne va pas ?<textarea id="note" rows="3" placeholder="ex. définition incomplète, mauvaise réponse, formulation ambiguë…"></textarea></label>
    <button class="btn primary block" id="send">Signaler</button>
    <p class="muted small" style="margin:0">Retrouve tes signalements dans Profil, pour les transmettre à Claude.</p></div>`;
  const close = () => back.remove();
  back.onclick = (e) => { if (e.target === back) close(); };
  back.querySelector('[data-close]').onclick = close;
  back.querySelector('#send').onclick = async () => { await S.flagItem(code, it.id, back.querySelector('#note').value.trim()); close(); toast('Merci, c’est noté !'); };
  document.body.appendChild(back); back.querySelector('#note').focus();
}

/* ================= Récap ================= */
function viewRecap() {
  noTab();
  const r = lastRecap; if (!r) return go('#/');
  setHalo(r.matiere.couleur);
  const n = r.results.length; const ok = r.results.filter((x) => x.correct).length;
  const up = r.results.filter((x) => x.correct && x.after > x.before).length; const down = r.results.filter((x) => x.after < x.before).length;
  const errs = [...new Set(r.results.filter((x) => !x.correct).map((x) => x.id))];
  const titles = { jour: 'Session du jour terminée !', rafale: 'Fin de la rafale !', erreurs: 'Erreurs revues !', normal: 'Session terminée !' };
  $app.innerHTML = `<section class="recap c-${r.matiere.couleur}">
    <div class="stroop-zone"><div class="bubble"><span class="who">Stroop</span>${n ? (ok / n >= 0.8 ? 'Wahou, quelle forme ! Je fais la fête.' : ok / n >= 0.5 ? 'Beau travail, ça rentre !' : 'Chaque erreur d’aujourd’hui, c’est une réussite de demain.') : 'On se refait ça bientôt ?'}</div>${stroopImg('fete')}</div>
    <h1>${titles[r.kind] || titles.normal}</h1>
    <div class="stats">
      <div class="stat"><b>${n}</b><span>réponses</span></div>
      <div class="stat"><b>${n ? pct(Math.round((ok / n) * 100)) : '–'}</b><span>réussite</span></div>
      <div class="stat"><b>${up}</b><span>${up > 1 ? 'montées' : 'montée'} de boîte</span></div>
    </div>
    ${r.matiere.negatif ? `<div class="chip m">Score avec points négatifs : ${r.score}</div>` : ''}
    ${down ? `<p class="muted small" style="margin:0">${plural(down, 'élément')} ${down > 1 ? 'sont redescendus' : 'est redescendu'} en boîte 1 : ${down > 1 ? 'ils reviendront' : 'il reviendra'} vite.</p>` : ''}
    <div class="actions" style="width:100%">
      ${errs.length ? `<button class="btn soft block" id="again">${ic('redo')}Revoir mes ${plural(errs.length, 'erreur')}</button>` : ''}
      <a class="btn primary block" href="#/matiere/${encodeURIComponent(r.code)}">Retour à ${esc(r.code)}</a>
      <a class="btn plain block" href="#/">Accueil</a>
    </div></section>`;
  document.getElementById('again')?.addEventListener('click', () => {
    clearSaved();
    session = { code: r.code, kind: 'erreurs', ids: shuffle(errs), i: 0, started: Date.now(), endsAt: null, results: [], score: 0 };
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
  const totalRep = keys.reduce((a, k) => a + (u.jours[k] || 0), 0);
  const all = await Promise.all(S.matieres().map(matiereStats));
  // 5 dernières semaines
  const d = new Date(); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow - 28);
  let cal = '';
  for (let w = 0; w < 5; w++) {
    cal += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px">';
    for (let i = 0; i < 7; i++) {
      const k = today(d); const n = u.jours[k] || 0; const fut = k > today();
      const lvl = n === 0 ? 0 : n < 10 ? 1 : n < 30 ? 2 : 3;
      const bg = fut ? 'transparent' : ['var(--ghost)', '#FFD9BD', '#FFB27A', '#FF8A3D'][lvl];
      cal += `<span title="${k} : ${n}" aria-label="${k} : ${plural(n, 'réponse')}" style="aspect-ratio:1;border-radius:10px;background:${bg};${k === today() ? 'outline:2px dashed var(--ink);outline-offset:-2px' : ''}"></span>`;
      d.setDate(d.getDate() + 1);
    }
    cal += '</div>';
  }
  $app.innerHTML = `<h1>Progrès</h1>
    <div class="stats">
      <div class="stat"><b>${s}</b><span>série actuelle</span></div>
      <div class="stat"><b>${best}</b><span>record</span></div>
      <div class="stat"><b>${totalRep}</b><span>réponses</span></div>
    </div>
    <div class="card" style="padding:14px;display:flex;flex-direction:column;gap:6px">
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;text-align:center" class="small muted">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((x) => `<span>${x}</span>`).join('')}</div>
      ${cal}
    </div>
    <h2 class="section-title">Par matière</h2>
    <div class="list">${all.filter((x) => x.contenu).map((x) => `
      <a class="card c-${x.m.couleur}" href="#/matiere/${encodeURIComponent(x.m.code)}" style="padding:14px;display:flex;flex-direction:column;gap:8px;text-decoration:none">
        <div class="between"><b class="title" style="color:var(--m-ink)">${esc(x.m.code)}</b><b>${pct(x.maitrise)}</b></div>
        <span class="bar"><span style="width:${x.maitrise}%"></span></span>
        <span class="small muted">${x.due} à revoir · ${x.neufs} jamais ${x.neufs > 1 ? 'vus' : 'vu'} · ${plural(x.erreurs, 'erreur')} en attente</span>
      </a>`).join('') || '<div class="card empty muted">Rien pour l’instant : importe du contenu pour commencer.</div>'}</div>`;
}

/* ================= Profil ================= */
async function viewProfil() {
  tabbar('#/profil'); setHalo(null);
  const u = S.getUser();
  const theme = localStorage.getItem('theme') || 'auto';
  const flags = await S.allFlags();
  $app.innerHTML = `<h1>Profil</h1>
    <div class="card" style="padding:16px;display:flex;flex-direction:column;gap:12px">
      <label class="field">Prénom<input id="prenom" value="${esc(u.prenom || '')}" autocomplete="given-name"></label>
      <div class="field">Apparence<div class="seg" role="group">${[['auto', 'Auto'], ['clair', 'Clair'], ['sombre', 'Sombre']].map(([k, l]) => `<button data-th="${k}" aria-pressed="${theme === k}">${l}</button>`).join('')}</div></div>
      <label class="field">Semestre en cours<input id="sem" value="${esc(u.semestre || '')}" placeholder="ex. L1-S2"></label>
    </div>
    ${S.isAdmin() ? `<div class="card" style="padding:16px;display:flex;flex-direction:column;gap:12px">
      <h2 class="section-title">Importer du contenu</h2>
      <p class="muted small" style="margin:0">Choisis le fichier .json que Claude t’a préparé. S’il existe déjà pour cette matière, il est remplacé ; ta progression est conservée.</p>
      <label class="btn primary block">${ic('upload')}Choisir un fichier<input type="file" id="file" accept=".json,application/json" class="sr"></label>
      <div id="imp"></div>
    </div>
    <div class="card" style="padding:16px;display:flex;flex-direction:column;gap:12px">
      <h2 class="section-title">Invitées · ${(S.getAcces()?.membres || []).length}</h2>
      <p class="muted small" style="margin:0">Ces personnes voient la même bibliothèque que toi, avec leur propre progression. Elles doivent se connecter avec cette adresse.</p>
      <div class="list">${(S.getAcces()?.membres || []).map((e) => `<div class="between"><span>${esc(e)}</span><button class="flag-btn" data-rm="${esc(e)}">Retirer</button></div>`).join('')}</div>
      <form id="inv" class="row"><label class="sr" for="invmail">Adresse e-mail</label><input id="invmail" type="email" placeholder="adresse@gmail.com" style="flex:1;border:2px solid var(--line);background:var(--card);border-radius:14px;padding:12px 14px;font-size:16px;min-width:0"><button class="btn primary" type="submit">Inviter</button></form>
    </div>` : `<div class="card" style="padding:16px;display:flex;flex-direction:column;gap:8px">
      <h2 class="section-title">Bibliothèque partagée</h2>
      <p class="muted small" style="margin:0">${S.libOk() ? 'Tu as accès au contenu commun. Ta progression n’appartient qu’à toi.' : `Tu n’as pas encore accès au contenu commun. Donne cette adresse à l’admin : <b>${esc(auth.currentUser?.email || '')}</b>`}</p>
    </div>`}
    <div class="card" style="padding:16px;display:flex;flex-direction:column;gap:12px">
      <h2 class="section-title">Signalements · ${flags.length}</h2>
      ${flags.length ? `<div class="list">${flags.map((f) => `<div class="between" style="align-items:flex-start"><div><b class="small">${esc(f.matiere)} · ${esc(f.item.id)}</b><div class="small muted">${esc(f.item.recto || f.item.question)}</div>${f.flag.note ? `<div class="small">« ${esc(f.flag.note)} »</div>` : ''}</div><button class="flag-btn" data-unflag="${esc(f.matiere)}|${esc(f.item.id)}">Retirer</button></div>`).join('')}</div>
      <button class="btn plain block" id="copyflags">${ic('copy')}Copier pour Claude</button>` : '<p class="muted small" style="margin:0">Aucun signalement. Pendant une session, touche « Signaler » sous une carte qui te semble fausse.</p>'}
    </div>
    <div class="card" style="padding:16px;display:flex;flex-direction:column;gap:12px">
      <h2 class="section-title">Mes données</h2>
      <button class="btn plain block" id="export">${ic('download')}Exporter mes données</button>
      <button class="btn no block" id="logout">Me déconnecter</button>
      <p class="muted small" style="margin:0;text-align:center">${esc(auth.currentUser?.email || '')} · version ${VERSION}</p>
    </div>`;
  document.getElementById('prenom').onchange = (e) => S.saveUser({ prenom: e.target.value.trim() }).then(() => toast('Enregistré'));
  document.getElementById('sem').onchange = (e) => S.saveUser({ semestre: e.target.value.trim() || 'L1-S1' }).then(() => toast('Enregistré'));
  $app.querySelectorAll('[data-th]').forEach((b) => b.onclick = () => { localStorage.setItem('theme', b.dataset.th); S.saveUser({ theme: b.dataset.th }); applyTheme(); viewProfil(); });
  document.getElementById('inv')?.addEventListener('submit', async (e) => {
    e.preventDefault(); const v = document.getElementById('invmail').value.trim();
    if (!v || !v.includes('@')) return toast('Adresse e-mail invalide');
    await S.setMembres([...(S.getAcces()?.membres || []), v]); toast('Invitation enregistrée'); viewProfil();
  });
  $app.querySelectorAll('[data-rm]').forEach((b) => b.onclick = async () => { await S.setMembres((S.getAcces()?.membres || []).filter((x) => x !== b.dataset.rm)); viewProfil(); });
  const fileIn = document.getElementById('file');
  if (fileIn) fileIn.onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const out = document.getElementById('imp');
    try {
      const data = JSON.parse(await file.text());
      const info = await S.importContenu(data);
      out.innerHTML = `<p class="feedback ok"><b>Import réussi !</b>${esc(info.code)} : ${plural(info.nbChapitres, 'chapitre')}, ${plural(info.nbElements, 'élément')}.</p><a class="btn soft block" href="#/matiere/${encodeURIComponent(info.code)}">Voir ${esc(info.code)}</a>`;
    } catch (er) {
      out.innerHTML = `<p class="feedback ko"><b>Import impossible</b>${esc(er.message)}</p>`;
    }
    e.target.value = '';
  };
  $app.querySelectorAll('[data-unflag]').forEach((b) => b.onclick = async () => { const [c, id] = b.dataset.unflag.split('|'); await S.unflagItem(c, id); viewProfil(); });
  document.getElementById('copyflags')?.addEventListener('click', async () => {
    const txt = 'Signalements de mon appli de révisions :\n\n' + flags.map((f) => `- ${f.matiere} · ${f.item.id} · « ${f.item.recto || f.item.question} »${f.flag.note ? ` → ${f.flag.note}` : ''}`).join('\n');
    try { await navigator.clipboard.writeText(txt); toast('Copié ! Colle-le dans ta conversation avec Claude'); } catch { toast('Copie impossible sur cet appareil'); }
  });
  document.getElementById('export').onclick = async () => {
    const data = await S.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `stroop-export-${today()}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  document.getElementById('logout').onclick = async () => { session = null; clearSaved(); await signOut(auth); };
}

/* ================= Démarrage ================= */
getRedirectResult(auth).catch((e) => { if (!auth.currentUser) viewLogin('google', authError(e)); });
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (!user) return viewLogin();
  $app.innerHTML = `<div class="splash">${stroopImg('dodo')}<p>Stroop se réveille…</p></div>`;
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

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
