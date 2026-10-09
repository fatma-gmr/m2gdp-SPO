# BINOFIT — Modèle de données

Ce document décrit les entités métier de BINOFIT, leurs champs, et leur répartition entre
les bases de données du projet (voir `agents.md`) :

- **Firestore** → `users`, `activities`, `favorites`, `conversations` (métadonnées)
- **Firebase Realtime Database** → `messages` (contenu des conversations, pour la latence temps réel)

## Enumérations partagées

### `Sport`
```
musculation | course_a_pied | football | basketball | natation | cyclisme | yoga | boxe | crossfit | tennis | autre
```

### `Level` (niveau de pratique)
```
debutant | intermediaire | avance | expert
```

### `DayOfWeek`
```
lundi | mardi | mercredi | jeudi | vendredi | samedi | dimanche
```

### `ActivityStatus`
```
en_attente | acceptee | refusee | terminee
```

### `MediaType`
```
image | video
```

---

## 1. `users` (Firestore, collection `users`, doc id = `uid` Firebase Auth)

Profil d'un sportif inscrit.

| Champ            | Type                              | Description                                                             |
|-------------------|------------------------------------|---------------------------------------------------------------------------|
| `id`              | string (uid)                      | Identifiant, égal à l'uid Firebase Auth                                  |
| `email`           | string                             | E-mail unique, normalisé en minuscules                                   |
| `firstName`       | string                             | Prénom                                                                    |
| `lastName`        | string                             | Nom de famille                                                           |
| `avatarUrl`       | string? (nullable)                 | URL de la photo de profil                                                 |
| `bio`             | string? (nullable)                 | Courte description libre                                                 |
| `location`        | `GeoPoint`                         | Position de référence (ville / lieu de pratique habituel)                |
| `sports`          | `SportPractice[]`                  | Sports pratiqués, avec niveau par sport                                  |
| `availability`    | `AvailabilitySlot[]`               | Créneaux de disponibilité récurrents                                     |
| `createdAt`       | string (ISO 8601)                  | Date de création du profil                                               |
| `updatedAt`       | string (ISO 8601)                  | Date de dernière mise à jour du profil                                   |

**`GeoPoint`**

| Champ  | Type   | Description              |
|--------|--------|---------------------------|
| `lat`  | number | Latitude                  |
| `lng`  | number | Longitude                 |
| `city` | string | Ville affichée (libellé)  |

**`SportPractice`**

| Champ   | Type     | Description            |
|---------|----------|--------------------------|
| `sport` | `Sport`  | Discipline pratiquée     |
| `level` | `Level`  | Niveau sur cette discipline |

**`AvailabilitySlot`**

| Champ       | Type         | Description                        |
|-------------|--------------|--------------------------------------|
| `dayOfWeek` | `DayOfWeek`  | Jour de la semaine                   |
| `startTime` | string (`HH:mm`) | Heure de début du créneau        |
| `endTime`   | string (`HH:mm`) | Heure de fin du créneau          |

> Index Firestore nécessaire : géo-requêtes (`lat`/`lng`) combinées à des filtres sur
> `sports.sport`, `sports.level` et `availability.dayOfWeek` — en pratique, un index
> composite classique ne suffit pas pour le rayon (`maxKm`) ; on calcule une
> bounding box (geohash) côté Worker puis on filtre la distance exacte (Haversine)
> en mémoire sur le résultat réduit.

---

## 2. `activities` (Firestore, collection `activities`)

Une activité BINOFIT est une **proposition ponctuelle d'un utilisateur (créateur) à un
autre (invité)** — pas une annonce ouverte avec quota de places. Il n'y a donc ni
niveau requis, ni nombre de participants, ni liste de participants : juste un
créateur, un invité, et une réponse (acceptée, refusée, ou en attente).

| Champ            | Type               | Description                                                                 |
|-------------------|--------------------|---------------------------------------------------------------------------------|
| `id`              | string             | Identifiant de l'activité                                                  |
| `createdBy`       | string (uid)       | Référence vers `users.id` — utilisateur à l'origine de la proposition      |
| `guestId`         | string (uid)       | Référence vers `users.id` — utilisateur invité (toujours ≠ `createdBy`)   |
| `sport`           | `Sport`            | Discipline proposée                                                        |
| `startAt`         | string (ISO 8601)  | Date/heure proposée pour la session                                        |
| `lieu`            | `Lieu`             | Lieu proposé pour la session                                               |
| `message`         | string             | Message d'invitation rédigé par le créateur                               |
| `status`          | `ActivityStatus`   | État courant de la proposition                                            |
| `conversationId`  | string? (nullable) | Référence optionnelle vers `conversations.id` (une fois la discussion ouverte) |
| `createdAt`       | string (ISO 8601)  | Date d'envoi de la proposition                                            |
| `media`           | `Media`? (nullable)| Photo/vidéo optionnelle jointe à la proposition                           |

