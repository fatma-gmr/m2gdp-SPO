/**
 * BINOFIT API — middleware de vérification des jetons d'identité Firebase.
 *
 * Firebase Auth émet des JWT RS256 signés avec une clé privée Google tournante ;
 * on vérifie la signature avec les clés publiques JWK officielles, puis les
 * revendications standard (émetteur, audience, expiration).
 * Référence : https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
 */
import type { MiddlewareHandler } from 'hono'
import { ApiError } from '../lib/apiError'
import { base64UrlToUint8Array, decodeJwtPart } from '../lib/base64'
import type { AppBindings, Env } from '../env'

const GOOGLE_JWK_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
const JWK_CACHE_TTL_SECONDS = 3600

interface FirebaseTokenPayload {
  iss: string
  aud: string
  sub: string
  iat: number
  exp: number
  email?: string
  [claim: string]: unknown
}

interface JwkWithKid extends JsonWebKey {
  kid: string
}

interface CachedKeys {
  keys: Record<string, CryptoKey>
  expiresAt: number
}

// Cache mémoire au niveau du module, partagé entre requêtes tant que l'isolate est chaud.
let cachedKeys: CachedKeys | null = null

async function getGooglePublicKeys(): Promise<Record<string, CryptoKey>> {
  const now = Math.floor(Date.now() / 1000)
  if (cachedKeys && cachedKeys.expiresAt > now) {
    return cachedKeys.keys
  }

  const response = await fetch(GOOGLE_JWK_URL)
  if (!response.ok) {
    throw new ApiError(502, 'auth_keys_unavailable', 'Impossible de récupérer les clés publiques Firebase')
  }
  const data = (await response.json()) as { keys: JwkWithKid[] }

  const keys: Record<string, CryptoKey> = {}
  for (const jwk of data.keys) {
    keys[jwk.kid] = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    )
  }

  cachedKeys = { keys, expiresAt: now + JWK_CACHE_TTL_SECONDS }
  return keys
}

async function verifyFirebaseIdToken(env: Env, idToken: string): Promise<FirebaseTokenPayload> {
  const parts = idToken.split('.')
  if (parts.length !== 3) {
    throw new ApiError(401, 'invalid_token', "Jeton d'authentification invalide")
  }
  const [headerPart, payloadPart, signaturePart] = parts as [string, string, string]

  const header = decodeJwtPart<{ alg: string; kid: string }>(headerPart)
  if (header.alg !== 'RS256') {
    throw new ApiError(401, 'invalid_token', 'Algorithme de signature non supporté')
  }

  const keys = await getGooglePublicKeys()
  const key = keys[header.kid]
  if (!key) {
    throw new ApiError(401, 'invalid_token', 'Clé de signature du jeton inconnue')
  }

  const signature = base64UrlToUint8Array(signaturePart)
  const signedData = new TextEncoder().encode(`${headerPart}.${payloadPart}`)
  const isValid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, signedData)
  if (!isValid) {
    throw new ApiError(401, 'invalid_token', 'Signature du jeton invalide')
  }

  const payload = decodeJwtPart<FirebaseTokenPayload>(payloadPart)
  const now = Math.floor(Date.now() / 1000)

  if (payload.exp <= now) {
    throw new ApiError(401, 'token_expired', 'Jeton expiré')
  }
  if (payload.iat > now + 60) {
    throw new ApiError(401, 'invalid_token', 'Jeton émis dans le futur')
  }
  if (payload.aud !== env.FIREBASE_PROJECT_ID) {
    throw new ApiError(401, 'invalid_token', 'Audience du jeton invalide')
  }
  if (payload.iss !== `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`) {
    throw new ApiError(401, 'invalid_token', 'Émetteur du jeton invalide')
  }
  if (!payload.sub) {
    throw new ApiError(401, 'invalid_token', 'Jeton sans sujet (sub)')
  }

  return payload
}

/** Middleware Hono exigeant un en-tête `Authorization: Bearer <jeton Firebase>` valide. */
export function firebaseAuth(): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    const header = c.req.header('Authorization')
    if (!header || !header.startsWith('Bearer ')) {
      throw new ApiError(401, 'missing_token', "En-tête 'Authorization: Bearer <jeton>' manquant")
    }

    const token = header.slice('Bearer '.length).trim()
    const payload = await verifyFirebaseIdToken(c.env, token)

    c.set('authUser', { uid: payload.sub, email: payload.email })
    await next()
  }
}
