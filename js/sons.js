// Sons de l'appli, style « Doux » : synthétisés en direct (Web Audio), sans fichier.
// Réglages dans Profil (marche/arrêt, volume), mémorisés sur l'appareil.

const KEY = 'stroop-sons';
let ctx = null;

export function getSons() {
  try { return { on: true, vol: 0.6, silencieux: true, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { on: true, vol: 0.6, silencieux: true }; }
}
export function setSons(patch) { localStorage.setItem(KEY, JSON.stringify({ ...getSons(), ...patch })); }

// Session audio iOS (Safari 16.4+). Seul « playback » ignore le bouton silencieux : « transient » et
// « ambient » le respectent tous les deux (WebKit les range dans la catégorie AmbientSound).
// Contrepartie de « playback » : iOS met en pause la musique d'une autre appli au premier son.
const typeVoulu = () => (getSons().silencieux ? 'playback' : 'ambient');
export function sessionAudio() {
  try {
    if (!navigator.audioSession || navigator.audioSession.type === typeVoulu()) return;
    navigator.audioSession.type = typeVoulu();
    // Le contexte Web Audio garde la catégorie qu'il avait à sa création : on le recrée au prochain son.
    if (ctx) { ctx.close().catch(() => {}); ctx = null; }
  } catch {}
}
function audio() {
  sessionAudio();
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

let cible = null; // contexte de rendu hors ligne pendant la fabrication des fichiers son
const ctxSon = () => cible || audio();

function tone(f, t0, dur, { type = 'sine', gain = 0.25, glide = 0, attack = 0.008 } = {}) {
  const c = ctxSon(); if (!c) return;
  const vol = getSons().vol;
  const o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
  const t = c.currentTime + t0;
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (glide) o.frequency.exponentialRampToValueAtTime(f + glide, t + dur * 0.6);
  lp.type = 'lowpass'; lp.frequency.value = 1800;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain * vol + 0.0001, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(lp); lp.connect(g); g.connect(c.destination);
  o.start(t); o.stop(t + dur + 0.05);
}

// Souffle très doux (bruit filtré avec une enveloppe en cloche, sans attaque sèche).
function souffle(t0, dur, gain = 0.06, freq = 650) {
  const c = ctxSon(); if (!c) return;
  const n = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / n) ** 2;
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = b; f.type = 'lowpass'; f.frequency.value = freq; f.Q.value = 0.5; g.gain.value = gain * getSons().vol;
  s.connect(f); f.connect(g); g.connect(c.destination); s.start(c.currentTime + t0);
}

const SONS = {
  tap: () => tone(880, 0, 0.07, { gain: 0.1 }),
  ok: () => { tone(659, 0, 0.14, { gain: 0.22 }); tone(988, 0.09, 0.22, { gain: 0.22 }); },
  ko: () => { tone(311, 0, 0.18, { type: 'triangle', gain: 0.18, glide: -40 }); tone(262, 0.12, 0.26, { type: 'triangle', gain: 0.16, glide: -30 }); },
  flip: () => { souffle(0, 0.22, 0.07, 600); tone(587, 0.03, 0.2, { gain: 0.05, glide: 120, attack: 0.05 }); },
  pair: () => { tone(784, 0, 0.08, { gain: 0.14 }); tone(1175, 0.05, 0.1, { gain: 0.12 }); },
  up: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.07, 0.18, { gain: 0.18 })); },
  tick: () => tone(1320, 0, 0.04, { type: 'square', gain: 0.04 }),
  end: () => { [523, 659, 784].forEach((f, i) => tone(f, i * 0.11, 0.2, { gain: 0.18 })); [523, 659, 784, 1047].forEach((f) => tone(f, 0.38, 0.6, { gain: 0.1 })); },
  sport: () => { [392, 494, 587, 784].forEach((f) => tone(f, 0, 0.5, { type: 'triangle', gain: 0.09 })); tone(1175, 0.15, 0.35, { gain: 0.1 }); },
  pause: () => { tone(784, 0, 0.12, { gain: 0.15 }); tone(587, 0.1, 0.18, { gain: 0.15 }); },
  reprise: () => { tone(587, 0, 0.12, { gain: 0.15 }); tone(784, 0.1, 0.18, { gain: 0.15 }); },
  // Navigation et interface (plus discrets que les sons du quiz)
  nav: () => tone(660, 0, 0.06, { gain: 0.06 }),
  tab: () => { tone(740, 0, 0.06, { gain: 0.06 }); tone(988, 0.04, 0.07, { gain: 0.05 }); },
  go: () => { tone(523, 0, 0.12, { gain: 0.14 }); tone(784, 0.07, 0.18, { gain: 0.14 }); },
  check: () => tone(1047, 0, 0.07, { gain: 0.07 }),
  on: () => { tone(660, 0, 0.07, { gain: 0.1 }); tone(880, 0.05, 0.09, { gain: 0.1 }); },
  off: () => { tone(880, 0, 0.07, { gain: 0.08 }); tone(660, 0.05, 0.09, { gain: 0.08 }); },
  sheet: () => { souffle(0, 0.16, 0.04, 900); tone(523, 0, 0.14, { gain: 0.04, glide: 160, attack: 0.04 }); },
  stroop: () => { tone(420, 0, 0.14, { gain: 0.16, glide: 520, attack: 0.01 }); tone(700, 0.12, 0.16, { gain: 0.12, glide: 400 }); }
};

