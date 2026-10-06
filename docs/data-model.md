# BINOFIT — Diagramme du modèle de données

Diagramme Entité-Association correspondant au modèle décrit dans `/specs/data-model.md`.

```mermaid
erDiagram
    USER ||--o{ ACTIVITY : "propose (createdBy)"
    USER ||--o{ ACTIVITY : "est invité (guestId)"
    USER }o--o{ CONVERSATION : "participe (participantIds)"
    ACTIVITY |o--o| CONVERSATION : "conversationId (optionnel)"
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
        string createdBy
        string guestId
        Sport sport
        string startAt
        Lieu lieu
        string message
        ActivityStatus status
        string conversationId
        string createdAt
        Media media
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

- `USER ||--o{ ACTIVITY` (propose) : un utilisateur peut créer plusieurs activités, en tant que créateur (`createdBy`).
- `USER ||--o{ ACTIVITY` (est invité) : un utilisateur peut recevoir plusieurs propositions, en tant qu'invité (`guestId`) — chaque activité n'a qu'un seul créateur et un seul invité, jamais de liste de participants.
- `USER }o--o{ CONVERSATION` : une conversation a plusieurs participants, un utilisateur a plusieurs conversations.
- `ACTIVITY |o--o| CONVERSATION` : une activité peut optionnellement avoir une conversation associée (`activities.conversationId`), et réciproquement (`conversations.activityId`) — relation 1—1 optionnelle, dupliquée des deux côtés car Firestore ne permet pas les jointures.
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
