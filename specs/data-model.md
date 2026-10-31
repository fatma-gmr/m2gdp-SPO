# BINOFIT — Modèle de données

Ce document décrit les entités métier de BINOFIT, leurs champs, et leur stockage
(voir `agents.md`). Le schéma de référence est `/specs/schema.sql`.

- **Supabase Postgres** (projet hébergé à Paris) → les 8 tables : `users`, `user_sports`,
  `user_availability`, `activities`, `conversations`, `participants`, `messages`, `favorites`
- **Firebase Authentication** → uniquement la connexion (lien magique par e-mail) et le
  jeton d'identité ; aucune donnée métier n'y est stockée

Seul le Worker (`/workers`) accède à la base, avec la clé secrète Supabase. Les colonnes
sont en `snake_case` ; l'API expose des objets en `camelCase`, parfois imbriqués
(`location`, `lieu`, `media`, `sports`, `availability`, `participantIds`, `lastMessage`).
La conversion se fait uniquement dans `workers/src/lib/dbMapper.ts`. Les tableaux
ci-dessous donnent la colonne Postgres et le champ API correspondant.

## Enumérations partagées

Les colonnes concernées sont de type `text`. `status`, `media_type` et `target_type` sont
contraintes par un `check` en base ; `sport`, `level` et `day_of_week` sont validées par
le Worker (`workers/src/types.ts`), pas par la base.

### `Sport` (`user_sports.sport`, `activities.sport`)
```
musculation | course_a_pied | football | basketball | natation | cyclisme | yoga | boxe | crossfit | tennis | autre
```

### `Level` (`user_sports.level`, niveau de pratique)
```
debutant | intermediaire | avance | expert
```

### `DayOfWeek` (`user_availability.day_of_week`)
```
lundi | mardi | mercredi | jeudi | vendredi | samedi | dimanche
```

### `ActivityStatus` (`activities.status`, `check` en base, défaut `en_attente`)
```
en_attente | acceptee | refusee | terminee
```

Transitions autorisées par le Worker (`canTransitionStatus`) : l'invité fait passer
`en_attente` → `acceptee` ou `refusee` ; le créateur ou l'invité fait passer
`acceptee` → `terminee`. Toute autre transition reçoit 403.

### `MediaType` (`activities.media_type`, `check` en base)
```
image | video
```

### `FavoriteTargetType` (`favorites.target_type`, `check` en base)
```
user | activity
```

---

## 1. `users` (clé `id` = uid Firebase Auth)

Profil d'un sportif inscrit.

| Colonne       | Type Postgres              | Champ API             | Description                                              |
|---------------|----------------------------|-----------------------|----------------------------------------------------------|
| `id`          | text, clé primaire         | `id`                  | Identifiant, égal à l'uid Firebase Auth                  |
| `email`       | text, nullable             | `email`               | E-mail, toujours pris dans le jeton, jamais dans le corps |
| `first_name`  | text, non nul              | `firstName`           | Prénom                                                   |
| `last_name`   | text, non nul              | `lastName`            | Nom de famille                                           |
| `bio`         | text, nullable             | `bio`                 | Courte description libre                                 |
| `avatar_url`  | text, nullable             | `avatarUrl`           | URL de la photo de profil                                |
| `city`        | text, nullable             | `location.city`       | Ville affichée (libellé), omise si `null`                |
| `lat`         | double precision, non nul  | `location.lat`        | Latitude                                                 |
| `lng`         | double precision, non nul  | `location.lng`        | Longitude                                                |
| `created_at`  | timestamptz, défaut `now()`| `createdAt`           | Date de création du profil (ISO 8601)                    |
| `updated_at`  | timestamptz, défaut `now()`| `updatedAt`           | Date de dernière mise à jour (ISO 8601)                  |

Champs API calculés depuis les tables liées : `sports` (`user_sports`) et
`availability` (`user_availability`). `GET /users` ajoute `distanceKm` quand la
recherche est géolocalisée (filtre et tri Haversine faits dans le Worker).

---

## 2. `user_sports` (sports pratiqués d'un utilisateur)

| Colonne    | Type Postgres                                  | Champ API (`sports[]`) | Description                  |
|------------|------------------------------------------------|------------------------|------------------------------|
| `user_id`  | text, non nul → `users.id` (`on delete cascade`)| —                      | Propriétaire                 |
| `sport`    | text, non nul (`Sport`)                        | `sport`                | Discipline pratiquée         |
| `level`    | text, non nul (`Level`)                        | `level`                | Niveau sur cette discipline  |

