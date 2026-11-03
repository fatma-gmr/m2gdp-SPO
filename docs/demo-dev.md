# Démo BINOFIT : partie DEV (5 minutes)

Script de la partie technique de la démo : ce qu'on montre minute par minute, les phrases clés, le plan B, la couverture des user stories (calculée à partir du code) et les questions probables.

## À préparer avant la démo

| Quoi | Comment |
|---|---|
| Onglet 1 : page DEV de la vitrine | https://bino-fit.vercel.app/dev.html |
| Onglet 2 : documentation de l'API | https://binofit-api.siamak036.workers.dev/docs |
| Onglet 3 : Supabase | Table Editor du projet (région Paris), sur la table `activities` |
| Onglet 4 : application, **déjà connectée** | https://bino-fit.vercel.app/decouvrir (compte A, profil complet) |
| Onglet 5 : application, 2e compte | Fenêtre privée, compte B déjà connecté (pour accepter la proposition) |
| Jeton pour `/docs` | `cd workers && GOOGLE_APPLICATION_CREDENTIALS=… FIREBASE_WEB_API_KEY=… npm run test-token` (jeton de `user-001`, un profil du seed). Il expire au bout d'une heure : le générer moins d'une heure avant |
| Plan B en local | Node 22, `cd workers && npm run dev` et `cd public && npm run dev` |
| Rapport des tests | `cd tests && npm test` la veille, puis `npm run report` (fonctionne hors ligne) |

⚠️ **Ouvrir les liens magiques la veille** pour les comptes A et B : la session reste ouverte, et on ne dépend ni de la boîte mail ni du quota d'e-mails Firebase.
⚠️ **Ne pas lancer les tests API pendant la démo** : ils écrivent dans la base de production (puis la nettoient).

## Script minute par minute

### 0:00 – 0:45 · L'architecture (onglet 1, page DEV)

On montre la ligne « Ce qui est en ligne ».

> « BINOFIT, c'est trois briques. Le front en Vue 3 sur Vercel. Une API en TypeScript sur Cloudflare Workers. Et Supabase, c'est-à-dire Postgres hébergé à Paris, qui garde toutes les données, messages compris. Firebase ne sert qu'à une chose : la connexion par lien magique, sans mot de passe. »

> « La position est volontairement simple : 6 zones autour de Lyon, sans géocodage. »

### 0:45 – 1:45 · L'API documentée (onglet 2, `/docs`)

1. On montre la liste des routes : 13 routes protégées, plus `/api/health`, `/docs` et `/openapi.json`, qui sont publiques.
2. On lance `GET /users` sans jeton : réponse **401 `missing_token`**.
3. On clique sur **Authorize**, on colle le jeton, puis on lance `GET /users?lat=45.7578&lng=4.832&maxKm=5` : les sportifs sont triés par distance, avec `distanceKm`.

> « Le contrat OpenAPI est notre source de vérité : le front et le back sont écrits à partir de lui. Le Worker vérifie la signature du jeton Firebase sur chaque route. Et pour proposer une activité, ouvrir une conversation ou ajouter un favori, il faut en plus avoir un profil, sinon c'est une erreur 403 `profile_required`. »

### 1:45 – 2:30 · Les données (onglet 3, Supabase)

On fait défiler les tables : `users`, `user_sports`, `user_availability`, `activities`, `conversations`, `participants`, `messages`, `favorites`. On ouvre `activities` et on montre la colonne `status`.

> « 8 tables. Le statut d'une activité est contrôlé deux fois. La base n'accepte que 4 valeurs : en attente, acceptée, refusée, terminée. Et l'API n'autorise que les bonnes transitions : seul l'invité accepte ou refuse, et une activité acceptée peut être marquée terminée par les deux. »

### 2:30 – 3:15 · Le modèle (onglet 1, section « Modèle de données »)

On montre le diagramme UML de la page DEV (sources : `docs/diagramme-uml.md` et `docs/data-model.md`).

> « Un utilisateur pratique plusieurs sports, chacun avec son niveau, et publie des créneaux : un jour, une heure de début, une heure de fin. Une activité relie toujours deux personnes, un créateur et un invité. Elle peut avoir sa conversation. Une conversation a des participants et des messages. »

### 3:15 – 4:30 · L'application en ligne (onglets 4 et 5)

