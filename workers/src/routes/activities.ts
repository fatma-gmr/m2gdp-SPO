/**
 * BINOFIT API — routes /activities (voir /specs/openapi.json).
 */
import { Hono } from 'hono'
import type { AppBindings } from '../env'
import {
  canTransitionStatus,
  validateActivityCreate,
  validateActivityStatusUpdate,
} from '../lib/activityMapper'
import { ApiError } from '../lib/apiError'
import { ACTIVITY_SELECT, activityCreateToRow, rowToActivity, type ActivityRow } from '../lib/dbMapper'
import { getSupabase, rowExists, unwrap } from '../lib/supabase'
import { firebaseAuth } from '../middleware/auth'
import { requireProfile } from '../middleware/profile'

export const activitiesRoute = new Hono<AppBindings>()

// Toutes les routes /activities exigent un utilisateur authentifié.
activitiesRoute.use('*', firebaseAuth())

/**
 * POST /activities — `createdBy` est l'utilisateur du jeton, le statut initial est
 * toujours `en_attente`.
 */
activitiesRoute.post('/', requireProfile(), async (c) => {
  const authUser = c.get('authUser')

  const body = await c.req.json().catch(() => {
    throw new ApiError(400, 'invalid_body', 'Corps de requête JSON invalide')
  })
  const input = validateActivityCreate(body)

  if (input.guestId === authUser.uid) {
    throw new ApiError(400, 'invalid_guest', 'Vous ne pouvez pas vous proposer une activité à vous-même')
  }
  if (!(await rowExists(c.env, 'users', input.guestId))) {
    throw new ApiError(404, 'user_not_found', 'Utilisateur invité introuvable')
  }

  const row = unwrap(
    await getSupabase(c.env)
      .from('activities')
      .insert({ ...activityCreateToRow(input, authUser.uid), status: 'en_attente', created_at: new Date().toISOString() })
      .select(ACTIVITY_SELECT)
      .single(),
    'activities',
  )

  return c.json(rowToActivity(row as unknown as ActivityRow), 201)
})

/**
 * GET /activities?userId — propositions où l'utilisateur est créateur ou invité,
 * de la plus récente à la plus ancienne. Sans `userId`, l'utilisateur du jeton est
 * utilisé ; on ne peut pas consulter les propositions d'un autre utilisateur (403).
 */
activitiesRoute.get('/', async (c) => {
  const authUser = c.get('authUser')
  const userId = c.req.query('userId') ?? authUser.uid

  if (userId !== authUser.uid) {
    throw new ApiError(403, 'forbidden', 'Vous ne pouvez consulter que vos propres activités')
  }

  // Deux filtres .eq() plutôt qu'un .or() : l'uid n'est jamais interpolé dans la syntaxe PostgREST.
  const supabase = getSupabase(c.env)
  const [created, invited] = await Promise.all([
    supabase.from('activities').select(ACTIVITY_SELECT).eq('created_by', userId),
    supabase.from('activities').select(ACTIVITY_SELECT).eq('guest_id', userId),
  ])

  const activities = [...unwrap(created, 'activities'), ...unwrap(invited, 'activities')]
    .map((row) => rowToActivity(row as unknown as ActivityRow))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return c.json(activities)
})

/** PATCH /activities/{id}/status — voir `canTransitionStatus` pour les règles. */
activitiesRoute.patch('/:id/status', async (c) => {
  const id = c.req.param('id')
  const authUser = c.get('authUser')

  const body = await c.req.json().catch(() => {
    throw new ApiError(400, 'invalid_body', 'Corps de requête JSON invalide')
  })
  const nextStatus = validateActivityStatusUpdate(body)

  const supabase = getSupabase(c.env)
  const row = unwrap(
    await supabase.from('activities').select(ACTIVITY_SELECT).eq('id', id).maybeSingle(),
    'activities',
  )
  if (!row) {
    throw new ApiError(404, 'activity_not_found', 'Activité introuvable')
  }
  const activity = rowToActivity(row as unknown as ActivityRow)

  if (!canTransitionStatus(activity, authUser.uid, nextStatus)) {
    throw new ApiError(
      403,
      'forbidden',
      `Transition ${activity.status} → ${nextStatus} non autorisée pour cet utilisateur`,
    )
  }

  const updated = unwrap(
    await supabase.from('activities').update({ status: nextStatus }).eq('id', id).select(ACTIVITY_SELECT).single(),
    'activities',
  )
  return c.json(rowToActivity(updated as unknown as ActivityRow))
})
