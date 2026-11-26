// Initialisation Firebase (SDK modulaire hébergé dans vendor/, sans outil de build ni CDN).
import { initializeApp } from '../vendor/firebase/firebase-app.js';
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, sendEmailVerification,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut,
  setPersistence, browserLocalPersistence
} from '../vendor/firebase/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, getDoc, getDocFromCache, setDoc, updateDoc, deleteField, collection, getDocs, getDocsFromCache, writeBatch, increment,
  terminate, clearIndexedDbPersistence
} from '../vendor/firebase/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(() => {});

let dbInstance;
try {
  // Cache local persistant : l'appli fonctionne hors ligne et se synchronise au retour du réseau.
  dbInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
} catch (e) {
  dbInstance = initializeFirestore(app, {});
}
export const db = dbInstance;

export {
  onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, sendEmailVerification, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, sendPasswordResetEmail, signOut,
  doc, getDoc, getDocFromCache, setDoc, updateDoc, deleteField, collection, getDocs, getDocsFromCache, writeBatch, increment
};

/** Déconnexion complète (audit sécurité du 24/11) : l'appareil oublie le jeton de rappels, les cours et la
 * progression gardés en cache, et les préférences locales liées au compte. Le thème est conservé. */
export async function deconnexionComplete(uid) {
  const jeton = localStorage.getItem('stroop-notif-token');
  if (uid && jeton) {
    try { await updateDoc(doc(db, 'users', uid), { [`notif.tokens.${jeton}`]: deleteField() }); } catch {}
    try { const { getMessaging, deleteToken } = await import('../vendor/firebase/firebase-messaging.js'); await deleteToken(getMessaging(app)); } catch {}
  }
  try { await signOut(auth); } catch {}
  for (const k of Object.keys(localStorage)) if (k.startsWith('stroop-')) localStorage.removeItem(k);
  try { sessionStorage.clear(); } catch {}
  try { await terminate(db); await clearIndexedDbPersistence(db); } catch {}
  location.reload();
}