1. **Découvrir** (compte A) : les sportifs proches, triés par distance. On touche le raccourci Tennis.
2. **Carte** : rayon 10 km, on touche un marqueur, puis « Voir le profil ».
3. Sur le profil du compte B : **Proposer une activité** (sport, date, heure, lieu, message), puis on l'envoie.
4. Onglet 5 (compte B) : **Profil → Mes activités → Accepter**. Le statut passe à « Acceptée ».
5. Retour au compte A : **Messages**, on envoie un message. Côté B, on **recharge la page** pour le voir. La pastille des non lus se met à jour toutes les 15 secondes.

> « Tout ce que vous voyez passe par l'API que je viens de montrer : il n'y a aucune donnée en dur dans le front. »

### 4:30 – 5:00 · La qualité et le bilan (onglet 1)

On montre la carte « Tests » de la page DEV, et le rapport Playwright si on a le temps.

> « 71 tests Playwright : 52 sur l'API avec de vrais jetons Firebase, et 19 de bout en bout, où Firebase est simulé, donc aucun e-mail n'est envoyé. Chaque test porte le numéro de sa user story. Côté back, 26 user stories sur 29 sont couvertes. Il reste les favoris dans l'interface, la photo jointe à une proposition, et ensuite le blocage de profils. »

## Plan B

| Problème | Solution |
|---|---|
| Le Wi-Fi de la salle tombe | Partage de connexion du téléphone. Sinon, on passe au local : `wrangler dev` (port 8787) et `npm run dev` (port 5173). La base reste en ligne, il faut quand même une connexion. |
| Pas de connexion du tout | On montre le diagramme et les captures de la vitrine (page Maquette), `specs/openapi.json` et `specs/schema.sql` dans l'éditeur, et le rapport Playwright (`tests/playwright-report/index.html`, hors ligne). |
| La session de l'app a expiré | Ne pas demander de lien en direct. Passer au compte de la fenêtre privée, ou montrer l'API dans `/docs`. |
| Le jeton de `/docs` a expiré (401 `token_expired`) | Relancer `npm run test-token` (10 secondes), ou montrer seulement le 401 sans jeton et la liste des routes. |
| Vercel ou Cloudflare ne répond pas | Basculer sur le local (voir la première ligne). |

## Couverture des user stories (d'après le code)

Le backlog compte **29 user stories** : les 28 d'origine, plus US31 (photo ou vidéo jointe), détachée de US16. US29 et US30 sont à venir et ne sont pas comptées. Les statuts ci-dessous viennent de la lecture du code de `main` le 03/11/2026, pas du backlog.

### Back : 26 US sur 29 (90 %)

Ici, le « back » regroupe l'API Worker, la base Supabase et Firebase Auth.

| US | Back | Où |
|---|---|---|
| US01 Inscription | ✅ | Firebase Auth (lien magique) + `PUT /users/{id}` (création du profil) |
| US02 Connexion | ✅ | Vérification du jeton dans `workers/src/middleware/auth.ts` |
| US03 Déconnexion | — sans objet | Déconnexion Firebase côté navigateur, aucun appel à l'API |
| US04, US05, US06, US07, US26 Profil | ✅ | `PUT` et `GET /users/{id}`, tables `users`, `user_sports`, `user_availability` |
| US08, US09, US10, US11, US12 Recherche | ✅ | `GET /users?lat&lng&maxKm&sport&level&availability`, distance de Haversine |
| US13 Consulter un profil | ✅ | `GET /users/{id}` |
| US27 Filtrer par sexe | ❌ | `GET /users` n'a pas de paramètre `sexe` : le filtre se fait dans le front, après réception de tous les résultats |
| US14, US15 Carte | ✅ | `GET /users` (positions) et `GET /users/{id}` |
| US16, US17, US31 Activités | ✅ | `POST` et `GET /activities` ; l'API accepte déjà `media` (US31) |
| US18, US19, US20, US21 Suivi | ✅ | `PATCH /activities/{id}/status` (règles de transition), `GET /activities` |
| US22, US23, US24 Messagerie | ✅ | `/conversations`, `/conversations/{id}/messages`, `POST /messages` |
| US28 Messages non lus | ❌ | Rien en base : le front compare le dernier message avec une date de lecture gardée dans `localStorage`, donc l'état n'est pas partagé entre appareils |
| US25 Favoris | ✅ | `GET` et `POST /favorites`, `DELETE /favorites/{targetId}` |

Il manque côté back : un paramètre `sexe` sur `GET /users` (US27) et un état lu / non lu en base (US28). US03 n'a pas besoin du back. Si on ne compte que les 28 US qui en ont besoin, le back en couvre 26 sur 28 (93 %).