let silence = false; // mode « avant de dormir » : aucun son
export const setSilence = (v) => { silence = !!v; };
// ---- Mode silencieux (iPhone) ----
// Sur iOS, un son Web Audio suit le bouton silencieux, alors qu'un élément <audio> (comme le mode écoute)
// est joué quoi qu'il arrive. Avec l'option « Même en mode silencieux », chaque son est donc rendu une fois
// en petit fichier WAV (OfflineAudioContext), puis joué par des éléments <audio> réutilisés.
const SR = 22050;
const fichiers = {}; let volFichiers = null; let rendu = null;
const lecteurs = []; let prochain = 0;

function wav(buf) {
  const d = buf.getChannelData(0), n = d.length, v = new DataView(new ArrayBuffer(44 + n * 2));
  const w = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, SR, true); v.setUint32(28, SR * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 0x7fff, true);
  return URL.createObjectURL(new Blob([v], { type: 'audio/wav' }));
}
async function rendreTout() {
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (!OAC) return;
  const vol = getSons().vol;
  for (const nom of Object.keys(SONS)) {
    const c = new OAC(1, Math.round(SR * 1.1), SR);
    cible = c; try { SONS[nom](); } finally { cible = null; }
    const buf = await c.startRendering();
    if (fichiers[nom]) URL.revokeObjectURL(fichiers[nom]);
    fichiers[nom] = wav(buf);
  }
  volFichiers = vol;
}
function preparer() {
  if (!rendu || volFichiers !== getSons().vol) rendu = rendreTout().catch(() => {});
  return rendu;
}
// Au premier toucher, on « déverrouille » quelques lecteurs (iOS n'autorise la lecture qu'après un geste).
function deverrouiller() {
  if (lecteurs.length || !getSons().silencieux) return;
  sessionAudio();
  for (let i = 0; i < 4; i++) {
    const a = new Audio(); a.preload = 'auto'; a.setAttribute('playsinline', '');
    a.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YQAAAAA=';
    a.play().catch(() => {}); lecteurs.push(a);
  }
  preparer();
}
if (typeof window !== 'undefined') {
  for (const ev of ['pointerdown', 'touchend', 'keydown']) window.addEventListener(ev, deverrouiller, { capture: true, passive: true });
}
function jouerFichier(nom) {
  if (!fichiers[nom] || volFichiers !== getSons().vol) { preparer().then(() => { if (fichiers[nom]) jouerFichier(nom); }); return; }
  sessionAudio();
  let a = lecteurs[prochain % Math.max(1, lecteurs.length)]; prochain++;
  if (!a) { a = new Audio(); lecteurs.push(a); }
  try { a.pause(); a.src = fichiers[nom]; a.currentTime = 0; } catch {}
  a.play().catch(() => {});
}

export function son(nom) {
  if (silence || !getSons().on || !SONS[nom]) return;
  try { if (getSons().silencieux) jouerFichier(nom); else SONS[nom](); } catch {}
}
