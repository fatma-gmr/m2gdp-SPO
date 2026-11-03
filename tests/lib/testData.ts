/**
 * Comptes de test dédiés : ils ne touchent jamais aux profils du seed (user-001…).
 * A et B ont un profil ; SANS_PROFIL n'en a pas (pour tester 403 profile_required).
 * Toutes leurs données sont supprimées de Supabase par cleanup.teardown.ts.
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { loadSecrets } from './env'

export const USER_A = { uid: 'test-e2e-a', email: 'test-e2e-a@example.com' }
export const USER_B = { uid: 'test-e2e-b', email: 'test-e2e-b@example.com' }
export const USER_SANS_PROFIL = { uid: 'test-e2e-sans-profil', email: 'test-e2e-sans-profil@example.com' }
export const TEST_UIDS = [USER_A.uid, USER_B.uid, USER_SANS_PROFIL.uid]

/** Lyon · Presqu'île et Lyon · Part-Dieu (public/src/services/location.ts), à environ 1,9 km l'une de l'autre. */
export const PRESQU_ILE = { lat: 45.7578, lng: 4.832, city: 'Lyon' }
export const PART_DIEU = { lat: 45.7606, lng: 4.8559, city: 'Lyon' }

export const PROFILE_A = {
  firstName: 'Test',
  lastName: 'Alpha',
  bio: 'Profil créé par les tests Playwright.',
  location: PRESQU_ILE,
  sports: [{ sport: 'tennis', level: 'intermediaire' }],
  availability: [{ dayOfWeek: 'samedi', startTime: '18:00', endTime: '21:00' }],
}

export const PROFILE_B = {
  firstName: 'Test',
  lastName: 'Beta',
  bio: 'Profil créé par les tests Playwright.',
  location: PART_DIEU,
  sports: [{ sport: 'autre', level: 'expert' }],
  availability: [{ dayOfWeek: 'dimanche', startTime: '07:00', endTime: '09:00' }],
}

export const TOKENS_FILE = path.join(__dirname, '../.auth/tokens.json')

export function tokens(): Record<string, string> {
  if (!existsSync(TOKENS_FILE)) throw new Error('Jetons absents : lancer les tests via le projet "api" (le setup les crée).')
  return JSON.parse(readFileSync(TOKENS_FILE, 'utf8'))
}

/** Supprime de Supabase tout ce qui appartient aux comptes de test (PostgREST, clé secrète locale). */
export async function cleanupTestData(): Promise<void> {
  const { supabaseUrl, supabaseSecretKey } = loadSecrets()
  const ids = `(${TEST_UIDS.join(',')})`
  const headers = { apikey: supabaseSecretKey, 'Content-Type': 'application/json', Prefer: 'return=minimal' }
  const rest = async (method: string, query: string) => {
    const response = await fetch(`${supabaseUrl}/rest/v1/${query}`, { method, headers })
    if (!response.ok) throw new Error(`Nettoyage ${method} ${query.split('?')[0]} : ${response.status} ${await response.text()}`)
    return method === 'GET' ? response.json() : null
  }

  const participants = (await rest('GET', `participants?select=conversation_id&user_id=in.${ids}`)) as { conversation_id: string }[]
  const conversationIds = [...new Set(participants.map((p) => p.conversation_id))]
  if (conversationIds.length > 0) {
    // Les messages et participants partent en cascade.
    await rest('DELETE', `conversations?id=in.(${conversationIds.join(',')})`)
  }
  await rest('DELETE', `activities?or=(created_by.in.${ids},guest_id.in.${ids})`)
  await rest('DELETE', `favorites?target_id=in.${ids}`)
  // user_sports, user_availability et favorites des comptes de test partent en cascade.
  await rest('DELETE', `users?id=in.${ids}`)
}
