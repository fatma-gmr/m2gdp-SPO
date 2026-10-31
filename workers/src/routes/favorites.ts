/**
 * BINOFIT API — routes /favorites (voir /specs/openapi.json).
 *
 * Toutes les opérations portent sur les favoris de l'utilisateur du jeton.
 */
import { Hono } from 'hono'
import type { AppBindings } from '../env'
import { ApiError } from '../lib/apiError'
import { FAVORITE_SELECT, rowToFavorite, type FavoriteRow } from '../lib/dbMapper'
import { UNIQUE_VIOLATION, databaseError, getSupabase, rowExists, unwrap } from '../lib/supabase'
import { firebaseAuth } from '../middleware/auth'
import { requireProfile } from '../middleware/profile'
import { FAVORITE_TARGET_TYPES, type FavoriteTargetType } from '../types'

const TARGET_TABLES: Record<FavoriteTargetType, 'users' | 'activities'> = {
  user: 'users',
  activity: 'activities',
}

export const favoritesRoute = new Hono<AppBindings>()

// Toutes les routes /favorites exigent un utilisateur authentifié.
favoritesRoute.use('*', firebaseAuth())

/** GET /favorites — favoris de l'utilisateur du jeton, du plus récent au plus ancien. */
favoritesRoute.get('/', async (c) => {
  const authUser = c.get('authUser')
  const rows = unwrap(
    await getSupabase(c.env)
      .from('favorites')
      .select(FAVORITE_SELECT)
      .eq('user_id', authUser.uid)
      .order('created_at', { ascending: false }),
    'favorites',
  )
  return c.json((rows as FavoriteRow[]).map(rowToFavorite))
})

/** POST /favorites — un couple (userId, targetType, targetId) est unique (409 sinon). */
favoritesRoute.post('/', requireProfile(), async (c) => {
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

  if (!(await rowExists(c.env, TARGET_TABLES[type], targetId))) {
    throw new ApiError(404, 'target_not_found', `Cible introuvable (${type} ${targetId})`)
  }

  // L'unicité est garantie par la contrainte unique (user_id, target_type, target_id).
  const { data, error } = await getSupabase(c.env)
    .from('favorites')
    .insert({ user_id: authUser.uid, target_type: type, target_id: targetId, created_at: new Date().toISOString() })
    .select(FAVORITE_SELECT)
    .single()
  if (error?.code === UNIQUE_VIOLATION) {
    throw new ApiError(409, 'favorite_exists', 'Cette cible est déjà dans vos favoris')
  }
  if (error) throw databaseError(error, 'favorites')

  return c.json(rowToFavorite(data as FavoriteRow), 201)
})

/** DELETE /favorites/{targetId} — retire la cible des favoris de l'utilisateur du jeton. */
favoritesRoute.delete('/:targetId', async (c) => {
  const targetId = c.req.param('targetId')
  const authUser = c.get('authUser')

  const deleted = unwrap(
    await getSupabase(c.env)
      .from('favorites')
      .delete()
      .eq('user_id', authUser.uid)
      .eq('target_id', targetId)
      .select('id'),
    'favorites',
  )
  if (deleted.length === 0) {
    throw new ApiError(404, 'favorite_not_found', 'Cette cible ne fait pas partie de vos favoris')
  }

  return c.body(null, 204)
})
