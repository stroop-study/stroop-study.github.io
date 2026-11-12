// Initialisation Firebase (SDK modulaire chargé depuis le CDN de Google, sans outil de build).
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, sendEmailVerification,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut,
  setPersistence, browserLocalPersistence
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, getDoc, setDoc, updateDoc, deleteField, collection, getDocs, writeBatch
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
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
  doc, getDoc, setDoc, updateDoc, deleteField, collection, getDocs, writeBatch
};