**`Lieu`**

| Champ | Type   | Description                                      |
|-------|--------|---------------------------------------------------|
| `nom` | string | Nom du lieu proposé (ex : "Parc de la Tête d'Or") |
| `lat` | number | Latitude                                           |
| `lng` | number | Longitude                                          |

**`Media`**

| Champ  | Type        | Description                      |
|--------|-------------|------------------------------------|
| `url`  | string      | URL du média                      |
| `type` | `MediaType` | Nature du média (`image`/`video`) |

> Contrainte applicative : `guestId` doit toujours être différent de `createdBy`
> (une proposition ne peut pas se faire à soi-même).
>
> `conversationId` duplique volontairement `conversations.activityId` (voir section 3) :
> Firestore ne permet pas les jointures, donc chaque entité porte une référence directe
> vers l'autre pour éviter une requête supplémentaire côté client/Worker.

---

## 3. `conversations` (Firestore, collection `conversations` — métadonnées uniquement)

| Champ            | Type                    | Description                                                              |
|-------------------|-------------------------|-----------------------------------------------------------------------------|
| `id`              | string                  | Identifiant de la conversation (sert aussi de clé dans Realtime DB)         |
| `participantIds`  | string[]                | Références vers `users.id` des participants (2 pour un 1-à-1)              |
| `activityId`      | string? (nullable)      | Référence optionnelle vers `activities.id` si la conversation en découle    |
| `lastMessage`     | `LastMessagePreview`?   | Aperçu dénormalisé du dernier message, pour l'affichage liste rapide        |
| `createdAt`       | string (ISO 8601)       | Date de création de la conversation                                        |
| `updatedAt`       | string (ISO 8601)       | Date du dernier message (pour le tri)                                      |

**`LastMessagePreview`**

| Champ      | Type               | Description                 |
|-------------|--------------------|-------------------------------|
| `text`      | string             | Extrait du dernier message    |
| `senderId`  | string (uid)       | Auteur du dernier message     |
| `sentAt`    | string (ISO 8601)  | Horodatage du dernier message |

---

## 4. `messages` (Firebase Realtime Database, chemin `messages/{conversationId}/{messageId}`)

| Champ            | Type               | Description                                                     |
|-------------------|--------------------|---------------------------------------------------------------------|
| `id`              | string             | Identifiant du message                                             |
| `conversationId`  | string             | Référence vers `conversations.id`                                   |
| `senderId`        | string (uid)       | Référence vers `users.id` de l'auteur                               |
| `text`            | string             | Contenu du message                                                  |
| `sentAt`          | string (ISO 8601)  | Horodatage d'envoi                                                  |
| `readBy`          | string[]           | Liste des `users.id` ayant lu le message                            |

---

## 5. `favorites` (Firestore, collection `favorites`)

Un utilisateur peut mettre en favori un autre utilisateur (partenaire sportif) ou une activité.

| Champ         | Type                    | Description                                              |
|----------------|-------------------------|--------------------------------------------------------------|
| `id`           | string                  | Identifiant du favori                                       |
| `userId`       | string (uid)            | Référence vers `users.id` — propriétaire du favori          |
| `targetType`   | `'user' \| 'activity'`  | Type de cible mise en favori                                |
| `targetId`     | string                  | Référence vers `users.id` ou `activities.id` selon le type  |
| `createdAt`    | string (ISO 8601)       | Date d'ajout                                                 |

> Contrainte d'unicité applicative : un couple (`userId`, `targetType`, `targetId`) ne doit
> apparaître qu'une seule fois.

---

## Relations

- `users` 1 —— N `activities` en tant que créateur (`activities.createdBy`)
- `users` 1 —— N `activities` en tant qu'invité (`activities.guestId`)
- `activities` 0..1 —— 1 `conversations` (via `activities.conversationId`, miroir de `conversations.activityId`)
- `users` N —— N `users` (conversations, via `conversations.participantIds`)
- `conversations` 1 —— N `messages` (via `conversationId`)
- `users` 1 —— N `favorites`, chaque favori pointant vers un `user` ou une `activity`

Voir le diagramme Entité-Association dans `/docs/data-model.md`.
