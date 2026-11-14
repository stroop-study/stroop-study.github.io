// Sons de l'appli, style « Doux » : synthétisés en direct (Web Audio), sans fichier.
// Réglages dans Profil (marche/arrêt, volume), mémorisés sur l'appareil.

const KEY = 'stroop-sons';
let ctx = null;

export function getSons() {
  try { return { on: true, vol: 0.6, silencieux: true, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { on: true, vol: 0.6, silencieux: true }; }
}
export function setSons(patch) { localStorage.setItem(KEY, JSON.stringify({ ...getSons(), ...patch })); }

// Session audio iOS (Safari 16.4+) : « transient » = sons courts qui passent même en mode silencieux,
// en baissant brièvement la musique en cours ; « ambient » = respecte le bouton silencieux.
export function sessionAudio() {
  try { if (navigator.audioSession) navigator.audioSession.type = getSons().silencieux ? 'transient' : 'ambient'; } catch {}
}
function audio() {
  if (!ctx) {
    sessionAudio();
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(f, t0, dur, { type = 'sine', gain = 0.25, glide = 0, attack = 0.008 } = {}) {
  const c = audio(); if (!c) return;
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
  const c = audio(); if (!c) return;
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
export function son(nom) {
  if (silence || !getSons().on || !SONS[nom]) return;
  try { SONS[nom](); } catch {}
}
