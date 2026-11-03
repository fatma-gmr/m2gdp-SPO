# Tests Playwright de BINOFIT

Deux familles de tests, dans ce dossier :

- **`api/`** : tests de l'API Worker d'après `specs/openapi.json`, avec de vrais jetons Firebase.
- **`e2e/`** : tests de bout en bout dans Chromium (vitrine, inscription, connexion, routes protégées), **sans connexion réelle**.

Chaque test porte le numéro de l'US qu'il vérifie (`US07 …`), sauf les tests du site vitrine, qui ne correspondent à aucune US (`Vitrine - …`).

## Prérequis

- **Node.js 22** (Wrangler refuse Node 20). Avec nvm : `nvm use 22`.
- Les dépendances installées dans `public/`, `workers/` et `tests/` :

```bash
cd public && npm install
cd ../workers && npm install
cd ../tests && npm install && npx playwright install chromium
```

- Pour les tests **API** uniquement, ces identifiants locaux (jamais commités) :
  - `workers/.dev.vars` : `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `SUPABASE_SECRET_KEY` ;
  - `public/.env` : `VITE_FIREBASE_API_KEY` (sert de `FIREBASE_WEB_API_KEY`) ;
  - `SUPABASE_URL` est lu dans `workers/wrangler.toml`.

  Les variables d'environnement du même nom sont prioritaires.

## Lancer les tests

Depuis `tests/` :

| Commande | Ce qui est lancé |
|---|---|
| `npm test` | Tous les tests (API + E2E) |
| `npm run test:api` | Tests de l'API seulement |
| `npm run test:e2e` | Tests E2E seulement (aucun identifiant nécessaire) |
| `npm run report` | Ouvre le rapport HTML du dernier lancement (`playwright-report/`) |

Playwright démarre lui-même le Worker (`wrangler dev`, port 8787) et le front (Vite, port 5173), ou réutilise ceux qui tournent déjà. Pour viser une autre adresse : `API_URL=… APP_URL=… npm test`.

## Comment ça marche

### Tests API

1. `api/auth.setup.ts` nettoie les restes éventuels, crée trois comptes Firebase dédiés (`test-e2e-a`, `test-e2e-b`, `test-e2e-sans-profil`, avec un e-mail `@example.com`), obtient leurs jetons avec `workers/scripts/get-test-token.mjs`, puis crée les profils de A et B via `PUT /users/{id}`. Le fichier de compte de service attendu par le script est écrit dans un dossier temporaire du système, puis supprimé.
2. Les tests appellent l'API avec ces jetons.
3. `api/cleanup.teardown.ts` supprime de Supabase tout ce qui appartient aux comptes de test (profils, activités, conversations, messages, favoris), même si des tests ont échoué.

⚠️ Le Worker local utilise **la même base Supabase que la production**. Les profils du seed (`user-001`…) ne sont jamais modifiés, mais les deux profils de test sont visibles dans les recherches pendant le lancement (environ 30 s). Évitez de lancer les tests API pendant une démo.

### Tests E2E

Les appels à Firebase Auth sont interceptés dans le navigateur (`e2e/firebaseMock.ts`) : l'appel `accounts:sendOobCode` est simulé et toute autre requête vers Firebase est bloquée. **Aucun e-mail n'est envoyé et le quota d'e-mails n'est pas consommé.** Les routes protégées sont testées sans compte : elles doivent rediriger vers `/connexion`.

## Tests et user stories

| US | Tests |
|---|---|
| US01 Inscription | E2E : e-mail invalide, formulaire incomplet, lien demandé (simulé) |
| US02 Connexion | E2E : e-mail invalide, 6 routes protégées redirigées. API : 3 routes publiques, 13 routes protégées sans jeton = 401, jeton invalide = 401 |
| US04 Création du profil | API : profil créé et relu, 403 sur le profil d'un autre, 400 si incomplet, 403 `profile_required` sur les 3 créations |
| US05 Modification du profil | API : modification visible immédiatement |
| US06 Disponibilités | API : jour, début, fin remplacés et relus |
| US07 Sports pratiqués | API : sports et niveaux remplacés et relus, sport inconnu = 400 |
| US08 Sportifs proches | API : tri par distance, `distanceKm` |
| US09 Rayon | API : 1, 5, 10, 20 km respectés ; paramètres incomplets = 400 |
| US10, US11, US12 Filtres | API : sport, niveau, jour |
| US13 Consulter un profil | API : profil d'un autre, 404 si inconnu |
| US16 Proposer une activité | API : 201 en attente, 400 soi-même, 404 invité inconnu, 400 corps invalide |
| US17 Recevoir une proposition | API : visible chez l'invité |
| US18, US19, US21 Statuts | API : transitions autorisées et interdites (403), statut inconnu (400) |
| US20 Mes activités | API : 403 sur les activités d'un autre |
| US22, US23, US24 Messagerie | API : conversation créée puis réutilisée, messages envoyés, ordre chronologique, non-participant = 403 |
| US25 Favoris | API : ajout, doublon 409, liste, retrait 204, retrait en double 404 |
| US26 Sexe et date de naissance | API : enregistrés et relus |

Non couvert pour l'instant : les écrans connectés (Découvrir, Carte, Profil, Messages…), car il faudrait une vraie session Firebase dans le navigateur. Ne sont pas couverts non plus US03 (déconnexion), US14 et US15 (carte), US27 (filtre par sexe, fait côté front) et US28 (messages non lus, calculés côté front).
