/**
 * BINOFIT API — client Supabase (Postgres via PostgREST) utilisé par toutes les routes.
 *
 * Le Worker s'authentifie avec la clé secrète du projet (SUPABASE_SECRET_KEY, secret
 * Wrangler) : c'est donc au Worker de vérifier les droits avant chaque appel, comme le
 * faisait l'ancien compte de service Firebase. L'utilisateur final est toujours
 * authentifié par son jeton Firebase (voir middleware/auth.ts).
 */
import { createClient, type PostgrestError, type SupabaseClient } from '@supabase/supabase-js'
import type { Env } from '../env'
import { ApiError } from './apiError'

/** Code Postgres d'une violation de contrainte d'unicité. */
export const UNIQUE_VIOLATION = '23505'

// Un client par isolate : réutilisé entre requêtes tant que l'isolate reste "chaud".
let cachedClient: { url: string; client: SupabaseClient } | null = null

export function getSupabase(env: Env): SupabaseClient {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
    throw new ApiError(
      500,
      'config_error',
      'SUPABASE_URL (wrangler.toml) et SUPABASE_SECRET_KEY (secret Wrangler) doivent être configurés',
    )
  }
  if (cachedClient?.url !== env.SUPABASE_URL) {
    cachedClient = {
      url: env.SUPABASE_URL,
      client: createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      }),
    }
  }
  return cachedClient.client
}

/**
 * Convertit une erreur PostgREST en ApiError 502. Le détail (code Postgres, message,
 * ex. « permission denied for table ... ») est journalisé côté Worker, jamais renvoyé.
 */
export function databaseError(error: PostgrestError, context: string): ApiError {
  console.error(`[BINOFIT API] Erreur Supabase (${context}):`, error.code, error.message, error.details ?? '')
  return new ApiError(502, 'database_error', `Erreur de base de données sur ${context}`)
}

/**
 * Retourne `data` ou lève une ApiError si la requête Supabase a échoué. Le type suit
 * la réponse : non nul après `.single()`, nullable après `.maybeSingle()`.
 */
export function unwrap<R extends { data: unknown; error: PostgrestError | null }>(
  result: R,
  context: string,
): Extract<R, { error: null }>['data'] {
  if (result.error) throw databaseError(result.error, context)
  return result.data
}

/** Indique si la ligne `id` existe dans `table` (users ou activities). */
export async function rowExists(env: Env, table: 'users' | 'activities', id: string): Promise<boolean> {
  const row = unwrap(await getSupabase(env).from(table).select('id').eq('id', id).maybeSingle(), table)
  return row !== null
}
