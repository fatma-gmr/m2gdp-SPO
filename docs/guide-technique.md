# BINOFIT — Guide technique

Détail technique du projet, sorti du `README.md` racine. Conventions de l'équipe :
[`agents.md`](../agents.md). API : [`workers/README.md`](../workers/README.md). Modèle de
données : [`specs/data-model.md`](../specs/data-model.md), diagrammes
[`docs/data-model.md`](data-model.md) (Entité-Association) et
[`docs/diagramme-uml.md`](diagramme-uml.md) (classes UML).

## Sommaire

1. [Adresses](#adresses)
2. [Architecture](#architecture)
3. [Structure des dossiers](#structure-des-dossiers)
4. [Fonctionnalités](#fonctionnalités)
5. [Lancer en local](#lancer-en-local)
6. [Déployer](#déployer)
7. [Variables d'environnement](#variables-denvironnement)
8. [Workflow git](#workflow-git)
9. [Limites Cloudflare](#limites-cloudflare)
10. [Reste à faire](#reste-à-faire)

## Adresses

| Quoi                     | Adresse                                                    |
| ------------------------ | ---------------------------------------------------------- |
| Site (front)             | https://bino-fit.vercel.app                                |
| API (back)               | https://binofit-api.siamak036.workers.dev                  |
| Documentation de l'API   | https://binofit-api.siamak036.workers.dev/docs (Swagger UI) |
| Contrat OpenAPI          | https://binofit-api.siamak036.workers.dev/openapi.json      |
| Contrat OpenAPI (YAML)   | `specs/openapi.yml`, généré depuis `specs/openapi.json`     |

## Architecture

```
  Navigateur (PWA mobile-first)
  Vue 3 + Vite + TypeScript + Shadcn-Vue + Leaflet
  hébergé sur Vercel
        │                         │
        │ 1. connexion            │ 2. appels HTTPS + "Authorization: Bearer <jeton Firebase>"
        │    (lien magique)       │    réponses JSON en camelCase
        ▼                         ▼
  Firebase Authentication     API Cloudflare Workers (TypeScript, Hono)
  (e-mail + jeton             ├─ vérifie le jeton Firebase (clés publiques Google)
   d'identité uniquement)     ├─ valide les données et les droits
                              └─ dbMapper.ts : camelCase ⇄ snake_case
                                          │
                                          │ 3. PostgREST (clé secrète Supabase)
                                          ▼
                              Supabase Postgres (Paris)
                              users, user_sports, user_availability, activities,
                              conversations, participants, messages, favorites
```

Le front ne parle jamais directement à la base : toutes les données passent par l'API.

## Structure des dossiers

| Dossier / fichier                  | Contenu                                                         |
| ---------------------------------- | --------------------------------------------------------------- |
| `public/`                          | Front Vue 3 (PWA mobile-first)                                  |
| `workers/`                         | API Cloudflare Workers (voir `workers/README.md`)               |
| `specs/`                           | `openapi.json` (contrat de l'API), `schema.sql`, `data-model.md` |
| `docs/`                            | Documentation technique (diagramme du modèle de données)        |
| `BINOFIT v4 Wireframes.dc.html`    | Maquettes                                                       |
| `tests/`, `design/`                | N'existent pas encore dans le dépôt (tests Playwright prévus)   |
| `agents.md`                        | Stack, structure et conventions du projet                       |
| `docs/guide-technique.md`          | Ce guide                                                        |
| `docs/diagramme-uml.md`            | Diagramme de classes UML des 8 entités                          |
| `specs/openapi.yml`                | Contrat OpenAPI en YAML, généré depuis `openapi.json`           |

## Fonctionnalités

Écrans présents dans `public/src/views`, avec leur route (`public/src/router/index.ts`).
La barre du bas (`BottomNav.vue`) contient quatre onglets : Découvrir, Carte, Messages, Profil.
Les routes marquées « connecté » redirigent vers `/connexion` sans session Firebase ;
`/inscription` et `/connexion` redirigent vers `/decouvrir` si l'utilisateur est déjà connecté.

| Route                  | Écran                      | Accès     | Ce que fait l'écran |
| ---------------------- | -------------------------- | --------- | ------------------- |
| `/inscription`         | `RegisterView.vue`         | visiteur  | Formulaire (prénom, nom, e-mail, sport, localisation) qui garde ces champs dans le `localStorage` du navigateur et envoie un lien magique Firebase. |
| `/connexion`           | `LoginView.vue`            | visiteur  | Saisie de l'e-mail et envoi d'un lien magique de connexion, sans mot de passe. |
| `/finish-signin`       | `FinishSignInView.vue`     | tous      | Finalise la connexion à l'ouverture du lien (redemande l'e-mail s'il n'est pas retrouvé), puis redirige vers `/decouvrir`. |
| `/decouvrir`           | `DiscoverView.vue`         | connecté  | Liste les sportifs à moins de 10 km de la localisation du profil (Lyon par défaut), via `GET /users`. |
| `/recherche`           | `SearchView.vue`           | connecté  | Recherche de sportifs filtrée par distance, sport, niveau et jour de disponibilité. |
| `/carte`               | `MapView.vue`              | connecté  | Carte Leaflet (tuiles OpenStreetMap) avec un rayon de 10 km et un repère par sportif, cliquable. |
| `/messages`            | `ConversationsView.vue`    | connecté  | Liste des conversations, les plus récentes d'abord. |
| `/messages/:id`        | `ChatView.vue`             | connecté  | Messages d'une conversation (100 derniers) et envoi d'un nouveau message. |
| `/profil`              | `ProfileView.vue`          | connecté  | Édition du profil (nom, bio, zone, sports et niveaux, disponibilités) via `PUT /users/{id}`, lien vers « Mes activités » et déconnexion. |
| `/activites`           | `ActivitiesView.vue`       | connecté  | Activités à venir et passées ; l'invité peut accepter ou refuser, le créateur ou l'invité peut terminer une activité acceptée. |
| `/activites/nouvelle`  | `ActivityCreateView.vue`   | connecté  | Formulaire pour proposer une activité (sport, date, lieu, message) à un sportif, via `POST /activities`. |
| `/athletes/:id`        | `AthleteView.vue`          | connecté  | Profil public d'un sportif (bio, sports, disponibilités) avec boutons pour ouvrir une conversation ou proposer une activité. |

Autres routes : `/` et toute route inconnue redirigent vers `/connexion` ; `/accueil`
(ancienne page d'accueil) redirige vers `/decouvrir`.

La localisation du profil se choisit parmi six zones prédéfinies autour de Lyon
(`public/src/services/location.ts`), sans géocodage ni API externe. Les fonctions
d'appel aux favoris existent dans `public/src/services/api.ts`, mais aucun écran ne les
utilise encore.

## Lancer en local

Prérequis : Node.js 22 (via nvm). Le dépôt n'impose pas de version (ni `.nvmrc` ni champ `engines`).

### Back (API)

```bash
cd workers
nvm use 22
npm install
cp .dev.vars.example .dev.vars   # puis renseigner SUPABASE_SECRET_KEY (jamais commité)
npm run dev                      # wrangler dev, API sur http://localhost:8787
```

`FIREBASE_PROJECT_ID`, `SUPABASE_URL` et `ENVIRONMENT` sont déjà dans `workers/wrangler.toml`.

### Front

```bash
cd public
nvm use 22
npm install
cp .env.example .env             # puis renseigner les variables listées ci-dessous
npm run dev                      # Vite, sur http://localhost:5173
```

Variables du fichier `public/.env` (sans valeurs ici) :

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_API_BASE_URL=
```

Pour utiliser l'API locale, `VITE_API_BASE_URL` pointe vers `http://localhost:8787`
(origine `http://localhost:5173` autorisée par le CORS de l'API).

## Déployer

### API (Cloudflare Workers)

```bash
cd workers
npx wrangler secret put SUPABASE_SECRET_KEY   # une seule fois, ou pour changer la clé
npm run deploy                                # wrangler deploy
```

Toute nouvelle origine du front doit être ajoutée à `ALLOWED_ORIGINS` dans
`workers/src/index.ts`. Origines autorisées aujourd'hui : `https://bino-fit.vercel.app`,
`http://localhost:5173` et `https://binofit-a36cf.web.app` (ancien hébergement Firebase).

### Front (Vercel)

Configuration du projet Vercel :

- le front est construit par Vercel depuis le fork GitHub `SiamakSm/BinoFit`, branche `main` ;
- **Root Directory** : `public` ;
- **Framework Preset** : Vite (build `npm run build`, soit `vue-tsc -b && vite build`,
  qui produit `dist/`) ;
- variables d'environnement du projet : les six `VITE_FIREBASE_*` et `VITE_API_BASE_URL`
  (liste ci-dessous) ;
- `public/vercel.json` réécrit toutes les routes vers `/index.html` (routeur Vue), pour que
  les URL comme `/connexion` fonctionnent aussi en accès direct ou après rechargement.

Le domaine `https://bino-fit.vercel.app` doit figurer :

- dans les domaines autorisés de Firebase Authentication (Authentication > Settings >
  Authorized domains), sinon le lien magique est refusé ;
- dans `ALLOWED_ORIGINS` de `workers/src/index.ts` (c'est le cas), sinon le CORS de l'API
  bloque les appels.

Déploiements et previews :

- les URL de preview Vercel sont refusées par le CORS de l'API (elles ne figurent pas dans
  `ALLOWED_ORIGINS` de `workers/src/index.ts`) : pour tester une branche, lancer le front
  en local sur `http://localhost:5173` ;
- après un merge dans le dépôt officiel (`fatma-gmr/m2gdp-SPO`), le fork est mis à jour
  avec `git push myfork main`, ce qui relance le build Vercel.

`public/firebase.json` et `public/.firebaserc` (ancien hébergement Firebase Hosting) sont
toujours présents.

### Base de données (Supabase)

Le schéma de référence est `specs/schema.sql`.

1. Dans le tableau de bord Supabase, ouvrir **SQL Editor**, coller le contenu de
   `specs/schema.sql` et cliquer **Run**.
2. Remplir la base avec les données de test, depuis `workers/` :

   ```bash
   node --env-file=.dev.vars scripts/seed.mjs
   ```

   Le script lit `SUPABASE_URL` et `SUPABASE_SECRET_KEY` dans l'environnement.
   `.dev.vars.example` ne contient que la clé : `SUPABASE_URL` (valeur de
   `workers/wrangler.toml`) doit donc aussi figurer dans `.dev.vars`, ou être passée
   devant la commande (`SUPABASE_URL=https://<ref>.supabase.co node --env-file=.dev.vars scripts/seed.mjs`).
   Détails dans `workers/README.md`.

## Variables d'environnement

Noms seulement : aucune valeur ne doit figurer dans le dépôt.

### Back (`workers/`)

| Variable              | Où                                          | Rôle                                                                 |
| --------------------- | ------------------------------------------- | -------------------------------------------------------------------- |
| `SUPABASE_SECRET_KEY` | secret Wrangler / `.dev.vars` (local)       | Clé secrète Supabase, accès complet à la base. Ne jamais la commiter. |
| `SUPABASE_URL`        | `wrangler.toml` (`[vars]`)                  | URL du projet Supabase                                               |
| `FIREBASE_PROJECT_ID` | `wrangler.toml` (`[vars]`)                  | Vérification des jetons Firebase (audience et émetteur)              |
| `ENVIRONMENT`         | `wrangler.toml` (`[vars]`)                  | Nom de l'environnement (`development`), déclaré dans `env.ts` mais lu nulle part dans le code |

### Front (`public/.env`, et variables du projet Vercel)

| Variable                            | Rôle                                         |
| ----------------------------------- | -------------------------------------------- |
| `VITE_FIREBASE_API_KEY`             | Configuration Firebase Auth (application web) |
| `VITE_FIREBASE_AUTH_DOMAIN`         | Configuration Firebase Auth                  |
| `VITE_FIREBASE_PROJECT_ID`          | Configuration Firebase Auth                  |
| `VITE_FIREBASE_STORAGE_BUCKET`      | Configuration Firebase (application web)     |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Configuration Firebase (application web)     |
| `VITE_FIREBASE_APP_ID`              | Configuration Firebase (application web)     |
| `VITE_API_BASE_URL`                 | Adresse de l'API appelée par le front        |

### Scripts de test (`workers/scripts/`)

| Variable                         | Rôle                                                               |
| -------------------------------- | ------------------------------------------------------------------ |
| `GOOGLE_APPLICATION_CREDENTIALS` | Chemin vers le JSON du compte de service Firebase (`get-test-token.mjs`) |
| `FIREBASE_WEB_API_KEY`           | Clé API web Firebase (`get-test-token.mjs`)                        |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | Accès à la base pour `seed.mjs`                               |

## Workflow git

- Une branche par sujet, préfixée selon sa nature (`feat/…`, `fix/…`, `docs/…`).
- Jamais de commit sur `main` : chaque branche est fusionnée par une pull request vers
  `main` du dépôt `fatma-gmr/m2gdp-SPO`.
- Aucune clé ni secret dans le dépôt : les secrets vont dans `.dev.vars` (local, ignoré
  par git) ou dans les secrets Wrangler / variables Vercel.
- `specs/openapi.json` est la source de vérité du contrat ; après chaque modification,
  régénérer `specs/openapi.yml` (`cd workers && node scripts/openapi-to-yaml.mjs`).

## Limites Cloudflare

Le Worker est sur l'offre gratuite de Cloudflare Workers, limitée à 100 000 requêtes par
jour. Pour rester sous cette limite, le front doit interroger l'API par un polling
raisonnable :

| Écran                                   | Fréquence             |
| --------------------------------------- | --------------------- |
| Conversation ouverte (`/messages/:id`)  | toutes les 3 secondes |
| Listes (activités, conversations)       | toutes les 10 secondes |

Le polling ne tourne que lorsque l'onglet du navigateur est visible.

> Ce polling est prévu mais pas encore implémenté dans `public/` (travail de DEV1) :
> aujourd'hui, les écrans chargent leurs données uniquement à l'ouverture.

## Reste à faire

- **Onglet Activités** : « Mes activités » n'est accessible que depuis l'écran Profil, pas
  depuis la barre du bas.
- **Actualisation automatique** : les écrans chargent leurs données à l'ouverture
  uniquement (pas de rafraîchissement périodique ni de temps réel, y compris dans le chat).
- **Profil obligatoire côté écrans** : l'API renvoie `403 profile_required` sans profil,
  mais le front ne redirige pas encore vers l'écran Profil.
- **Tests automatiques** : aucun test dans le dépôt (tests Playwright prévus).
- **Passage éventuel à Supabase Auth** à la place de Firebase Authentication.
