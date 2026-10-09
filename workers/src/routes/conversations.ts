/**
 * BINOFIT API — routes /conversations (voir /specs/openapi.json).
 *
 * Les métadonnées des conversations sont dans Firestore ; leurs messages sont dans
 * la Realtime Database sous `messages/{conversationId}/{messageId}`.
 */
import { Hono } from 'hono'
import type { AppBindings } from '../env'
import { ApiError } from '../lib/apiError'
import { CONVERSATIONS_COLLECTION, getConversationForParticipant } from '../lib/conversationAccess'
import {
  createDocument,
  firestoreDocumentToEntity,
  getDocument,
  patchDocument,
  queryDocuments,
} from '../lib/firestore'
import { getValue } from '../lib/realtimeDb'
import { firebaseAuth } from '../middleware/auth'
import type { Activity, Conversation, Message } from '../types'

const USERS_COLLECTION = 'users'
const ACTIVITIES_COLLECTION = 'activities'
const MESSAGES_DEFAULT_LIMIT = 50
const MESSAGES_MAX_LIMIT = 200

export const conversationsRoute = new Hono<AppBindings>()

// Toutes les routes /conversations exigent un utilisateur authentifié.
conversationsRoute.use('*', firebaseAuth())

async function listConversationsOf(env: AppBindings['Bindings'], uid: string): Promise<Conversation[]> {
  const documents = await queryDocuments(env, CONVERSATIONS_COLLECTION, 'participantIds', 'ARRAY_CONTAINS', uid)
  return documents.map((doc) => firestoreDocumentToEntity<Conversation>(doc))
}

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
conversationsRoute.post('/', async (c) => {
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

  const participant = await getDocument(c.env, USERS_COLLECTION, participantId)
  if (!participant) {
    throw new ApiError(404, 'user_not_found', 'Utilisateur introuvable')
  }

  if (activityId !== null) {
    const activityDoc = await getDocument(c.env, ACTIVITIES_COLLECTION, activityId)
    if (!activityDoc) {
      throw new ApiError(404, 'activity_not_found', 'Activité introuvable')
    }
    const activity = firestoreDocumentToEntity<Activity>(activityDoc)
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

  const now = new Date().toISOString()
  const doc = await createDocument(c.env, CONVERSATIONS_COLLECTION, {
    participantIds: [authUser.uid, participantId],
    activityId,
    lastMessage: null,
    createdAt: now,
    updatedAt: now,
  })
  const conversation = firestoreDocumentToEntity<Conversation>(doc)

  // Lien bidirectionnel activité ↔ conversation (voir /specs/data-model.md).
  if (activityId !== null) {
    await patchDocument(c.env, ACTIVITIES_COLLECTION, activityId, { conversationId: conversation.id })
  }

  return c.json(conversation, 201)
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

  // Lecture complète du nœud puis filtre/tri en mémoire : une requête orderBy/limit
  // côté Realtime Database exigerait un `.indexOn: "sentAt"` dans les règles.
  const stored = (await getValue<Record<string, Omit<Message, 'id'>>>(c.env, `messages/${id}`)) ?? {}
  const messages = Object.entries(stored)
    .map(([messageId, data]) => ({ ...data, id: messageId, readBy: data.readBy ?? [] }))
    .filter((message) => before === undefined || message.sentAt < before)
    .sort((a, b) => a.sentAt.localeCompare(b.sentAt))
    .slice(-limit)

  return c.json(messages)
})