Clé primaire : (`user_id`, `sport`) — un seul niveau par sport et par utilisateur.
Quand `sports` est fourni à `PUT /users/{id}`, les lignes sont entièrement remplacées.

---

## 3. `user_availability` (créneaux de disponibilité récurrents)

| Colonne        | Type Postgres                                   | Champ API (`availability[]`) | Description              |
|----------------|-------------------------------------------------|------------------------------|--------------------------|
| `id`           | bigint, identité générée, clé primaire          | —                            | Ordre d'insertion        |
| `user_id`      | text, non nul → `users.id` (`on delete cascade`) | —                            | Propriétaire             |
| `day_of_week`  | text, non nul (`DayOfWeek`)                     | `dayOfWeek`                  | Jour de la semaine       |
| `start_time`   | text, non nul (`HH:mm`)                         | `startTime`                  | Heure de début           |
| `end_time`     | text, non nul (`HH:mm`)                         | `endTime`                    | Heure de fin             |

Le format `HH:mm` est vérifié par le Worker. Les créneaux sont renvoyés triés par `id`,
donc dans l'ordre envoyé par le client ; ils sont entièrement remplacés quand
`availability` est fourni à `PUT /users/{id}`.

---

## 4. `activities`

Une activité BINOFIT est une **proposition ponctuelle d'un utilisateur (créateur) à un
autre (invité)** — pas une annonce ouverte avec quota de places. Il n'y a donc ni
niveau requis, ni nombre de participants, ni liste de participants : juste un
créateur, un invité, et une réponse (acceptée, refusée, ou en attente).

| Colonne       | Type Postgres                          | Champ API        | Description                                    |
|---------------|----------------------------------------|------------------|------------------------------------------------|
| `id`          | text, clé primaire, défaut uuid        | `id`             | Identifiant de l'activité                      |
| `created_by`  | text, non nul → `users.id`             | `createdBy`      | Auteur de la proposition (uid du jeton)        |
| `guest_id`    | text, non nul → `users.id`             | `guestId`        | Utilisateur invité                             |
| `sport`       | text, non nul (`Sport`)                | `sport`          | Discipline proposée                            |
| `start_at`    | timestamptz, non nul                   | `startAt`        | Date/heure proposée (ISO 8601)                 |
| `lieu_nom`    | text, non nul                          | `lieu.nom`       | Nom du lieu (ex : "Parc de la Tête d'Or")      |
| `lieu_lat`    | double precision, non nul              | `lieu.lat`       | Latitude du lieu                               |
| `lieu_lng`    | double precision, non nul              | `lieu.lng`       | Longitude du lieu                              |
| `message`     | text, non nul                          | `message`        | Message d'invitation                           |
| `status`      | text, non nul, défaut `en_attente`     | `status`         | `ActivityStatus`                               |
| `media_url`   | text, nullable                         | `media.url`      | URL d'une photo/vidéo jointe                   |
| `media_type`  | text, nullable (`MediaType`)           | `media.type`     | Nature du média                                |
| `created_at`  | timestamptz, défaut `now()`            | `createdAt`      | Date d'envoi (ISO 8601)                        |

