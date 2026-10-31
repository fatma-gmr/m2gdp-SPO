/**
 * Requêtes communes aux routes conversations/messages, et contrôle d'accès : seuls
 * les participants d'une conversation peuvent la lire ou y écrire.
 */
import type { Env } from '../env'
import { ApiError } from './apiError'
import { CONVERSATION_SELECT, rowToConversation, type ConversationRow } from './dbMapper'
import { getSupabase, unwrap } from './supabase'
import type { Conversation } from '../types'

/** Sélectionne des conversations avec participantIds et lastMessage (dernier message seul). */
function selectConversations(env: Env) {
  return getSupabase(env)
    .from('conversations')
    .select(CONVERSATION_SELECT)
    .order('sent_at', { referencedTable: 'messages', ascending: false })
    .limit(1, { referencedTable: 'messages' })
}

/** Conversation `id`, ou `null` si elle n'existe pas. */
export async function getConversation(env: Env, id: string): Promise<Conversation | null> {
  const row = unwrap(await selectConversations(env).eq('id', id).maybeSingle(), 'conversations')
  return row ? rowToConversation(row as unknown as ConversationRow) : null
}

/** Conversations auxquelles `uid` participe (non triées). */
export async function listConversationsOf(env: Env, uid: string): Promise<Conversation[]> {
  const links = unwrap(
    await getSupabase(env).from('participants').select('conversation_id').eq('user_id', uid),
    'participants',
  )
  if (links.length === 0) return []
  const rows = unwrap(
    await selectConversations(env).in(
      'id',
      links.map((link) => link.conversation_id),
    ),
    'conversations',
  )
  return (rows as unknown as ConversationRow[]).map(rowToConversation)
}

/** Retourne la conversation `id` si `uid` y participe ; 404 si elle n'existe pas, 403 sinon. */
export async function getConversationForParticipant(env: Env, id: string, uid: string): Promise<Conversation> {
  const conversation = await getConversation(env, id)
  if (!conversation) {
    throw new ApiError(404, 'conversation_not_found', 'Conversation introuvable')
  }
  if (!conversation.participantIds.includes(uid)) {
    throw new ApiError(403, 'forbidden', "Vous ne participez pas à cette conversation")
  }
  return conversation
}
