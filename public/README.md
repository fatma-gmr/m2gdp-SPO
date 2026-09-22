# BINOFIT — POC Inscription / Connexion

POC (preuve de concept) réalisé avec **Vue 3 + TypeScript + Vite**, avec une authentification **Firebase Auth par lien magique (e-mail, sans mot de passe)** et un **Backend Cloudflare Worker API**.

## Fonctionnalités

1. **Inscription** (`/inscription`) — prénom, nom, e-mail, sport pratiqué, localisation.
2. **Connexion** (`/connexion`) — envoi d'un lien magique par e-mail, aucune saisie de mot de passe.
3. **Accueil** (`/accueil`) — profil de l'utilisateur connecté, accessible uniquement après authentification.
4. **Backend API Worker** (`workers/`) — API Cloudflare Worker avec support CORS et endpoint `/api/health`.

## Configuration Firebase (obligatoire avant de lancer le projet)

1. Crée un projet sur la [console Firebase](https://console.firebase.google.com).
2. Ajoute une application **Web** au projet et récupère la configuration (`apiKey`, `authDomain`, …).
3. Dans **Authentication > Sign-in method**, active le fournisseur **E-mail/Password**, puis active l'option **Lien e-mail (connexion sans mot de passe)**.
4. Dans **Authentication > Settings > Authorized domains**, vérifie que `localhost` est présent (par défaut) et ajoute ton domaine de production le cas échéant.
5. Copie `.env.example` en `.env` à la racine de `public/` et renseigne les valeurs :

   ```bash
   cp .env.example .env
   ```

## Lancer le projet

### Frontend PWA
```bash
cd public
npm install
npm run dev
```

### Backend Cloudflare Worker
```bash
cd workers
npm install
npx wrangler dev
```

## Architecture du POC

- `public/src/firebase.ts` — initialisation de Firebase App / Auth à partir des variables d'environnement.
- `public/src/composables/useAuth.ts` — état d'authentification réactif (utilisateur, profil) + actions (inscription, envoi du lien, finalisation de connexion, déconnexion).
- `public/src/services/profileStore.ts` — persistance du profil (prénom, nom, sport, localisation) en `localStorage`, indexée par e-mail.
- `public/src/router/index.ts` — routes + garde de navigation (redirection selon l'état de connexion) + titres dynamiques de pages.
- `public/src/views/` — `RegisterView`, `LoginView`, `FinishSignInView` (réception du lien magique), `HomeView` (profil).
- `workers/src/index.ts` — point d'entrée Cloudflare Worker API (gestion des requêtes CORS et route `/api/health`).

### Limite connue (POC)

Firebase Auth ne stocke pas nativement le sport ou la localisation : ces champs sont sauvegardés côté client (`localStorage`) lors de l'inscription. Si le lien magique est ouvert sur un **autre appareil/navigateur** que celui de l'inscription, le profil ne sera pas retrouvé automatiquement (l'utilisateur est tout de même connecté avec Firebase Auth, mais son profil BINOFIT n'est pas prérempli). Pour la version de production, ces champs seraient stockés dans **Firestore**, indexés par `uid`.

## Charte graphique

- Noir `#0A0A0A` (fond)
- Vert lime `#4CC800` (accent, boutons, éléments actifs)
- Design **mobile-first**, formulaires optimisés tactile.

