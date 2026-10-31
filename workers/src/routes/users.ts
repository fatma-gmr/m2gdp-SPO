/**
 * BINOFIT API — routes /users (voir /specs/openapi.json).
 */
import { Hono } from 'hono'
import type { AppBindings } from '../env'
import { ApiError } from '../lib/apiError'
import {
  USER_SELECT,
  availabilityToRows,
  rowToUser,
  sportsToRows,
  userUpdateToRow,
  type UserRow,
} from '../lib/dbMapper'
import { haversineDistanceKm } from '../lib/geo'
import { UNIQUE_VIOLATION, databaseError, getSupabase, unwrap } from '../lib/supabase'
import { validateUserCreate, validateUserUpdate } from '../lib/userMapper'
import { firebaseAuth } from '../middleware/auth'
import {
  DAYS_OF_WEEK,
  LEVELS,
  SPORTS,
  type DayOfWeek,
  type Level,
  type Sport,
  type User,
  type UserSearchResult,
  type UserUpdate,
} from '../types'

export const usersRoute = new Hono<AppBindings>()

// Toutes les routes /users exigent un utilisateur authentifié.
usersRoute.use('*', firebaseAuth())

function parseOptionalNumber(raw: string | undefined, label: string): number | undefined {
  if (raw === undefined) return undefined
  const value = Number(raw)
  if (Number.isNaN(value)) {
    throw new ApiError(400, 'invalid_query', `${label} doit être un nombre`)
  }
  return value
}

function assertEnumOrUndefined<T extends string>(
  raw: string | undefined,
  allowed: readonly T[],
  label: string,
): T | undefined {
  if (raw === undefined) return undefined
  if (!allowed.includes(raw as T)) {
    throw new ApiError(400, 'invalid_query', `${label} invalide: ${raw} (attendu: ${allowed.join(', ')})`)
  }
  return raw as T
}

async function getUser(env: AppBindings['Bindings'], id: string): Promise<User | null> {
  const row = unwrap(await getSupabase(env).from('users').select(USER_SELECT).eq('id', id).maybeSingle(), 'users')
  return row ? rowToUser(row as unknown as UserRow) : null
}

/** Remplace les sports et/ou créneaux de `userId` s'ils sont fournis (suppression puis insertion). */
async function replaceUserCollections(
  env: AppBindings['Bindings'],
  userId: string,
  { sports, availability }: Pick<UserUpdate, 'sports' | 'availability'>,
): Promise<void> {
  const supabase = getSupabase(env)
  if (sports !== undefined) {
    unwrap(await supabase.from('user_sports').delete().eq('user_id', userId), 'user_sports')
    if (sports.length > 0) {
      unwrap(await supabase.from('user_sports').insert(sportsToRows(userId, sports)), 'user_sports')
    }
  }
  if (availability !== undefined) {
    unwrap(await supabase.from('user_availability').delete().eq('user_id', userId), 'user_availability')
    if (availability.length > 0) {
      unwrap(
        await supabase.from('user_availability').insert(availabilityToRows(userId, availability)),
        'user_availability',
      )
    }
  }
}

/**
 * GET /users?lat&lng&maxKm&sport&level&availability
 *
 * Récupère l'ensemble des profils (avec sports et créneaux) puis filtre/trie côté
 * Worker, distance de Haversine comprise. Acceptable pour le volume attendu du POC ;
 * à déplacer dans Postgres (filtres + PostGIS/bounding box) si la base grossit.
 *
 * Quand lat/lng/maxKm sont fournis, chaque utilisateur retourné porte en plus
 * `distanceKm` (distance à vol d'oiseau depuis (lat, lng), arrondie à 1 décimale).
 */