- `media` vaut `null` dans l'API si `media_url` ou `media_type` est `null`.
- `conversationId` n'est pas une colonne : il est déduit de `conversations.activity_id`
  (première conversation liée à l'activité, sinon `null`).
- Contrainte `check (created_by <> guest_id)` : on ne peut pas se proposer une activité
  à soi-même (le Worker renvoie 400 `invalid_guest` avant d'atteindre la base).

---

## 5. `conversations` (métadonnées)

| Colonne        | Type Postgres                                        | Champ API     | Description                                   |
|----------------|------------------------------------------------------|---------------|-----------------------------------------------|
| `id`           | text, clé primaire, défaut uuid                      | `id`          | Identifiant de la conversation                |
| `activity_id`  | text, nullable → `activities.id` (`on delete set null`)| `activityId`  | Activité d'origine, si la conversation en découle |
| `created_at`   | timestamptz, défaut `now()`                          | `createdAt`   | Date de création                              |
| `updated_at`   | timestamptz, défaut `now()`                          | `updatedAt`   | Rafraîchi à chaque message (tri de la liste)  |

Champs API calculés : `participantIds` (table `participants`) et `lastMessage`
(`{ text, senderId, sentAt }`, message le plus récent de `messages`, ou `null`).

---

## 6. `participants` (membres d'une conversation)

| Colonne            | Type Postgres                                           | Description                |
|--------------------|---------------------------------------------------------|----------------------------|
| `conversation_id`  | text, non nul → `conversations.id` (`on delete cascade`) | Conversation               |
| `user_id`          | text, non nul → `users.id` (`on delete cascade`)         | Participant                |

Clé primaire : (`conversation_id`, `user_id`). Les conversations créées par l'API sont
en 1-à-1 (2 participants). Seuls les participants peuvent lire une conversation ou y
écrire (403 `forbidden` sinon).

---

## 7. `messages`

| Colonne            | Type Postgres                                           | Champ API         | Description                   |
|--------------------|---------------------------------------------------------|-------------------|-------------------------------|
| `id`               | text, clé primaire, défaut uuid                         | `id`              | Identifiant du message        |
| `conversation_id`  | text, non nul → `conversations.id` (`on delete cascade`) | `conversationId`  | Conversation                  |
| `sender_id`        | text, non nul → `users.id`                              | `senderId`        | Auteur (uid du jeton)         |
| `text`             | text, non nul                                           | `text`            | Contenu du message            |
| `sent_at`          | timestamptz, défaut `now()`                             | `sentAt`          | Horodatage d'envoi (ISO 8601) |

Pas de suivi de lecture : il n'existe aucune colonne de type « lu par ».

---

## 8. `favorites`

Un utilisateur peut mettre en favori un autre utilisateur (partenaire sportif) ou une activité.

| Colonne        | Type Postgres                                    | Champ API     | Description                                         |
|----------------|--------------------------------------------------|---------------|-----------------------------------------------------|
| `id`           | text, clé primaire, défaut uuid                  | `id`          | Identifiant du favori                               |
| `user_id`      | text, non nul → `users.id` (`on delete cascade`) | `userId`      | Propriétaire du favori                              |
| `target_type`  | text, non nul (`FavoriteTargetType`)             | `targetType`  | Type de cible                                       |
| `target_id`    | text, non nul                                    | `targetId`    | `users.id` ou `activities.id` selon `target_type`   |
| `created_at`   | timestamptz, défaut `now()`                      | `createdAt`   | Date d'ajout (ISO 8601)                             |

- Contrainte `unique (user_id, target_type, target_id)` : un doublon renvoie 409.
- `target_id` n'a pas de clé étrangère (cible polymorphe) : l'existence de la cible est
  vérifiée par le Worker.

---

## Relations

- `users` 1 —— N `user_sports` (`user_sports.user_id`)
- `users` 1 —— N `user_availability` (`user_availability.user_id`)
- `users` 1 —— N `activities` en tant que créateur (`activities.created_by`)
- `users` 1 —— N `activities` en tant qu'invité (`activities.guest_id`)
- `activities` 1 —— 0..N `conversations` (`conversations.activity_id`, nullable)
- `users` N —— N `conversations` via la table de liaison `participants`
- `conversations` 1 —— N `messages` (`messages.conversation_id`)
- `users` 1 —— N `messages` en tant qu'auteur (`messages.sender_id`)
- `users` 1 —— N `favorites` (`favorites.user_id`), chaque favori pointant vers un
  `user` ou une `activity` selon `target_type`

Voir le diagramme Entité-Association dans `/docs/data-model.md`.

---

## Erreur 403 `profile_required`

Format des erreurs de l'API : `{ "error": "<message>", "code": "<code>" }`.

`profile_required` désigne le refus (403) d'une requête faite avec un jeton Firebase
valide par un utilisateur qui n'a pas encore de ligne dans `users` (profil non créé via
`PUT /users/{id}`).

Cette erreur est renvoyée avant toute autre vérification par `POST /activities`,
`POST /conversations` et `POST /favorites` (middleware `workers/src/middleware/profile.ts`).
Réponse : `403 { "error": "Complète ton profil pour continuer", "code": "profile_required" }`.
Le front doit alors rediriger vers l'écran Profil ; cette redirection n'est pas encore
implémentée dans `public/`. Les autres 403 de l'API portent le code `forbidden`.
