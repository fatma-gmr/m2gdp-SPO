# BINOFIT

Application web mobile-first qui connecte des sportifs pour pratiquer ensemble de manière
ponctuelle : un utilisateur trouve des partenaires proches (sport, niveau, disponibilités),
leur propose une activité (sport, date, lieu), puis échange avec eux par messages.

## Liens

- Application : https://bino-fit.vercel.app
- API (Swagger UI) : https://binofit-api.siamak036.workers.dev/docs
- Dépôt : https://github.com/fatma-gmr/m2gdp-SPO

## Stack

| Couche          | Technologie                                             |
| --------------- | ------------------------------------------------------- |
| Front           | Vue 3, Vite, TypeScript, Shadcn-Vue, Leaflet — Vercel   |
| API             | Cloudflare Workers, TypeScript, Hono                    |
| Base de données | Supabase Postgres (Paris)                               |
| Connexion       | Firebase Authentication (lien magique par e-mail)       |

## Structure

| Dossier / fichier               | Contenu                                                  |
| ------------------------------- | -------------------------------------------------------- |
| `public/`                       | Front Vue 3 (PWA mobile-first)                           |
| `workers/`                      | API Cloudflare Workers                                   |
| `specs/`                        | Contrat OpenAPI (`.json`, `.yml`), `schema.sql`, modèle  |
| `docs/`                         | Guide technique et diagrammes                            |
| `BINOFIT v4 Wireframes.dc.html` | Maquettes                                                |
| `agents.md`                     | Stack, structure et conventions du projet                |

## Démarrage rapide

```bash
cd workers && npm install && cp .dev.vars.example .dev.vars && npm run dev   # API : http://localhost:8787
cd public && npm install && cp .env.example .env && npm run dev              # Front : http://localhost:5173
```

Une commande par terminal, depuis la racine du dépôt. Renseigner d'abord `SUPABASE_SECRET_KEY` dans `workers/.dev.vars` et les variables de
`public/.env` (voir le [guide technique](docs/guide-technique.md#lancer-en-local)).

## Captures d'écran

<!-- À compléter : ajouter ici les captures d'écran de l'application. -->

## Documentation

- [Guide technique](docs/guide-technique.md) : architecture, lancement, déploiement,
  variables d'environnement, workflow git, fonctionnalités, reste à faire
- [Modèle de données](specs/data-model.md) et [schéma SQL](specs/schema.sql)
- Diagrammes : [Entité-Association](docs/data-model.md), [classes UML](docs/diagramme-uml.md)
- Contrat de l'API : [openapi.json](specs/openapi.json) (source), [openapi.yml](specs/openapi.yml) (généré)
- API : [workers/README.md](workers/README.md)
