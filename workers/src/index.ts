/**
 * BINOFIT - Backend Cloudflare Worker API
 *
 * Point d'entrée de l'API (Hono) : CORS, healthcheck, montage des routes et
 * gestion centralisée des erreurs. Voir /specs/openapi.json pour le contrat.
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { AppBindings } from './env'
import { ApiError } from './lib/apiError'
import { activitiesRoute } from './routes/activities'
import { conversationsRoute } from './routes/conversations'
import { docsRoute } from './routes/docs'
import { favoritesRoute } from './routes/favorites'
import { messagesRoute } from './routes/messages'
import { usersRoute } from './routes/users'
import { venuesRoute } from './routes/venues'
import { verifyFirebaseIdToken } from './middleware/auth'

export type { Env } from './env'
export { UserHub } from './realtime/userHub'

const ALLOWED_ORIGINS = ['https://binofit-a36cf.web.app', 'https://bino-fit.vercel.app', 'http://localhost:5173', 'http://localhost:5178']

const app = new Hono<AppBindings>()

app.use(
  '*',
  cors({
    origin: (origin) => (ALLOWED_ORIGINS.includes(origin) ? origin : ''),
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  }),
)

app.get('/api/health', (c) =>
  c.json({
    status: 'ok',
    service: 'BINOFIT API Worker',
    timestamp: new Date().toISOString(),
  }),
)

// Routes publiques (sans jeton) : GET /docs (Swagger UI) et GET /openapi.json.
app.route('/', docsRoute)
app.route('/users', usersRoute)
app.route('/activities', activitiesRoute)
app.route('/conversations', conversationsRoute)
app.route('/messages', messagesRoute)
app.route('/favorites', favoritesRoute)
app.route('/venues', venuesRoute)

/**
 * GET /realtime — WebSocket temps réel. Le navigateur ne peut pas envoyer d'en-tête
 * Authorization sur un WebSocket : le jeton Firebase voyage dans le sous-protocole
 * (`new WebSocket(url, ['binofit', jeton])`), jamais dans l'URL.
 */
app.get('/realtime', async (c) => {
  const offered = (c.req.header('Sec-WebSocket-Protocol') ?? '').split(',').map((p) => p.trim())
  const token = offered[1]
  if (c.req.header('Upgrade') !== 'websocket' || offered[0] !== 'binofit' || !token) {
    throw new ApiError(401, 'unauthenticated', 'Connexion temps réel non autorisée')
  }
  const payload = await verifyFirebaseIdToken(c.env, token).catch(() => {
    throw new ApiError(401, 'invalid_token', "Jeton d'authentification invalide")
  })
  const stub = c.env.USER_HUB.get(c.env.USER_HUB.idFromName(payload.sub))
  const upstream = await stub.fetch('https://user-hub/connect', { headers: { Upgrade: 'websocket' } })
  return new Response(null, { status: 101, webSocket: upstream.webSocket, headers: { 'Sec-WebSocket-Protocol': 'binofit' } })
})

app.notFound((c) => c.json({ error: 'Route introuvable', code: 'not_found' }, 404))

app.onError((error, c) => {
  if (error instanceof ApiError) {
    return c.json({ error: error.message, code: error.code }, error.status as 400 | 401 | 403 | 404 | 409 | 500 | 502)
  }
  console.error('[BINOFIT API] Erreur non gérée:', error)
  return c.json({ error: 'Erreur interne du serveur', code: 'internal_error' }, 500)
})

export default app
