/**
 * BINOFIT API — route POST /messages (voir /specs/openapi.json).
 *
 * La lecture des messages est exposée sous GET /conversations/{id}/messages
 * (voir routes/conversations.ts).
 */
import { Hono } from 'hono'
import type { AppBindings } from '../env'
import { ApiError } from '../lib/apiError'
import { CONVERSATIONS_COLLECTION, getConversationForParticipant } from '../lib/conversationAccess'
import { patchDocument } from '../lib/firestore'
import { pushValue } from '../lib/realtimeDb'
import { firebaseAuth } from '../middleware/auth'
import type { Message } from '../types'

const TEXT_MAX_LENGTH = 2000

export const messagesRoute = new Hono<AppBindings>()

// Toutes les routes /messages exigent un utilisateur authentifié.
messagesRoute.use('*', firebaseAuth())

/**
 * POST /messages — `senderId` est l'utilisateur du jeton, qui doit participer à la
 * conversation. Met aussi à jour l'aperçu `lastMessage` de la conversation (Firestore).
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

  const data: Omit<Message, 'id'> = {
    conversationId,
    senderId: authUser.uid,
    text,
    sentAt: new Date().toISOString(),
    readBy: [authUser.uid],
  }
  const id = await pushValue(c.env, `messages/${conversationId}`, data)

  await patchDocument(c.env, CONVERSATIONS_COLLECTION, conversationId, {
    lastMessage: { text, senderId: data.senderId, sentAt: data.sentAt },
    updatedAt: data.sentAt,
  })

  return c.json({ id, ...data } satisfies Message, 201)
})
