/**
 * BINOFIT API — documentation publique (sans authentification) :
 * - GET /openapi.json → contrat /specs/openapi.json, intégré au bundle par Wrangler ;
 * - GET /docs → Swagger UI (chargé depuis un CDN) pointant sur /openapi.json.
 */
import { Hono } from 'hono'
import type { AppBindings } from '../env'
import openApiSpec from '../../../specs/openapi.json'

// Version exacte épinglée : le CDN sert un fichier immuable.
const SWAGGER_UI_CDN = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14'

const SWAGGER_UI_HTML = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>BINOFIT API — Documentation</title>
    <link rel="stylesheet" href="${SWAGGER_UI_CDN}/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="${SWAGGER_UI_CDN}/swagger-ui-bundle.js" crossorigin></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: '/openapi.json',
        dom_id: '#swagger-ui',
        // Le jeton collé dans "Authorize" survit au rechargement de la page.
        persistAuthorization: true,
      })
    </script>
  </body>
</html>`

export const docsRoute = new Hono<AppBindings>()

/**
 * GET /openapi.json — le serveur qui sert la requête est placé en tête de `servers`,
 * pour que "Try it out" vise par défaut cette instance (wrangler dev ou production).
 */
docsRoute.get('/openapi.json', (c) => {
  const origin = new URL(c.req.url).origin
  const servers = [
    ...openApiSpec.servers.filter((server) => server.url === origin),
    ...openApiSpec.servers.filter((server) => server.url !== origin),
  ]
  if (servers[0]?.url !== origin) {
    servers.unshift({ url: origin, description: 'Serveur courant' })
  }
  return c.json({ ...openApiSpec, servers })
})

docsRoute.get('/docs', (c) => c.html(SWAGGER_UI_HTML))
