/**
 * Types de l'API BINOFIT, alignés sur specs/openapi.json.
 * Ne pas modifier sans mettre à jour le contrat.
 */

export type Sport =
  | 'musculation'
  | 'course_a_pied'
  | 'football'
  | 'basketball'
  | 'natation'
  | 'cyclisme'
  | 'yoga'
  | 'boxe'
  | 'crossfit'
  | 'tennis'
  | 'autre'

export type Level = 'debutant' | 'intermediaire' | 'avance' | 'expert'

export type Sexe = 'femme' | 'homme' | 'autre'

export type DayOfWeek =
  | 'lundi'
  | 'mardi'
  | 'mercredi'
  | 'jeudi'
  | 'vendredi'
  | 'samedi'
  | 'dimanche'

export type ActivityStatus = 'en_attente' | 'acceptee' | 'refusee' | 'terminee'

export type MediaType = 'image' | 'video'

export type FavoriteTargetType = 'user' | 'activity'

export interface ApiErrorBody {
  error: string
  code?: string
}

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
  /** Format HH:mm */
  startTime: string
  /** Format HH:mm */
  endTime: string
}

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  avatarUrl?: string | null
  bio?: string | null
  sexe?: Sexe | null
  /** Date de naissance au format YYYY-MM-DD. */
  birthDate?: string | null
  location: GeoPoint
  sports: SportPractice[]
  availability: AvailabilitySlot[]
  createdAt: string
  updatedAt: string
}

/** Résultat de GET /users : `distanceKm` présent seulement si lat et lng sont fournis. */
export interface UserSearchResult extends User {
  distanceKm?: number
}

/** Corps de PUT /users/{id}. Tous les champs sont optionnels en mise à jour. */
export interface UserUpdate {
  firstName?: string
  lastName?: string
  avatarUrl?: string | null
  bio?: string | null
  sexe?: Sexe | null
  birthDate?: string | null
  location?: GeoPoint
  sports?: SportPractice[]
  availability?: AvailabilitySlot[]
}

export interface UserSearchParams {
  lat?: number
  lng?: number
  maxKm?: number
  sport?: Sport
  level?: Level
  availability?: DayOfWeek
}

export interface Lieu {
  nom: string
  lat: number
  lng: number
}

export interface Media {
  url: string
  type: MediaType
}

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

export interface ActivityCreate {
  guestId: string
  sport: Sport
  startAt: string
  lieu: Lieu
  message: string
  media?: Media | null
}

export interface ActivityStatusUpdate {
  status: ActivityStatus
}

export interface LastMessagePreview {
  text: string
  senderId: string
  sentAt: string
}

export interface Conversation {
  id: string
  participantIds: string[]
  activityId?: string | null
  lastMessage?: LastMessagePreview | null
  createdAt: string
  updatedAt: string
}

export interface ConversationCreate {
  participantId: string
  activityId?: string | null
}

export interface Message {
  id: string
  conversationId: string
  senderId: string
  text: string
  sentAt: string
  readBy: string[]
}

export interface MessageCreate {
  conversationId: string
  /** 1 à 2000 caractères */
  text: string
}

export interface Favorite {
  id: string
  userId: string
  targetType: FavoriteTargetType
  targetId: string
  createdAt: string
}

export interface FavoriteCreate {
  targetType: FavoriteTargetType
  targetId: string
}
