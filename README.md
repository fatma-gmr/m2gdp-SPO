<p align="center">
  <img src="public/public/assets/logo-binofit-horizontal.png" alt="BINOFIT" width="320">
</p>

<p align="center"><strong>Trouve ton binôme sportif près de chez toi, pour une séance ponctuelle.</strong></p>

<p align="center">
  <a href="https://bino-fit.vercel.app">Application en ligne</a> ·
  <a href="https://binofit-api.siamak036.workers.dev/docs">Documentation de l'API</a>
</p>

## Captures d'écran

<p align="center">
  <img src="public/public/assets/screens/02-accueil.png" alt="Accueil" width="180">
  <img src="public/public/assets/screens/03-carte.png" alt="Carte" width="180">
  <img src="public/public/assets/screens/04-messages.png" alt="Messages" width="180">
  <img src="public/public/assets/screens/05-profil.png" alt="Profil" width="180">
</p>

## Fonctionnalités

- **Accueil** : les sportifs proches de ta zone, avec leur sport, leur niveau et la distance.
- **Recherche** : filtres distance, sport, niveau, jour de disponibilité, sexe et âge.
- **Carte** : sportifs sur une carte Leaflet, filtres rayon, sport et niveau, bouton « Me localiser ».
- **Messages** : conversations 1-à-1, badge et notification des messages non lus.
- **Activités** : proposer une séance (sport, date, lieu), l'accepter, la refuser ou la terminer.
- **Profil** : photo, bio, sexe, date de naissance, sports et niveaux, disponibilités.

## Stack

Vue 3 + Vite + TypeScript (Vercel) · API Hono sur Cloudflare Workers · Supabase Postgres (Paris) · Firebase Authentication (lien magique par e-mail, connexion uniquement)

## Démarrage rapide

```bash
cd workers && npm install && cp .dev.vars.example .dev.vars && npm run dev   # API : http://localhost:8787
cd public && npm install && cp .env.example .env && npm run dev              # Front : http://localhost:5173
```

Une commande par terminal. Renseigner d'abord `workers/.dev.vars` et `public/.env`
(voir le [guide technique](docs/guide-technique.md#lancer-en-local)).

## Pour aller plus loin

| Document                                               | Contenu                                                  |
| ------------------------------------------------------ | -------------------------------------------------------- |
| [Guide technique](docs/guide-technique.md)             | Architecture, lancement, déploiement, variables, limites |
| [Diagramme Entité-Association](docs/data-model.md)     | Tables et relations                                      |
| [Diagramme de classes UML](docs/diagramme-uml.md)      | Les 8 entités du modèle                                  |
| [Modèle de données](specs/data-model.md)               | Champs, colonnes Postgres et champs de l'API             |
| [Contrat OpenAPI](specs/openapi.json)                  | Routes de l'API (source de vérité)                       |

## Équipe

Projet du cours **Gestion de Projet — M2CIM, 2026/27** : Ali (UX), Fatma (PO),
Hossein et Mohammad (développement).
