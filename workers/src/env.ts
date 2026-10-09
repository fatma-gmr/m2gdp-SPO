/**
 * BINOFIT API — variables d'environnement et bindings Cloudflare Worker.
 *
 * FIREBASE_CLIENT_EMAIL et FIREBASE_PRIVATE_KEY proviennent du compte de service
 * Firebase/Google Cloud et DOIVENT être configurés comme secrets Wrangler
 * (`wrangler secret put ...`), jamais commités ni codés en dur. Voir README.md.
 */
export interface Env {
  ENVIRONMENT?: string
  FIREBASE_PROJECT_ID: string
  /** URL de la Realtime Database (messages), ex. https://<projet>-default-rtdb.<région>.firebasedatabase.app */
  FIREBASE_DATABASE_URL: string
  FIREBASE_CLIENT_EMAIL: string
  FIREBASE_PRIVATE_KEY: string
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
