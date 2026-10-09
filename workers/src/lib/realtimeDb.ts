/**
 * BINOFIT API — client minimal pour l'API REST Firebase Realtime Database.
 *
 * Même principe que firestore.ts : pas de SDK, appels directs à
 * `<FIREBASE_DATABASE_URL>/<chemin>.json` avec l'access_token du compte de service
 * (scopes `firebase.database` + `userinfo.email`, voir serviceAccountAuth.ts).
 * Le compte de service a un accès administrateur : les règles de sécurité de la base
 * ne s'appliquent pas, c'est donc au Worker de vérifier les droits avant chaque appel.
 */
import type { Env } from '../env'
import { ApiError } from './apiError'
import { getGoogleAccessToken } from './serviceAccountAuth'

function databaseUrl(env: Env, path: string): string {
  if (!env.FIREBASE_DATABASE_URL) {
    throw new ApiError(500, 'config_error', 'FIREBASE_DATABASE_URL doit être configuré (wrangler.toml)')
  }
  return `${env.FIREBASE_DATABASE_URL.replace(/\/+$/, '')}/${path}.json`
}

async function authorizedFetch(env: Env, path: string, init?: RequestInit): Promise<Response> {
  const accessToken = await getGoogleAccessToken(env)
  const response = await fetch(databaseUrl(env, path), {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${accessToken}`,
    },
  })
  if (!response.ok) {
    throw new ApiError(502, 'realtime_db_error', `Erreur Realtime Database (${response.status}) sur ${path}`)
  }
  return response
}

/** Lit la valeur stockée à `path`, ou `null` si le nœud n'existe pas. */
export async function getValue<T>(env: Env, path: string): Promise<T | null> {
  const response = await authorizedFetch(env, path)
  return (await response.json()) as T | null
}

/**
 * Ajoute un enfant sous `path` avec une clé générée par Firebase (équivalent de
 * `push()`) et retourne cette clé. Les clés push sont ordonnées chronologiquement.
 */
export async function pushValue(env: Env, path: string, value: unknown): Promise<string> {
  const response = await authorizedFetch(env, path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  })
  const data = (await response.json()) as { name: string }
  return data.name
}
