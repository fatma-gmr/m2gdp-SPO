/**
 * BINOFIT - Backend Cloudflare Worker API
 * 
 * Ce fichier constitue le point d'entrée de l'API Cloudflare Worker pour BINOFIT.
 * Il gère les requêtes HTTP entrantes, les en-têtes CORS et fournit des endpoints de santé (healthcheck).
 */

export interface Env {
  // Définition des variables d'environnement Cloudflare Worker (ex: DB, BUCKET, SECRETS)
  ENVIRONMENT?: string
}

/** En-têtes CORS par défaut pour permettre les requêtes depuis le frontend PWA BINOFIT */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export default {
  /**
   * Handler principal de requêtes HTTP pour Cloudflare Worker BINOFIT.
   * 
   * @param request La requête HTTP entrante
   * @param env Le dictionnaire des variables d'environnement et bindings Cloudflare
   * @param ctx Le contexte d'exécution du Worker
   * @returns Une promesse contenant la réponse HTTP à renvoyer au client
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    // Gestion du preflight CORS (OPTIONS)
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      })
    }

    // Endpoint d'état du service API (Healthcheck)
    if (url.pathname === '/api/health') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          service: 'BINOFIT API Worker',
          timestamp: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json; charset=utf-8',
          },
        },
      )
    }

    // Réponse par défaut pour la racine
    return new Response('BINOFIT API OK', {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/plain; charset=utf-8',
      },
    })
  },
}

