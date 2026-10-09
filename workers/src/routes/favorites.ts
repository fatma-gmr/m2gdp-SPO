/**
 * BINOFIT API — routes /favorites (voir /specs/openapi.json).
 *
 * Toutes les opérations portent sur les favoris de l'utilisateur du jeton.
 */
import { Hono } from 'hono'
import type { AppBindings } from '../env'
import { ApiError } from '../lib/apiError'
import {
  createDocument,
  deleteDocument,
  firestoreDocumentToEntity,
  getDocument,
  queryDocuments,
} from '../lib/firestore'
import { firebaseAuth } from '../middleware/auth'
import { FAVORITE_TARGET_TYPES, type Favorite, type FavoriteTargetType } from '../types'

const FAVORITES_COLLECTION = 'favorites'
const TARGET_COLLECTIONS: Record<FavoriteTargetType, string> = {
  user: 'users',
  activity: 'activities',
}

export const favoritesRoute = new Hono<AppBindings>()

// Toutes les routes /favorites exigent un utilisateur authentifié.
favoritesRoute.use('*', firebaseAuth())

async function listFavoritesOf(env: AppBindings['Bindings'], uid: string): Promise<Favorite[]> {
  const documents = await queryDocuments(env, FAVORITES_COLLECTION, 'userId', 'EQUAL', uid)
  return documents.map((doc) => firestoreDocumentToEntity<Favorite>(doc))
}

/** GET /favorites — favoris de l'utilisateur du jeton, du plus récent au plus ancien. */
favoritesRoute.get('/', async (c) => {
  const authUser = c.get('authUser')
  const favorites = await listFavoritesOf(c.env, authUser.uid)
  favorites.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return c.json(favorites)
})

/** POST /favorites — un couple (userId, targetType, targetId) est unique (409 sinon). */
favoritesRoute.post('/', async (c) => {
  const authUser = c.get('authUser')

  const body = await c.req.json().catch(() => {
    throw new ApiError(400, 'invalid_body', 'Corps de requête JSON invalide')
  })
  const { targetType, targetId } = (body ?? {}) as Record<string, unknown>

  if (!FAVORITE_TARGET_TYPES.includes(targetType as FavoriteTargetType)) {
    throw new ApiError(400, 'invalid_body', `targetType invalide (attendu: ${FAVORITE_TARGET_TYPES.join(', ')})`)
  }
  if (typeof targetId !== 'string' || !targetId.trim()) {
    throw new ApiError(400, 'invalid_body', 'targetId doit être une chaîne non vide')
  }
  const type = targetType as FavoriteTargetType
  if (type === 'user' && targetId === authUser.uid) {
    throw new ApiError(400, 'invalid_target', 'Vous ne pouvez pas vous ajouter vous-même en favori')
  }

  const target = await getDocument(c.env, TARGET_COLLECTIONS[type], targetId)
  if (!target) {
    throw new ApiError(404, 'target_not_found', `Cible introuvable (${type} ${targetId})`)
  }

  const favorites = await listFavoritesOf(c.env, authUser.uid)
  if (favorites.some((favorite) => favorite.targetType === type && favorite.targetId === targetId)) {
    throw new ApiError(409, 'favorite_exists', 'Cette cible est déjà dans vos favoris')
  }

  const doc = await createDocument(c.env, FAVORITES_COLLECTION, {
    userId: authUser.uid,
    targetType: type,
    targetId,
    createdAt: new Date().toISOString(),
  })

  return c.json(firestoreDocumentToEntity<Favorite>(doc), 201)
})

/** DELETE /favorites/{targetId} — retire la cible des favoris de l'utilisateur du jeton. */
favoritesRoute.delete('/:targetId', async (c) => {
  const targetId = c.req.param('targetId')
  const authUser = c.get('authUser')

  const matches = (await listFavoritesOf(c.env, authUser.uid)).filter((favorite) => favorite.targetId === targetId)
  if (matches.length === 0) {
    throw new ApiError(404, 'favorite_not_found', 'Cette cible ne fait pas partie de vos favoris')
  }

  await Promise.all(matches.map((favorite) => deleteDocument(c.env, FAVORITES_COLLECTION, favorite.id)))
  return c.body(null, 204)
})
