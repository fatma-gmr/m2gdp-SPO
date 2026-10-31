/**
 * BINOFIT API — variables d'environnement et bindings Cloudflare Worker.
 *
 * SUPABASE_SECRET_KEY donne un accès complet à la base Supabase : elle DOIT être
 * configurée comme secret Wrangler (`wrangler secret put SUPABASE_SECRET_KEY`, et
 * `.dev.vars` en local, voir .dev.vars.example), jamais commitée ni codée en dur.
 */
export interface Env {
  ENVIRONMENT?: string
  /** Sert uniquement à vérifier les jetons Firebase Auth (audience/émetteur). */
  FIREBASE_PROJECT_ID: string
  /** URL du projet Supabase, ex. https://<ref>.supabase.co (non sensible, wrangler.toml). */
  SUPABASE_URL: string
  SUPABASE_SECRET_KEY: string
}

export interface AuthUser {
  uid: string
  email?: string
}

/** Type d'environnement Hono partagé par l'app et toutes les routes/middlewares. */
export type AppBindings = {
  Bindings: Env
  Variables: {
    authUser: AuthUser
  }
}
