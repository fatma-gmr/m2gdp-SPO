# BINOFIT - Application de matching sportif

## Concept

Application qui connecte des sportifs pour pratiquer ensemble de manière ponctuelle.

## Stack technique

- Frontend: Vue 3 + Vite + TypeScript + Shadcn-Vue (/public), hébergé sur Vercel
- Backend: API Cloudflare Workers en TypeScript avec Hono (/workers)
- Base de données: Supabase Postgres (projet hébergé à Paris), schéma dans /specs/schema.sql — toutes les données, messages compris
- Auth: Firebase Authentication, uniquement pour la connexion (lien magique par e-mail) et le jeton d'identité vérifié par le Worker
- Carte: LeafletJS
- Géolocalisation: six zones prédéfinies autour de Lyon dans public/src/services/location.ts, sans géocodage (Google Places n'est pas utilisé par le code)
- Ancien hébergement du front encore configuré : Firebase Hosting (public/firebase.json, public/.firebaserc ; origine https://binofit-a36cf.web.app encore autorisée par le CORS)

## Structure

- /public → Frontend PWA mobile-first
- /workers → Backend API Cloudflare
- /docs → Documentation technique
- /specs → Spécifications OpenAPI (openapi.json), schéma SQL (schema.sql) et modèle de données (data-model.md)
- Maquettes : `BINOFIT v4 Wireframes.dc.html` à la racine
- /tests et /design : n'existent pas encore dans le dépôt (tests Playwright prévus)

## Commandes

- cd public && npm run dev → Démarrer le frontend (Vite, http://localhost:5173)
- cd public && npm run build → Build de production (vue-tsc -b && vite build, sortie dans public/dist)
- cd workers && npm run dev (ou npx wrangler dev) → Démarrer le backend (http://localhost:8787)
- cd workers && npm run typecheck → Vérification TypeScript du Worker
- cd workers && npm run deploy → Déployer le Worker (wrangler deploy)

## Conventions

- Réponses de l'API en camelCase, base de données en snake_case : la conversion se fait uniquement dans workers/src/lib/dbMapper.ts.
- Toutes les routes de l'API vérifient le jeton Firebase (`Authorization: Bearer <jeton>`, middleware workers/src/middleware/auth.ts), sauf /api/health, /docs et /openapi.json (3 routes publiques, 13 routes protégées).
- Les créations (POST /activities, POST /conversations, POST /favorites) exigent en plus un profil existant (middleware workers/src/middleware/profile.ts, erreur 403 profile_required).
- Une branche par sujet ; jamais de commit sur main (passer par une pull request).
- Aucune clé ni secret dans le dépôt : les secrets vont dans .dev.vars (local, ignoré par git) ou dans les secrets Wrangler / variables Vercel.
