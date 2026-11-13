import { auth } from '../firebase'
import type {
  Activity,
  ActivityCreate,
  ActivityStatus,
  ApiErrorBody,
  Conversation,
  ConversationCreate,
  Favorite,
  FavoriteCreate,
  Message,
  MessageCreate,
  Sport,
  User,
  UserSearchParams,
  UserSearchResult,
  UserUpdate,
  Venue,
} from '../types/api'

/** URL de base de l'API (sans slash final), lue depuis public/.env. */
const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

/** Erreur renvoyée par l'API, avec le statut HTTP et le code machine éventuel. */
export class ApiError extends Error {
  readonly status: number
  readonly code?: string

  constructor(status: number, message: string, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

type QueryValue = string | number | undefined | null
type Query = Record<string, QueryValue>

/**
 * Appel HTTP central : ajoute l'URL de base et le jeton Firebase de l'utilisateur connecté.
 *
 * @throws ApiError si l'utilisateur n'est pas connecté ou si l'API répond avec une erreur
 */
async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  options: { query?: Query; body?: unknown } = {},
): Promise<T> {
  const currentUser = auth.currentUser
  if (!currentUser) {
    throw new ApiError(401, 'Vous devez être connecté.', 'UNAUTHENTICATED')
  }
  const token = await currentUser.getIdToken()

  const url = new URL(`${BASE_URL}${path}`)
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value))
    }
  }

  const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'

  const response = await fetch(url, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })

  const text = await response.text()
  const data = text ? (JSON.parse(text) as unknown) : undefined

  if (!response.ok) {
    const errorBody = data as Partial<ApiErrorBody> | undefined
    throw new ApiError(
      response.status,
      errorBody?.error ?? 'Une erreur est survenue, réessaie.',
      errorBody?.code,
    )
  }

  return data as T
}

/** Client API BINOFIT : une méthode par route de specs/openapi.json. */
export const api = {
  /** GET /users : profils proches, triés par distance. */
  /** GET /venues : lieux de pratique du sport à Lyon (OpenStreetMap, cache serveur). */
  // `v` : version de la liste, pour ne pas réutiliser une réponse mise en cache par le navigateur avant les nouveaux termes.
  listVenues: (sport: Sport) => request<Venue[]>('GET', '/venues', { query: { sport, v: '3' } }),

  searchUsers: (params: UserSearchParams = {}) =>
    request<UserSearchResult[]>('GET', '/users', { query: { ...params } }),

  /** GET /users/{id} */
  getUser: (id: string) => request<User>('GET', `/users/${encodeURIComponent(id)}`),

  /** PUT /users/{id} : ne modifie que son propre profil. */
  updateUser: (id: string, body: UserUpdate) =>
    request<User>('PUT', `/users/${encodeURIComponent(id)}`, { body }),

  /** POST /activities */
  createActivity: (body: ActivityCreate) =>
    request<Activity>('POST', '/activities', { body }),

  /** GET /activities : les activités de l'utilisateur connecté. */
  listActivities: (userId?: string) =>
    request<Activity[]>('GET', '/activities', { query: { userId } }),

  /** PATCH /activities/{id}/status */
  updateActivityStatus: (id: string, status: ActivityStatus) =>
    request<Activity>('PATCH', `/activities/${encodeURIComponent(id)}/status`, {
      body: { status },
    }),

  /** GET /conversations */
  listConversations: () => request<Conversation[]>('GET', '/conversations'),

  /** POST /conversations */
  createConversation: (body: ConversationCreate) =>
    request<Conversation>('POST', '/conversations', { body }),

  /** GET /conversations/{id}/messages */
  listMessages: (conversationId: string, query: { limit?: number; before?: string } = {}) =>
    request<Message[]>('GET', `/conversations/${encodeURIComponent(conversationId)}/messages`, {
      query,
    }),

  /** POST /messages */
  sendMessage: (body: MessageCreate) => request<Message>('POST', '/messages', { body }),

  /** GET /favorites */
  listFavorites: () => request<Favorite[]>('GET', '/favorites'),

  /** POST /favorites */
  addFavorite: (body: FavoriteCreate) => request<Favorite>('POST', '/favorites', { body }),

  /** DELETE /favorites/{targetId} */
  removeFavorite: (targetId: string) =>
    request<void>('DELETE', `/favorites/${encodeURIComponent(targetId)}`),
}
