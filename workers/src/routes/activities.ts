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
import {
  createDocument,
  firestoreDocumentToEntity,
  getDocument,
  patchDocument,
  queryDocuments,
} from '../lib/firestore'
import { firebaseAuth } from '../middleware/auth'
import type { Activity } from '../types'

const ACTIVITIES_COLLECTION = 'activities'
const USERS_COLLECTION = 'users'

export const activitiesRoute = new Hono<AppBindings>()

// Toutes les routes /activities exigent un utilisateur authentifié.
activitiesRoute.use('*', firebaseAuth())

/**
 * POST /activities — `createdBy` est l'utilisateur du jeton, le statut initial est
 * toujours `en_attente`.
 */
activitiesRoute.post('/', async (c) => {
  const authUser = c.get('authUser')

  const body = await c.req.json().catch(() => {
    throw new ApiError(400, 'invalid_body', 'Corps de requête JSON invalide')
  })
  const input = validateActivityCreate(body)

  if (input.guestId === authUser.uid) {
    throw new ApiError(400, 'invalid_guest', 'Vous ne pouvez pas vous proposer une activité à vous-même')
  }
  const guest = await getDocument(c.env, USERS_COLLECTION, input.guestId)
  if (!guest) {
    throw new ApiError(404, 'user_not_found', 'Utilisateur invité introuvable')
  }

  const doc = await createDocument(c.env, ACTIVITIES_COLLECTION, {
    ...input,
    createdBy: authUser.uid,
    status: 'en_attente',
    conversationId: null,
    createdAt: new Date().toISOString(),
  })

  return c.json(firestoreDocumentToEntity<Activity>(doc), 201)
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

  // Deux requêtes mono-champ plutôt qu'un filtre OR : aucun index composite requis.
  const [created, invited] = await Promise.all([
    queryDocuments(c.env, ACTIVITIES_COLLECTION, 'createdBy', 'EQUAL', userId),
    queryDocuments(c.env, ACTIVITIES_COLLECTION, 'guestId', 'EQUAL', userId),
  ])

  const activities = [...created, ...invited]
    .map((doc) => firestoreDocumentToEntity<Activity>(doc))
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

  const doc = await getDocument(c.env, ACTIVITIES_COLLECTION, id)
  if (!doc) {
    throw new ApiError(404, 'activity_not_found', 'Activité introuvable')
  }
  const activity = firestoreDocumentToEntity<Activity>(doc)

  if (!canTransitionStatus(activity, authUser.uid, nextStatus)) {
    throw new ApiError(
      403,
      'forbidden',
      `Transition ${activity.status} → ${nextStatus} non autorisée pour cet utilisateur`,
    )
  }

  const updatedDoc = await patchDocument(c.env, ACTIVITIES_COLLECTION, id, { status: nextStatus })
  return c.json(firestoreDocumentToEntity<Activity>(updatedDoc))
})
