/**
 * Validation des corps de requête reçus sur POST /activities et
 * PATCH /activities/{id}/status, et règles de transition de statut.
 */
import { ApiError } from './apiError'
import {
  ACTIVITY_STATUSES,
  MEDIA_TYPES,
  SPORTS,
  type Activity,
  type ActivityCreate,
  type ActivityStatus,
  type Lieu,
  type Media,
} from '../types'

const MESSAGE_MAX_LENGTH = 500

function isLieu(value: unknown): value is Lieu {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Lieu).nom === 'string' &&
    (value as Lieu).nom.trim() !== '' &&
    typeof (value as Lieu).lat === 'number' &&
    typeof (value as Lieu).lng === 'number' &&
    Number.isFinite((value as Lieu).lat) &&
    Number.isFinite((value as Lieu).lng)
  )
}

function isMedia(value: unknown): value is Media {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Media).url === 'string' &&
    URL.canParse((value as Media).url) &&
    MEDIA_TYPES.includes((value as Media).type)
  )
}

/** Valide le corps de POST /activities (hors `createdBy`, déduit du jeton). */
export function validateActivityCreate(body: unknown): ActivityCreate {
  if (typeof body !== 'object' || body === null) {
    throw new ApiError(400, 'invalid_body', 'Le corps de la requête doit être un objet JSON')
  }
  const input = body as Record<string, unknown>

  if (typeof input.guestId !== 'string' || !input.guestId.trim()) {
    throw new ApiError(400, 'invalid_body', 'guestId doit être une chaîne non vide')
  }
  if (!SPORTS.includes(input.sport as ActivityCreate['sport'])) {
    throw new ApiError(400, 'invalid_body', `sport invalide (attendu: ${SPORTS.join(', ')})`)
  }
  if (typeof input.startAt !== 'string' || Number.isNaN(Date.parse(input.startAt))) {
    throw new ApiError(400, 'invalid_body', 'startAt doit être une date ISO 8601')
  }
  if (!isLieu(input.lieu)) {
    throw new ApiError(400, 'invalid_body', 'lieu doit contenir nom, lat et lng valides')
  }
  if (
    typeof input.message !== 'string' ||
    !input.message.trim() ||
    input.message.length > MESSAGE_MAX_LENGTH
  ) {
    throw new ApiError(400, 'invalid_body', `message doit contenir entre 1 et ${MESSAGE_MAX_LENGTH} caractères`)
  }
  if (input.media !== undefined && input.media !== null && !isMedia(input.media)) {
    throw new ApiError(400, 'invalid_body', 'media doit contenir une url valide et un type (image, video)')
  }

  return {
    guestId: input.guestId,
    sport: input.sport as ActivityCreate['sport'],
    startAt: new Date(input.startAt).toISOString(),
    lieu: { nom: input.lieu.nom, lat: input.lieu.lat, lng: input.lieu.lng },
    message: input.message,
    media: (input.media as Media | null | undefined) ?? null,
  }
}

/** Valide le corps de PATCH /activities/{id}/status. */
export function validateActivityStatusUpdate(body: unknown): ActivityStatus {
  const status = (body as { status?: unknown } | null)?.status
  if (!ACTIVITY_STATUSES.includes(status as ActivityStatus)) {
    throw new ApiError(400, 'invalid_body', `status invalide (attendu: ${ACTIVITY_STATUSES.join(', ')})`)
  }
  return status as ActivityStatus
}

/**
 * Indique si `uid` peut faire passer `activity` vers `nextStatus` :
 * - l'invité : en_attente → acceptee | refusee ;
 * - le créateur ou l'invité : acceptee → terminee.
 * Toute autre transition (ou tout autre utilisateur) est refusée.
 */
export function canTransitionStatus(activity: Activity, uid: string, nextStatus: ActivityStatus): boolean {
  const isGuest = uid === activity.guestId
  const isCreator = uid === activity.createdBy

  if (activity.status === 'en_attente') {
    return isGuest && (nextStatus === 'acceptee' || nextStatus === 'refusee')
  }
  if (activity.status === 'acceptee') {
    return (isGuest || isCreator) && nextStatus === 'terminee'
  }
  return false
}
