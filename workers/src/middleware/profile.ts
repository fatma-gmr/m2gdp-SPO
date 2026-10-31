/**
 * BINOFIT API — middleware exigeant que l'utilisateur du jeton ait un profil.
 *
 * Un compte Firebase Auth peut exister sans ligne dans la table `users` (profil pas
 * encore créé via PUT /users/{id}). Les écritures qui référencent l'utilisateur
 * (clés étrangères vers users) échoueraient alors en erreur de base de données :
 * on renvoie plutôt un 403 explicite. À placer après `firebaseAuth()`.
 */
import type { MiddlewareHandler } from 'hono'
import type { AppBindings } from '../env'
import { ApiError } from '../lib/apiError'
import { rowExists } from '../lib/supabase'

export function requireProfile(): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    if (!(await rowExists(c.env, 'users', c.get('authUser').uid))) {
      throw new ApiError(403, 'profile_required', 'Complète ton profil pour continuer')
    }
    await next()
  }
}
