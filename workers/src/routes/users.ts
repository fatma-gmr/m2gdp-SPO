/**
 * BINOFIT API — routes /users (voir /specs/openapi.json).
 */
import { Hono } from 'hono'
import type { AppBindings } from '../env'
import { ApiError } from '../lib/apiError'
import { getDocument, listDocuments, patchDocument } from '../lib/firestore'
import { haversineDistanceKm } from '../lib/geo'
import { firestoreDocumentToUser, validateUserUpdate } from '../lib/userMapper'
import { firebaseAuth } from '../middleware/auth'
import { DAYS_OF_WEEK, LEVELS, SPORTS, type DayOfWeek, type Level, type Sport, type User } from '../types'

const USERS_COLLECTION = 'users'

export const usersRoute = new Hono<AppBindings>()

// Toutes les routes /users exigent un utilisateur authentifié.
usersRoute.use('*', firebaseAuth())

function parseOptionalNumber(raw: string | undefined, label: string): number | undefined {
  if (raw === undefined) return undefined
  const value = Number(raw)
  if (Number.isNaN(value)) {
    throw new ApiError(400, 'invalid_query', `${label} doit être un nombre`)
  }
  return value
}

function assertEnumOrUndefined<T extends string>(
  raw: string | undefined,
  allowed: readonly T[],
  label: string,
): T | undefined {
  if (raw === undefined) return undefined
  if (!allowed.includes(raw as T)) {
    throw new ApiError(400, 'invalid_query', `${label} invalide: ${raw} (attendu: ${allowed.join(', ')})`)
  }
  return raw as T
}

/**
 * GET /users?lat&lng&maxKm&sport&level&availability
 *
 * Récupère l'ensemble des profils puis filtre/trie côté Worker (voir la note sur les
 * limites de requêtage Firestore dans /specs/data-model.md). Acceptable pour le volume
 * attendu du POC ; à revoir (geohash + index dédiés) si la base d'utilisateurs grossit.
 */
usersRoute.get('/', async (c) => {
  const query = c.req.query()

  const lat = parseOptionalNumber(query.lat, 'lat')
  const lng = parseOptionalNumber(query.lng, 'lng')
  const maxKm = parseOptionalNumber(query.maxKm, 'maxKm')
  const sport = assertEnumOrUndefined<Sport>(query.sport, SPORTS, 'sport')
  const level = assertEnumOrUndefined<Level>(query.level, LEVELS, 'level')
  const availability = assertEnumOrUndefined<DayOfWeek>(query.availability, DAYS_OF_WEEK, 'availability')

  const hasAnyGeoParam = lat !== undefined || lng !== undefined || maxKm !== undefined
  if (hasAnyGeoParam && (lat === undefined || lng === undefined || maxKm === undefined)) {
    throw new ApiError(400, 'invalid_query', 'lat, lng et maxKm doivent être fournis ensemble')
  }
  if (maxKm !== undefined && maxKm < 0) {
    throw new ApiError(400, 'invalid_query', 'maxKm doit être positif')
  }

  const documents = await listDocuments(c.env, USERS_COLLECTION)
  let users: User[] = documents.map(firestoreDocumentToUser)

  if (sport !== undefined) {
    users = users.filter((user) => user.sports.some((practice) => practice.sport === sport))
  }
  if (level !== undefined) {
    users = users.filter((user) => user.sports.some((practice) => practice.level === level))
  }
  if (availability !== undefined) {
    users = users.filter((user) => user.availability.some((slot) => slot.dayOfWeek === availability))
  }

  if (lat !== undefined && lng !== undefined && maxKm !== undefined) {
    const origin = { lat, lng }
    users = users
      .map((user) => ({ user, distanceKm: haversineDistanceKm(origin, user.location) }))
      .filter(({ distanceKm }) => distanceKm <= maxKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .map(({ user }) => user)
  }

  return c.json(users)
})

/** GET /users/{id} */
usersRoute.get('/:id', async (c) => {
  const id = c.req.param('id')
  const doc = await getDocument(c.env, USERS_COLLECTION, id)
  if (!doc) {
    throw new ApiError(404, 'user_not_found', 'Utilisateur introuvable')
  }
  return c.json(firestoreDocumentToUser(doc))
})

/** PUT /users/{id} — un utilisateur ne peut modifier que son propre profil. */
usersRoute.put('/:id', async (c) => {
  const id = c.req.param('id')
  const authUser = c.get('authUser')

  if (authUser.uid !== id) {
    throw new ApiError(403, 'forbidden', 'Vous ne pouvez modifier que votre propre profil')
  }

  const existing = await getDocument(c.env, USERS_COLLECTION, id)
  if (!existing) {
    throw new ApiError(404, 'user_not_found', 'Utilisateur introuvable')
  }

  const body = await c.req.json().catch(() => {
    throw new ApiError(400, 'invalid_body', 'Corps de requête JSON invalide')
  })
  const updates = validateUserUpdate(body)

  const updatedDoc = await patchDocument(c.env, USERS_COLLECTION, id, {
    ...updates,
    updatedAt: new Date().toISOString(),
  })

  return c.json(firestoreDocumentToUser(updatedDoc))
})
