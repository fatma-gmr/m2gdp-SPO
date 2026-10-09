/**
 * Conversion entre documents Firestore et le type de domaine `User`, et validation
 * des mises à jour partielles reçues sur PUT /users/{id}.
 */
import { ApiError } from './apiError'
import { decodeFirestoreFields, documentIdFromName, type FirestoreDocument } from './firestore'
import {
  DAYS_OF_WEEK,
  LEVELS,
  SPORTS,
  type AvailabilitySlot,
  type GeoPoint,
  type SportPractice,
  type User,
  type UserUpdate,
} from '../types'

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export function firestoreDocumentToUser(doc: FirestoreDocument): User {
  const data = decodeFirestoreFields(doc.fields ?? {}) as Omit<User, 'id'>
  return { id: documentIdFromName(doc.name), ...data }
}

function isGeoPoint(value: unknown): value is GeoPoint {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as GeoPoint).lat === 'number' &&
    typeof (value as GeoPoint).lng === 'number' &&
    Number.isFinite((value as GeoPoint).lat) &&
    Number.isFinite((value as GeoPoint).lng)
  )
}

function isSportPractice(value: unknown): value is SportPractice {
  return (
    typeof value === 'object' &&
    value !== null &&
    SPORTS.includes((value as SportPractice).sport) &&
    LEVELS.includes((value as SportPractice).level)
  )
}

function isAvailabilitySlot(value: unknown): value is AvailabilitySlot {
  return (
    typeof value === 'object' &&
    value !== null &&
    DAYS_OF_WEEK.includes((value as AvailabilitySlot).dayOfWeek) &&
    TIME_PATTERN.test((value as AvailabilitySlot).startTime) &&
    TIME_PATTERN.test((value as AvailabilitySlot).endTime)
  )
}

/** Valide le corps de PUT /users/{id} et ne retourne que les champs modifiables reconnus. */
export function validateUserUpdate(body: unknown): UserUpdate {
  if (typeof body !== 'object' || body === null) {
    throw new ApiError(400, 'invalid_body', 'Le corps de la requête doit être un objet JSON')
  }
  const input = body as Record<string, unknown>
  const update: UserUpdate = {}

  if ('firstName' in input) {
    if (typeof input.firstName !== 'string' || !input.firstName.trim()) {
      throw new ApiError(400, 'invalid_body', 'firstName doit être une chaîne non vide')
    }
    update.firstName = input.firstName
  }

  if ('lastName' in input) {
    if (typeof input.lastName !== 'string' || !input.lastName.trim()) {
      throw new ApiError(400, 'invalid_body', 'lastName doit être une chaîne non vide')
    }
    update.lastName = input.lastName
  }

  if ('avatarUrl' in input) {
    if (input.avatarUrl !== null && typeof input.avatarUrl !== 'string') {
      throw new ApiError(400, 'invalid_body', 'avatarUrl doit être une chaîne ou null')
    }
    update.avatarUrl = input.avatarUrl as string | null
  }

  if ('bio' in input) {
    if (input.bio !== null && typeof input.bio !== 'string') {
      throw new ApiError(400, 'invalid_body', 'bio doit être une chaîne ou null')
    }
    update.bio = input.bio as string | null
  }

  if ('location' in input) {
    if (!isGeoPoint(input.location)) {
      throw new ApiError(400, 'invalid_body', 'location doit contenir lat et lng numériques')
    }
    update.location = input.location
  }

  if ('sports' in input) {
    if (!Array.isArray(input.sports) || !input.sports.every(isSportPractice)) {
      throw new ApiError(400, 'invalid_body', 'sports doit être un tableau de { sport, level } valides')
    }
    update.sports = input.sports
  }

  if ('availability' in input) {
    if (!Array.isArray(input.availability) || !input.availability.every(isAvailabilitySlot)) {
      throw new ApiError(400, 'invalid_body', 'availability doit être un tableau de créneaux valides')
    }
    update.availability = input.availability
  }

  return update
}
