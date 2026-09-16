# BINOFIT - Application de matching sportif

## Concept

Application qui connecte des sportifs pour pratiquer ensemble de manière ponctuelle.

## Stack technique

- Frontend: Vue 3 + Vite + TypeScript + Shadcn-Vue (/public)
- Backend: Cloudflare Workers (/workers)
- BDD données: Firebase Firestore
- BDD messages: Firebase Realtime Database
- Auth: Firebase Authentication (lien magique sans mot de passe)
- Hébergement: Firebase Hosting
- Carte: LeafletJS
- Géolocalisation: Google Places API

## Structure

- /public → Frontend PWA mobile-first
- /workers → Backend API Cloudflare
- /docs → Documentation technique
- /design → Maquettes HTML
- /specs → Spécifications OpenAPI + données JSON
- /tests → Tests Playwright

## Commandes

- cd public && npm run dev → Démarrer le frontend
- cd workers && npx wrangler dev → Démarrer le backend
