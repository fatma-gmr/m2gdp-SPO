/**
 * BINOFIT API — route POST /messages (voir /specs/openapi.json).
 *
 * La lecture des messages est exposée sous GET /conversations/{id}/messages
 * (voir routes/conversations.ts).
 */
import { Hono } from 'hono'
import type { AppBindings } from '../env'
import { ApiError } from '../lib/apiError'
import { getConversationForParticipant } from '../lib/conversationAccess'
import { MESSAGE_SELECT, rowToMessage, type MessageRow } from '../lib/dbMapper'
import { getSupabase, unwrap } from '../lib/supabase'
import { firebaseAuth } from '../middleware/auth'

const TEXT_MAX_LENGTH = 2000

export const messagesRoute = new Hono<AppBindings>()

// Toutes les routes /messages exigent un utilisateur authentifié.
messagesRoute.use('*', firebaseAuth())

/**
 * POST /messages — `senderId` est l'utilisateur du jeton, qui doit participer à la
 * conversation. Rafraîchit aussi `updatedAt` de la conversation (tri de la liste) ;
 * `lastMessage` est recalculé depuis la table messages à la lecture.
 */
messagesRoute.post('/', async (c) => {
  const authUser = c.get('authUser')

  const body = await c.req.json().catch(() => {
    throw new ApiError(400, 'invalid_body', 'Corps de requête JSON invalide')
  })
  const { conversationId, text } = (body ?? {}) as Record<string, unknown>

  if (typeof conversationId !== 'string' || !conversationId.trim()) {
    throw new ApiError(400, 'invalid_body', 'conversationId doit être une chaîne non vide')
  }
  if (typeof text !== 'string' || !text.trim() || text.length > TEXT_MAX_LENGTH) {
    throw new ApiError(400, 'invalid_body', `text doit contenir entre 1 et ${TEXT_MAX_LENGTH} caractères`)
  }

  await getConversationForParticipant(c.env, conversationId, authUser.uid)

  const supabase = getSupabase(c.env)
  const sentAt = new Date().toISOString()
  const row = unwrap(
    await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: authUser.uid, text, sent_at: sentAt })
      .select(MESSAGE_SELECT)
      .single(),
    'messages',
  )

  unwrap(await supabase.from('conversations').update({ updated_at: sentAt }).eq('id', conversationId), 'conversations')

  return c.json(rowToMessage(row as MessageRow), 201)
})
