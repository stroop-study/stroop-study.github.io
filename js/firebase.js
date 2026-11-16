// Initialisation Firebase (SDK modulaire hébergé dans vendor/, sans outil de build ni CDN).
import { initializeApp } from '../vendor/firebase/firebase-app.js';
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, sendEmailVerification,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut,
  setPersistence, browserLocalPersistence
} from '../vendor/firebase/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, getDoc, getDocFromCache, setDoc, updateDoc, deleteField, collection, getDocs, getDocsFromCache, writeBatch, increment
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