### Front, scénario minimal : 9 US sur 10 (90 %), 10 sur 10 après la PR #61

Le backlog ne définit plus de « scénario minimal ». J'ai pris les 10 US du parcours « créer son profil, trouver un binôme proche et lui écrire ». **La PO doit confirmer cette liste.**

| US | Front | Où |
|---|---|---|
| US01 Inscription | ✅ | `RegisterView.vue`, `FinishSignInView.vue` |
| US02 Connexion | ✅ | `LoginView.vue`, garde du routeur |
| US04 Création du profil | ✅ | `ProfileView.vue` (prénom, nom, photo, bio, zone, sports et niveaux) |
| US06 Disponibilités | ✅ | `ProfileView.vue` (jour, début, fin) |
| US07 Sports pratiqués | ✅ | `ProfileView.vue` |
| US08 Sportifs proches | ✅ | `DiscoverView.vue`, `AthleteCard.vue` (prénom, sport, niveau, distance) |
| US09 Rayon 1, 5, 10, 20 km | ⏳ | Sur `main` : 1/3/5/10 km (Rechercher) et 2/5/10/20 km (Carte). Corrigé dans la PR #61, pas encore mergée |
| US10 Filtrer par sport | ✅ | `DiscoverView.vue`, `SearchView.vue`, `MapView.vue` |
| US13 Consulter un profil | ✅ | `AthleteView.vue` |
| US23 Envoyer un message | ✅ | `AthleteView.vue`, `ChatView.vue` |

### Ce qui manque encore dans le front (sur les 29 US)

- **US09** : valeurs du rayon (PR #61 en attente de merge).
- **US25** : aucun bouton pour ajouter ou retirer un favori, aucune liste dans le profil. L'API est prête.
- **US31** : aucun champ photo ou vidéo sur « Proposer une activité ». L'API est prête.
- **US17** (détail) : les propositions reçues sont dans « Mes activités », qu'on ouvre depuis le Profil, et non dans un onglet « Activités » de la barre du bas.
- À venir : **US29** et **US30** (bloquer et débloquer), ni back ni front.
- Dans l'interface, sans US : l'onglet « Demandes » affiche « bientôt » et la cloche des notifications ne fait rien.

## Les 5 questions probables du jury

1. **Pourquoi Firebase Auth et Supabase, au lieu d'un seul service ?**
   Firebase gère très bien la connexion par lien magique, sans mot de passe à stocker. Supabase nous donne un vrai Postgres relationnel, avec des contraintes et des clés étrangères, hébergé à Paris. Le Worker fait le lien : il vérifie le jeton Firebase et utilise son `uid` comme identifiant dans Postgres.

2. **Comment l'API est-elle sécurisée ?**
   Les 13 routes protégées vérifient le jeton : signature avec les clés publiques de Google, audience, émetteur et expiration. L'utilisateur vient toujours du jeton, jamais du corps de la requête : on ne modifie que son propre profil et on ne lit que ses conversations. La clé Supabase reste côté Worker, dans un secret Wrangler, et n'est jamais envoyée au navigateur.

3. **Comment calculez-vous la distance ? Est-ce que ça tient la charge ?**
   Avec la formule de Haversine, dans le Worker, depuis la zone choisie (6 zones lyonnaises). Aujourd'hui, l'API charge tous les profils puis filtre : c'est suffisant pour un prototype de 35 profils. Au-delà, on passerait le filtre dans Postgres (PostGIS, ou un cadre géographique).

4. **Comment testez-vous l'application ?**
   71 tests Playwright. 52 testent l'API avec de vrais jetons Firebase, sur des comptes dédiés qui sont nettoyés à la fin : transitions de statut, 401, 403, filtres. 19 sont de bout en bout : vitrine, inscription, routes protégées, avec Firebase simulé pour ne pas envoyer d'e-mails. Chaque test porte le numéro de son US. Limites : pas d'intégration continue, et pas de test des écrans connectés.

5. **Qu'est-ce qui manque, et que feriez-vous ensuite ?**
   Côté front : les favoris et la photo jointe à une proposition, dont l'API est déjà prête, et le rayon 1/5/10/20 km, en cours de relecture. Ensuite, la sécurité avec bloquer et débloquer un profil (US29, US30), des messages en temps réel (aujourd'hui, il faut recharger la conversation, et les non lus se mettent à jour toutes les 15 secondes) et des tests automatiques à chaque pull request.
