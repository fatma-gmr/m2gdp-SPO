# BINOFIT — Diagramme du modèle de données

Diagramme Entité-Association correspondant au modèle décrit dans `/specs/data-model.md`.

```mermaid
erDiagram
    USER ||--o{ ACTIVITY : "crée (creatorId)"
    USER }o--o{ ACTIVITY : "participe (participantIds)"
    USER }o--o{ CONVERSATION : "participe (participantIds)"
    ACTIVITY ||--o{ CONVERSATION : "origine (activityId, optionnel)"
    CONVERSATION ||--o{ MESSAGE : "contient"
    USER ||--o{ MESSAGE : "envoie (senderId)"
    USER ||--o{ FAVORITE : "possède (userId)"
    FAVORITE }o..|| USER : "cible (targetId, si targetType=user)"
    FAVORITE }o..|| ACTIVITY : "cible (targetId, si targetType=activity)"

    USER {
        string id
        string email
        string firstName
        string lastName
        string avatarUrl
        string bio
        GeoPoint location
        SportPractice_array sports
        AvailabilitySlot_array availability
        string createdAt
        string updatedAt
    }

    ACTIVITY {
        string id
        string creatorId
        Sport sport
        Level level
        string title
        string description
        GeoPoint location
        string startAt
        number durationMinutes
        number maxParticipants
        string_array participantIds
        ActivityStatus status
        string createdAt
        string updatedAt
    }

    CONVERSATION {
        string id
        string_array participantIds
        string activityId
        LastMessagePreview lastMessage
        string createdAt
        string updatedAt
    }

    MESSAGE {
        string id
        string conversationId
        string senderId
        string text
        string sentAt
        string_array readBy
    }

    FAVORITE {
        string id
        string userId
        string targetType
        string targetId
        string createdAt
    }
```

## Notes de lecture

- `USER ||--o{ ACTIVITY` : un utilisateur peut créer plusieurs activités (relation 1—N via `creatorId`).
- `USER }o--o{ ACTIVITY` : relation N—N de participation (`activities.participantIds`).
- `USER }o--o{ CONVERSATION` : une conversation a plusieurs participants, un utilisateur a plusieurs conversations.
- `ACTIVITY ||--o{ CONVERSATION` : une conversation peut optionnellement découler d'une activité (`conversations.activityId`).
- `CONVERSATION ||--o{ MESSAGE` : une conversation contient plusieurs messages (stockés dans Firebase Realtime Database).
- `FAVORITE` cible soit un `USER`, soit une `ACTIVITY`, selon `targetType` (relation polymorphe représentée par les deux liens en pointillés).

## Répartition par base de données

| Entité          | Base de données                                                  |
| ---------------- | ----------------------------------------------------------------- |
| `User`         | Firebase Firestore (`users`)                                    |
| `Activity`     | Firebase Firestore (`activities`)                               |
| `Favorite`     | Firebase Firestore (`favorites`)                                |
| `Conversation` | Firebase Firestore (`conversations`) — métadonnées seulement |
| `Message`      | Firebase Realtime Database (`messages/{conversationId}`)        |
