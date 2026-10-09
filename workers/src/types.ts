/**
 * BINOFIT API — types du domaine, alignés sur /specs/data-model.md et /specs/openapi.json.
 */

export const SPORTS = [
  'musculation',
  'course_a_pied',
  'football',
  'basketball',
  'natation',
  'cyclisme',
  'yoga',
  'boxe',
  'crossfit',
  'tennis',
  'autre',
] as const
export type Sport = (typeof SPORTS)[number]

export const LEVELS = ['debutant', 'intermediaire', 'avance', 'expert'] as const
export type Level = (typeof LEVELS)[number]

export const DAYS_OF_WEEK = [
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
  'dimanche',
] as const
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number]

export interface GeoPoint {
  lat: number
  lng: number
  city?: string
}

export interface SportPractice {
  sport: Sport
  level: Level
}

export interface AvailabilitySlot {
  dayOfWeek: DayOfWeek
  startTime: string
  endTime: string
}

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  avatarUrl?: string | null
  bio?: string | null
  location: GeoPoint
  sports: SportPractice[]
  availability: AvailabilitySlot[]
  createdAt: string
  updatedAt: string
}

export type UserUpdate = Partial<
  Pick<User, 'firstName' | 'lastName' | 'avatarUrl' | 'bio' | 'location' | 'sports' | 'availability'>
>

/**
 * Résultat de GET /users : un `User` enrichi de `distanceKm` (arrondi à 1 décimale)
 * quand la recherche est géolocalisée (lat/lng fournis). Absent sinon.
 */
export interface UserSearchResult extends User {
  distanceKm?: number
}

export const ACTIVITY_STATUSES = ['en_attente', 'acceptee', 'refusee', 'terminee'] as const
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number]

export const MEDIA_TYPES = ['image', 'video'] as const
export type MediaType = (typeof MEDIA_TYPES)[number]

export interface Lieu {
  nom: string
  lat: number
  lng: number
}

export interface Media {
  url: string
  type: MediaType
}

/**
 * Une activité est une proposition ponctuelle d'un utilisateur (`createdBy`) à un
 * autre (`guestId`) — pas une annonce ouverte avec quota de places. `guestId` doit
 * toujours être différent de `createdBy`.
 */
export interface Activity {
  id: string
  createdBy: string
  guestId: string
  sport: Sport
  startAt: string
  lieu: Lieu
  message: string
  status: ActivityStatus
  conversationId?: string | null
  createdAt: string
  media?: Media | null
}

export type ActivityCreate = Pick<Activity, 'guestId' | 'sport' | 'startAt' | 'lieu' | 'message'> & {
  media?: Media | null
}

export interface LastMessagePreview {
  text: string
  senderId: string
  sentAt: string
}

/** Métadonnées d'une conversation (Firestore) ; le contenu est dans la Realtime Database. */
export interface Conversation {
  id: string
  participantIds: string[]
  activityId?: string | null
  lastMessage?: LastMessagePreview | null
  createdAt: string
  updatedAt: string
}

/** Message stocké dans la Realtime Database sous `messages/{conversationId}/{id}`. */
export interface Message {
  id: string
  conversationId: string
  senderId: string
  text: string
  sentAt: string
  readBy: string[]
}

export const FAVORITE_TARGET_TYPES = ['user', 'activity'] as const
export type FavoriteTargetType = (typeof FAVORITE_TARGET_TYPES)[number]

export interface Favorite {
  id: string
  userId: string
  targetType: FavoriteTargetType
  targetId: string
  createdAt: string
}
