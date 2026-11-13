// Configuration Firebase du projet "app-revisions".
// Ces valeurs sont publiques par conception : la sécurité repose sur les règles Firestore.
export const firebaseConfig = {
  apiKey: "AIzaSyAe7Sg1HhyBRKMOVFG0SedOU_4nXv8OlbM",
  authDomain: "app-revisions.firebaseapp.com",
  projectId: "app-revisions",
  storageBucket: "app-revisions.firebasestorage.app",
  messagingSenderId: "610917370738",
  appId: "1:610917370738:web:cfcfed8d2044f4e52babeb"
};

// Clé publique « Web Push » (Firebase > Paramètres du projet > Cloud Messaging > Certificats Web Push).
// Publique elle aussi : elle sert seulement à identifier l'appli auprès du service de notifications.
export const vapidKey = 'BO9s98h5eKyDHuFSKO5n7Yi9dBGuMC_vIzBtxfJ8cJI1khINJQ-1k9vF4Xo3m_6ByGNw4sHQBJfzj7XO6IGf0b8';
