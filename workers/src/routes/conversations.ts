/**
 * BINOFIT API — routes /conversations (voir /specs/openapi.json).
 *
 * Tables Supabase : `conversations` (métadonnées), `participants` (participantIds) et
 * `messages` (contenu, d'où est aussi calculé lastMessage).
 */
import { Hono } from 'hono'
import type { AppBindings } from '../env'
import { ApiError } from '../lib/apiError'
import { getConversation, getConversationForParticipant, listConversationsOf } from '../lib/conversationAccess'
import {
  ACTIVITY_SELECT,
  MESSAGE_SELECT,
  rowToActivity,
  rowToMessage,
  type ActivityRow,
  type MessageRow,
} from '../lib/dbMapper'
import { databaseError, getSupabase, rowExists, unwrap } from '../lib/supabase'
import { firebaseAuth } from '../middleware/auth'
import { requireProfile } from '../middleware/profile'

const MESSAGES_DEFAULT_LIMIT = 50
const MESSAGES_MAX_LIMIT = 200

export const conversationsRoute = new Hono<AppBindings>()

// Toutes les routes /conversations exigent un utilisateur authentifié.
conversationsRoute.use('*', firebaseAuth())

/** GET /conversations — conversations de l'utilisateur du jeton, triées par `updatedAt` décroissant. */
conversationsRoute.get('/', async (c) => {
  const authUser = c.get('authUser')
  const conversations = await listConversationsOf(c.env, authUser.uid)
  conversations.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return c.json(conversations)
})

/**
 * POST /conversations — ouvre une conversation 1-à-1 entre l'utilisateur du jeton et
 * `participantId`, éventuellement liée à une activité dont ils sont créateur/invité.
 * Si la conversation existe déjà (même paire, même activité), elle est renvoyée (200)
 * au lieu d'en créer un doublon (201).
 */
conversationsRoute.post('/', requireProfile(), async (c) => {
  const authUser = c.get('authUser')

  const body = await c.req.json().catch(() => {
    throw new ApiError(400, 'invalid_body', 'Corps de requête JSON invalide')
  })
  const { participantId, activityId = null } = (body ?? {}) as Record<string, unknown>

  if (typeof participantId !== 'string' || !participantId.trim()) {
    throw new ApiError(400, 'invalid_body', 'participantId doit être une chaîne non vide')
  }
  if (activityId !== null && (typeof activityId !== 'string' || !activityId.trim())) {
    throw new ApiError(400, 'invalid_body', 'activityId doit être une chaîne non vide ou null')
  }
  if (participantId === authUser.uid) {
    throw new ApiError(400, 'invalid_participant', 'Vous ne pouvez pas ouvrir une conversation avec vous-même')
  }

  if (!(await rowExists(c.env, 'users', participantId))) {
    throw new ApiError(404, 'user_not_found', 'Utilisateur introuvable')
  }

  const supabase = getSupabase(c.env)

  if (activityId !== null) {
    const activityRow = unwrap(
      await supabase.from('activities').select(ACTIVITY_SELECT).eq('id', activityId).maybeSingle(),
      'activities',
    )
    if (!activityRow) {
      throw new ApiError(404, 'activity_not_found', 'Activité introuvable')
    }
    const activity = rowToActivity(activityRow as unknown as ActivityRow)
    const pair = [activity.createdBy, activity.guestId]
    if (!pair.includes(authUser.uid) || !pair.includes(participantId)) {
      throw new ApiError(403, 'forbidden', "Cette activité ne concerne pas ces deux utilisateurs")
    }
  }

  const existing = (await listConversationsOf(c.env, authUser.uid)).find(
    (conversation) =>
      conversation.participantIds.includes(participantId) && (conversation.activityId ?? null) === activityId,
  )
  if (existing) {
    return c.json(existing, 200)
  }

  // Le lien activité ↔ conversation est porté par conversations.activity_id : l'activité
  // expose ensuite conversationId sans écriture supplémentaire.
  const now = new Date().toISOString()
  const created = unwrap(
    await supabase
      .from('conversations')
      .insert({ activity_id: activityId, created_at: now, updated_at: now })
      .select('id')
      .single(),
    'conversations',
  )

  const { error } = await supabase.from('participants').insert([
    { conversation_id: created.id, user_id: authUser.uid },
    { conversation_id: created.id, user_id: participantId },
  ])
  if (error) {
    // Pas de transaction via PostgREST : on retire la conversation orpheline.
    await supabase.from('conversations').delete().eq('id', created.id)
    throw databaseError(error, 'participants')
  }

  return c.json(await getConversation(c.env, created.id), 201)
})

/**
 * GET /conversations/{id}/messages?limit&before — réservé aux participants.
 * Retourne les `limit` messages les plus récents antérieurs à `before`, triés par
 * `sentAt` croissant.
 */
conversationsRoute.get('/:id/messages', async (c) => {
  const id = c.req.param('id')
  const authUser = c.get('authUser')

  const rawLimit = c.req.query('limit')
  const limit = rawLimit === undefined ? MESSAGES_DEFAULT_LIMIT : Number(rawLimit)
  if (!Number.isInteger(limit) || limit < 1 || limit > MESSAGES_MAX_LIMIT) {
    throw new ApiError(400, 'invalid_query', `limit doit être un entier entre 1 et ${MESSAGES_MAX_LIMIT}`)
  }
  const rawBefore = c.req.query('before')
  if (rawBefore !== undefined && Number.isNaN(Date.parse(rawBefore))) {
    throw new ApiError(400, 'invalid_query', 'before doit être une date ISO 8601')
  }
  const before = rawBefore === undefined ? undefined : new Date(rawBefore).toISOString()

  await getConversationForParticipant(c.env, id, authUser.uid)

  // Les `limit` plus récents (tri décroissant en base), remis ensuite dans l'ordre chronologique.
  let query = getSupabase(c.env).from('messages').select(MESSAGE_SELECT).eq('conversation_id', id)
  if (before !== undefined) query = query.lt('sent_at', before)

  const rows = unwrap(await query.order('sent_at', { ascending: false }).limit(limit), 'messages')
  return c.json((rows as MessageRow[]).map(rowToMessage).reverse())
})
