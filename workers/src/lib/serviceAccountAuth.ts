/**
 * BINOFIT API — authentification du Worker auprès de Google Cloud (API REST Firestore
 * et Realtime Database) via un compte de service, par échange OAuth2 "JWT bearer" (RFC 7523).
 *
 * On ne peut pas utiliser les SDK Node Firebase Admin dans un Worker : on signe donc
 * nous-mêmes un JWT RS256 avec la clé privée du compte de service (Web Crypto API),
 * puis on l'échange contre un access_token auprès de Google.
 */
import type { Env } from '../env'
import { ApiError } from './apiError'
import { base64ToUint8Array, uint8ArrayToBase64Url } from './base64'

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
/**
 * Un seul access_token couvre les deux bases :
 * - `datastore` → API REST Firestore ;
 * - `firebase.database` + `userinfo.email` → API REST Realtime Database (les deux
 *   scopes sont exigés par Firebase pour authentifier un compte de service).
 */
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/datastore',
  'https://www.googleapis.com/auth/firebase.database',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ')

interface CachedToken {
  accessToken: string
  expiresAt: number
}

// Mis en cache au niveau du module : réutilisé entre requêtes tant que l'isolate
// Worker reste "chaud", évite de resigner un JWT et de rappeler Google à chaque requête.
let cachedToken: CachedToken | null = null

/**
 * Normalise une clé privée PEM fournie en secret Wrangler : si elle contient des
 * "\n" littéraux (cas fréquent en CLI/CI où les retours à la ligne réels sont perdus),
 * on les convertit en véritables retours à la ligne.
 */
function normalizePrivateKeyPem(pem: string): string {
  return pem.includes('\\n') ? pem.replace(/\\n/g, '\n') : pem
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemContents = normalizePrivateKeyPem(pem)
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '')

  if (!pemContents) {
    throw new ApiError(500, 'config_error', 'FIREBASE_PRIVATE_KEY est manquant ou mal formé')
  }

  const keyData = base64ToUint8Array(pemContents)
  return crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

async function createSignedAssertion(env: Env): Promise<string> {
  if (!env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
    throw new ApiError(
      500,
      'config_error',
      'FIREBASE_CLIENT_EMAIL et FIREBASE_PRIVATE_KEY doivent être configurés (secrets Wrangler)',
    )
  }

  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const claims = {
    iss: env.FIREBASE_CLIENT_EMAIL,
    scope: GOOGLE_SCOPES,
    aud: TOKEN_ENDPOINT,
    iat: now,
    exp: now + 3600,
  }

  const encoder = new TextEncoder()
  const headerPart = uint8ArrayToBase64Url(encoder.encode(JSON.stringify(header)))
  const claimsPart = uint8ArrayToBase64Url(encoder.encode(JSON.stringify(claims)))
  const unsignedToken = `${headerPart}.${claimsPart}`

  const privateKey = await importPrivateKey(env.FIREBASE_PRIVATE_KEY)
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    encoder.encode(unsignedToken),
  )

  return `${unsignedToken}.${uint8ArrayToBase64Url(new Uint8Array(signature))}`
}

/** Retourne un access_token OAuth2 valide (Firestore + Realtime Database), en le mettant en cache. */
export async function getGoogleAccessToken(env: Env): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  if (cachedToken && cachedToken.expiresAt - 60 > now) {
    return cachedToken.accessToken
  }

  const assertion = await createSignedAssertion(env)
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    console.error('[BINOFIT API] Échec d\'obtention du jeton Google:', response.status, detail)
    throw new ApiError(502, 'google_auth_failed', "Impossible d'obtenir un jeton d'accès Google")
  }

  const data = (await response.json()) as { access_token: string; expires_in: number }
  cachedToken = { accessToken: data.access_token, expiresAt: now + data.expires_in }
  return cachedToken.accessToken
}
