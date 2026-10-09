/**
 * Contrôle d'accès commun aux routes conversations/messages : seuls les
 * participants d'une conversation peuvent la lire ou y écrire.
 */
import type { Env } from '../env'
import { ApiError } from './apiError'
import { firestoreDocumentToEntity, getDocument } from './firestore'
import type { Conversation } from '../types'

export const CONVERSATIONS_COLLECTION = 'conversations'

/** Retourne la conversation `id` si `uid` y participe ; 404 si elle n'existe pas, 403 sinon. */
export async function getConversationForParticipant(env: Env, id: string, uid: string): Promise<Conversation> {
  const doc = await getDocument(env, CONVERSATIONS_COLLECTION, id)
  if (!doc) {
    throw new ApiError(404, 'conversation_not_found', 'Conversation introuvable')
  }
  const conversation = firestoreDocumentToEntity<Conversation>(doc)
  if (!conversation.participantIds.includes(uid)) {
    throw new ApiError(403, 'forbidden', "Vous ne participez pas à cette conversation")
  }
  return conversation
}
