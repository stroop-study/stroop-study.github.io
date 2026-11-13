// Notifications push : abonnement de l'appareil et réglages.
// L'envoi est fait chaque jour par un petit programme planifié sur GitHub (dossier notif/).
import { app } from './firebase.js';
import { vapidKey } from './firebase-config.js';
import * as S from './store.js';

const ua = navigator.userAgent;
export const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
export const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
export const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const ready = () => !!vapidKey;

/** État lisible pour l'interface. */
export function etat() {
  if (!ready()) return 'bientot';
  if (isIOS && !isStandalone()) return 'installer';
  if (!supported()) return 'impossible';
  if (Notification.permission === 'denied') return 'refuse';
  return S.getNotif().actif && Notification.permission === 'granted' ? 'actif' : 'inactif';
}

/** Demande l'autorisation (doit être appelé depuis un geste : clic) puis enregistre l'appareil. */
export async function activer() {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return false;
  const { getMessaging, getToken } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js');
  const reg = await navigator.serviceWorker.ready;
  const token = await getToken(getMessaging(app), { vapidKey, serviceWorkerRegistration: reg });
  if (!token) return false;
  await S.saveNotif({ actif: true, tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris', tokens: { [token]: Date.now() } });
  localStorage.setItem('stroop-notif-token', token);
  return true;
}

export async function desactiver() { await S.saveNotif({ actif: false }); }

/** Faut-il proposer d'activer les rappels à l'ouverture ? (au plus 3 fois, espacées d'une semaine) */
export function proposer(u) {
  if (etat() !== 'inactif' || Notification.permission !== 'default') return false;
  if (!Object.keys(u.jours || {}).length) return false; // après une première révision
  let inv = {};
  try { inv = JSON.parse(localStorage.getItem('stroop-notif-invite') || '{}'); } catch {}
  if ((inv.n || 0) >= 3) return false;
  return !inv.t || Date.now() - inv.t > 7 * 86400000;
}
export function reporter() {
  let inv = {};
  try { inv = JSON.parse(localStorage.getItem('stroop-notif-invite') || '{}'); } catch {}
  localStorage.setItem('stroop-notif-invite', JSON.stringify({ n: (inv.n || 0) + 1, t: Date.now() }));
}
