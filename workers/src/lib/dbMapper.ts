/**
 * BINOFIT API — seul point de conversion entre les lignes Postgres (Supabase, snake_case,
 * colonnes à plat) et les types du domaine exposés par l'API (camelCase, objets imbriqués).
 * Le schéma de référence est /specs/schema.sql.
 */
import type {
  Activity,
  ActivityCreate,
  AvailabilitySlot,
  Conversation,
  Favorite,
  Message,
  SportPractice,
  User,
  UserUpdate,
} from '../types'

// --- Lignes Postgres ---------------------------------------------------------

export interface UserRow {
  id: string
  email: string | null
  first_name: string
  last_name: string
  bio: string | null
  avatar_url: string | null
  city: string | null
  lat: number
  lng: number
  created_at: string
  updated_at: string
  user_sports: { sport: string; level: string }[]
  user_availability: { id: number; day_of_week: string; start_time: string; end_time: string }[]
}

export interface ActivityRow {
  id: string
  created_by: string
  guest_id: string
  sport: string
  start_at: string
  lieu_nom: string
  lieu_lat: number
  lieu_lng: number
  message: string
  status: string
  media_url: string | null
  media_type: string | null
  created_at: string
  conversations: { id: string }[]
}

export interface MessageRow {
  id: string
  conversation_id: string
  sender_id: string
  text: string
  sent_at: string
}

export interface ConversationRow {
  id: string
  activity_id: string | null
  created_at: string
  updated_at: string
  participants: { user_id: string }[]
  messages: Pick<MessageRow, 'text' | 'sender_id' | 'sent_at'>[]
}

export interface FavoriteRow {
  id: string
  user_id: string
  target_type: string
  target_id: string
  created_at: string
}

// --- Colonnes sélectionnées (avec les tables liées embarquées) ----------------

export const USER_SELECT =
  'id, email, first_name, last_name, bio, avatar_url, city, lat, lng, created_at, updated_at, ' +
  'user_sports(sport, level), user_availability(id, day_of_week, start_time, end_time)'

/** `conversations(id)` : conversationId est déduit de conversations.activity_id. */
export const ACTIVITY_SELECT =
  'id, created_by, guest_id, sport, start_at, lieu_nom, lieu_lat, lieu_lng, message, status, ' +
  'media_url, media_type, created_at, conversations(id)'

/**
 * participantIds vient de `participants` ; lastMessage est le message le plus récent
 * de `messages` (tri + limite appliqués sur la table embarquée, voir conversationAccess.ts).
 */
export const CONVERSATION_SELECT =
  'id, activity_id, created_at, updated_at, participants(user_id), messages(text, sender_id, sent_at)'

export const MESSAGE_SELECT = 'id, conversation_id, sender_id, text, sent_at'

export const FAVORITE_SELECT = 'id, user_id, target_type, target_id, created_at'

// --- Ligne → domaine ----------------------------------------------------------

/** Postgres renvoie `2026-10-27T14:57:00.123+00:00` ; l'API expose `2026-10-27T14:57:00.123Z`. */
function toIso(timestamp: string): string {
  return new Date(timestamp).toISOString()
}

export function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email as string,
    firstName: row.first_name,
    lastName: row.last_name,
    avatarUrl: row.avatar_url,
    bio: row.bio,
    location: row.city === null ? { lat: row.lat, lng: row.lng } : { city: row.city, lat: row.lat, lng: row.lng },
    sports: row.user_sports.map(({ sport, level }) => ({ sport, level }) as SportPractice),
    // L'id d'identité suit l'ordre d'insertion : il conserve l'ordre envoyé par le client.
    availability: [...row.user_availability]
      .sort((a, b) => a.id - b.id)
      .map(
        (slot) =>
          ({ dayOfWeek: slot.day_of_week, startTime: slot.start_time, endTime: slot.end_time }) as AvailabilitySlot,
      ),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  }
}

export function rowToActivity(row: ActivityRow): Activity {
  return {
    id: row.id,
    createdBy: row.created_by,
    guestId: row.guest_id,
    sport: row.sport as Activity['sport'],
    startAt: toIso(row.start_at),
    lieu: { nom: row.lieu_nom, lat: row.lieu_lat, lng: row.lieu_lng },
    message: row.message,
    status: row.status as Activity['status'],
    conversationId: row.conversations[0]?.id ?? null,
    createdAt: toIso(row.created_at),
    media:
      row.media_url !== null && row.media_type !== null
        ? { url: row.media_url, type: row.media_type as NonNullable<Activity['media']>['type'] }
        : null,
  }
}

export function rowToConversation(row: ConversationRow): Conversation {
  const last = row.messages[0]
  return {
    id: row.id,
    participantIds: row.participants.map((participant) => participant.user_id),
    activityId: row.activity_id,
    lastMessage: last ? { text: last.text, senderId: last.sender_id, sentAt: toIso(last.sent_at) } : null,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  }
}

export function rowToMessage(row: MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    text: row.text,
    sentAt: toIso(row.sent_at),
  }
}

export function rowToFavorite(row: FavoriteRow): Favorite {
  return {
    id: row.id,
    userId: row.user_id,
    targetType: row.target_type as Favorite['targetType'],
    targetId: row.target_id,
    createdAt: toIso(row.created_at),
  }
}

// --- Domaine → ligne ----------------------------------------------------------

/** Colonnes de `users` correspondant aux champs fournis (sports/availability exclus). */
export function userUpdateToRow(update: UserUpdate): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (update.firstName !== undefined) row.first_name = update.firstName
  if (update.lastName !== undefined) row.last_name = update.lastName
  if (update.avatarUrl !== undefined) row.avatar_url = update.avatarUrl
  if (update.bio !== undefined) row.bio = update.bio
  if (update.location !== undefined) {
    row.city = update.location.city ?? null
    row.lat = update.location.lat
    row.lng = update.location.lng
  }
  return row
}

export function sportsToRows(userId: string, sports: SportPractice[]) {
  return sports.map(({ sport, level }) => ({ user_id: userId, sport, level }))
}

export function availabilityToRows(userId: string, availability: AvailabilitySlot[]) {
  return availability.map(({ dayOfWeek, startTime, endTime }) => ({
    user_id: userId,
    day_of_week: dayOfWeek,
    start_time: startTime,
    end_time: endTime,
  }))
}

export function activityCreateToRow(input: ActivityCreate, createdBy: string) {
  return {
    created_by: createdBy,
    guest_id: input.guestId,
    sport: input.sport,
    start_at: input.startAt,
    lieu_nom: input.lieu.nom,
    lieu_lat: input.lieu.lat,
    lieu_lng: input.lieu.lng,
    message: input.message,
    media_url: input.media?.url ?? null,
    media_type: input.media?.type ?? null,
  }
}
