# Stroop · Révisions

Application web de révisions (PWA) pour mes études de psychologie, avec Stroop la loutre.

- **Code** : HTML, CSS et JavaScript, sans outil de build.
- **Hébergement** : GitHub Pages.
- **Données** : Firebase (Authentication + Firestore), hors ligne grâce au cache local.
- **Contenu** : jamais stocké dans ce dépôt. Il est importé depuis l'appli (Profil → Importer) sous forme de fichier JSON (`format: "app-revisions/contenu"`) et rangé dans Firestore, derrière une connexion.

## Structure

| Fichier | Rôle |
|---|---|
| `index.html` | Page unique de l'appli |
| `css/app.css` | Styles, thèmes clair et sombre, couleurs des matières |
| `js/app.js` | Routeur et écrans (accueil, matières, session, récap, progrès, profil) |
| `js/store.js` | Lecture et écriture dans Firestore |
| `js/leitner.js` | Boîte de Leitner, série, maîtrise |
| `js/firebase.js` | Initialisation Firebase |
| `sw.js` | Service worker (ouverture hors ligne) |
| `firestore.rules` | Règles de sécurité à copier dans la console Firebase |

## Mettre à jour

À chaque modification de fichier de l'appli, augmenter `VERSION` dans `sw.js` pour forcer la mise à jour sur les appareils.
