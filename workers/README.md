# BINOFIT — API (Cloudflare Workers)

API REST de BINOFIT, écrite en TypeScript avec Hono et déployée sur Cloudflare Workers
(https://binofit-api.siamak036.workers.dev).

## Rôle

- Vérifier le jeton d'identité Firebase de chaque requête (`Authorization: Bearer <jeton>`),
  avec les clés publiques Google (`src/middleware/auth.ts`).
- Valider les données et les droits (profil personnel, participants d'une conversation,
  transitions de statut d'une activité…).
- Lire et écrire dans Supabase Postgres avec la clé secrète du projet (`src/lib/supabase.ts`) :
  le front n'accède jamais directement à la base.
- Convertir les lignes Postgres (snake_case) en réponses JSON (camelCase), uniquement dans
  `src/lib/dbMapper.ts`.

Contrat complet : `specs/openapi.json`, servi sur `/docs` (Swagger UI) et `/openapi.json`.
Modèle de données : `specs/data-model.md`.

## Routes

Publiques (sans jeton) :

| Méthode | Route            | Rôle                               |
| ------- | ---------------- | ---------------------------------- |
| GET     | `/api/health`    | État du service                    |
| GET     | `/docs`          | Swagger UI                         |
| GET     | `/openapi.json`  | Contrat OpenAPI                    |

Avec jeton Firebase :

| Méthode | Route                          | Rôle                                                                                   |
| ------- | ------------------------------ | -------------------------------------------------------------------------------------- |
| GET     | `/users`                       | Recherche de profils (`lat`, `lng`, `maxKm`, `sport`, `level`, `availability`), avec `distanceKm` |
| GET     | `/users/{id}`                  | Profil d'un utilisateur                                                                |
| PUT     | `/users/{id}`                  | Crée (201) ou met à jour (200) son propre profil                                       |
| POST    | `/activities`                  | Propose une activité à un autre utilisateur (statut `en_attente`)                      |
| GET     | `/activities`                  | Ses activités (créateur ou invité)                                                     |
| PATCH   | `/activities/{id}/status`      | Accepter, refuser ou terminer une activité                                             |
| GET     | `/conversations`               | Ses conversations, les plus récentes d'abord                                           |
| POST    | `/conversations`               | Ouvre (201) ou retrouve (200) une conversation 1-à-1, liée ou non à une activité       |
| GET     | `/conversations/{id}/messages` | Messages d'une conversation (`limit`, `before`), réservé aux participants              |
| POST    | `/messages`                    | Envoie un message dans une conversation dont on est participant                        |
| GET     | `/favorites`                   | Ses favoris                                                                            |
| POST    | `/favorites`                   | Ajoute un utilisateur ou une activité en favori (409 si déjà présent)                  |
| DELETE  | `/favorites/{targetId}`        | Retire un favori                                                                       |

Soit 16 routes : 3 publiques et 13 protégées. `POST /activities`, `POST /conversations` et
`POST /favorites` exigent en plus que l'utilisateur ait déjà un profil (ligne dans `users`),
sinon `403 profile_required` (`src/middleware/profile.ts`).

Erreurs : `{ "error": "<message>", "code": "<code>" }` (ex. `missing_token`, `invalid_token`,
`token_expired`, `forbidden`, `profile_required`, `not_found`, `database_error`).
Toute route inconnue renvoie `404 not_found`.

## Lancer en local

```bash
nvm use 22
npm install
cp .dev.vars.example .dev.vars   # renseigner SUPABASE_SECRET_KEY, jamais commité
npm run dev                      # http://localhost:8787
npm run typecheck                # vérification TypeScript
```

## Tester

### 1. Remplir la base : `scripts/seed.mjs`

Insère des données fictives autour de Lyon : 35 utilisateurs (`user-001`…), avec sports et
créneaux, 90 activités, 12 conversations avec leurs messages et 20 favoris. Le script est
relançable sans créer de doublons (ids fixes, upsert).

Prérequis : tables créées dans Supabase (SQL Editor > coller `specs/schema.sql` > Run).

```bash
node --env-file=.dev.vars scripts/seed.mjs
```

Le script lit `SUPABASE_URL` et `SUPABASE_SECRET_KEY` dans l'environnement, sans les
afficher. `.dev.vars.example` ne contient que la clé : ajouter aussi `SUPABASE_URL` (la
valeur de `wrangler.toml`) dans `.dev.vars`, ou la passer devant la commande :
`SUPABASE_URL=https://<ref>.supabase.co node --env-file=.dev.vars scripts/seed.mjs`.
`npm run seed` lance le même script mais sans `--env-file` : les deux variables doivent
alors déjà être exportées.

### 2. Obtenir un jeton : `scripts/get-test-token.mjs`

Crée (ou récupère) l'utilisateur Firebase `user-001` (ou l'uid passé en argument), puis
affiche uniquement son ID token Firebase sur la sortie standard.

```bash
GOOGLE_APPLICATION_CREDENTIALS=/chemin/vers/service-account.json \
FIREBASE_WEB_API_KEY=<clé API web Firebase> \
npm run test-token [uid]
```

### 3. Appeler l'API

```bash
TOKEN=$(GOOGLE_APPLICATION_CREDENTIALS=... FIREBASE_WEB_API_KEY=... npm run --silent test-token)
curl -H "Authorization: Bearer $TOKEN" http://localhost:8787/users/user-001
```

Le jeton peut aussi être collé dans « Authorize » sur `/docs`.

## Déployer

```bash
npx wrangler secret put SUPABASE_SECRET_KEY   # une fois
npm run deploy
```
