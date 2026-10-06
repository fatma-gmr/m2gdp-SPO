/**
 * Erreur métier/HTTP typée, convertie en réponse JSON uniforme par le
 * gestionnaire d'erreurs global de l'application (voir src/index.ts).
 */
export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}