usersRoute.get('/', async (c) => {
  const query = c.req.query()

  const lat = parseOptionalNumber(query.lat, 'lat')
  const lng = parseOptionalNumber(query.lng, 'lng')
  const maxKm = parseOptionalNumber(query.maxKm, 'maxKm')
  const sport = assertEnumOrUndefined<Sport>(query.sport, SPORTS, 'sport')
  const level = assertEnumOrUndefined<Level>(query.level, LEVELS, 'level')
  const availability = assertEnumOrUndefined<DayOfWeek>(query.availability, DAYS_OF_WEEK, 'availability')

  const hasAnyGeoParam = lat !== undefined || lng !== undefined || maxKm !== undefined
  if (hasAnyGeoParam && (lat === undefined || lng === undefined || maxKm === undefined)) {
    throw new ApiError(400, 'invalid_query', 'lat, lng et maxKm doivent être fournis ensemble')
  }
  if (maxKm !== undefined && maxKm < 0) {
    throw new ApiError(400, 'invalid_query', 'maxKm doit être positif')
  }

  const rows = unwrap(await getSupabase(c.env).from('users').select(USER_SELECT), 'users')
  let users: UserSearchResult[] = (rows as unknown as UserRow[]).map(rowToUser)

  if (sport !== undefined) {
    users = users.filter((user) => user.sports.some((practice) => practice.sport === sport))
  }
  if (level !== undefined) {
    users = users.filter((user) => user.sports.some((practice) => practice.level === level))
  }
  if (availability !== undefined) {
    users = users.filter((user) => user.availability.some((slot) => slot.dayOfWeek === availability))
  }

  if (lat !== undefined && lng !== undefined && maxKm !== undefined) {
    const origin = { lat, lng }
    users = users
      .map((user) => ({ user, distanceKm: haversineDistanceKm(origin, user.location) }))
      .filter(({ distanceKm }) => distanceKm <= maxKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .map(({ user, distanceKm }) => ({ ...user, distanceKm: Math.round(distanceKm * 10) / 10 }))
  }

  return c.json(users)
})

/** GET /users/{id} */
usersRoute.get('/:id', async (c) => {
  const id = c.req.param('id')
  const user = await getUser(c.env, id)
  if (!user) {
    throw new ApiError(404, 'user_not_found', 'Utilisateur introuvable')
  }
  return c.json(user)
})

/**
 * PUT /users/{id} — crée ou met à jour le profil de l'utilisateur connecté.
 *
 * `id` doit être l'uid du jeton : on ne peut ni créer ni modifier le profil d'un autre.
 * L'e-mail n'est jamais lu dans le corps, il vient toujours du jeton.
 * - Profil inexistant : création (201) avec createdAt = updatedAt = maintenant.
 * - Profil existant : mise à jour partielle (200), updatedAt rafraîchi.
 * sports et availability, quand ils sont fournis, remplacent entièrement les lignes
 * de user_sports / user_availability.
 */
usersRoute.put('/:id', async (c) => {
  const id = c.req.param('id')
  const authUser = c.get('authUser')

  if (authUser.uid !== id) {
    throw new ApiError(403, 'forbidden', 'Vous ne pouvez modifier que votre propre profil')
  }

  const body = await c.req.json().catch(() => {
    throw new ApiError(400, 'invalid_body', 'Corps de requête JSON invalide')
  })

  const now = new Date().toISOString()
  const supabase = getSupabase(c.env)
  const existing = await getUser(c.env, id)

  if (!existing) {
    const profile = validateUserCreate(body)
    if (!authUser.email) {
      throw new ApiError(400, 'missing_email', "Le jeton d'authentification ne contient pas d'e-mail")
    }
    const { error } = await supabase
      .from('users')
      .insert({ id, email: authUser.email, ...userUpdateToRow(profile), created_at: now, updated_at: now })
    if (error?.code === UNIQUE_VIOLATION) {
      throw new ApiError(409, 'already_exists', `Le profil ${id} existe déjà`)
    }
    if (error) throw databaseError(error, 'users')
    await replaceUserCollections(c.env, id, profile)
    return c.json(await getUser(c.env, id), 201)
  }

  const updates = validateUserUpdate(body)
  unwrap(
    await supabase
      .from('users')
      .update({ ...userUpdateToRow(updates), ...(authUser.email ? { email: authUser.email } : {}), updated_at: now })
      .eq('id', id),
    'users',
  )
  await replaceUserCollections(c.env, id, updates)

  return c.json(await getUser(c.env, id))
})
