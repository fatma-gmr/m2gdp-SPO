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
