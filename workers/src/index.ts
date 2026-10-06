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
import { usersRoute } from './routes/users'

export type { Env } from './env'

const ALLOWED_ORIGINS = ['https://binofit-a36cf.web.app', 'http://localhost:5173']

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

app.route('/users', usersRoute)

app.notFound((c) => c.json({ error: 'Route introuvable', code: 'not_found' }, 404))

app.onError((error, c) => {
  if (error instanceof ApiError) {
    return c.json({ error: error.message, code: error.code }, error.status as 400 | 401 | 403 | 404 | 500 | 502)
  }
  console.error('[BINOFIT API] Erreur non gérée:', error)
  return c.json({ error: 'Erreur interne du serveur', code: 'internal_error' }, 500)
})

export default app
