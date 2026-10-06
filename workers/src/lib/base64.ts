/**
 * Encodage/décodage base64 et base64url sans dépendance Node (Web APIs
 * `atob`/`btoa`, disponibles dans le runtime Cloudflare Workers).
 */

/** Décode une chaîne base64 standard (utilisée pour le corps PEM d'une clé privée). */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/** Décode une chaîne base64url (utilisée dans les parties d'un JWT). */
export function base64UrlToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const paddingLength = (4 - (base64.length % 4)) % 4
  return base64ToUint8Array(base64 + '='.repeat(paddingLength))
}

/** Encode des octets en base64url (sans padding), format attendu par les JWT. */
export function uint8ArrayToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Décode la partie base64url d'un JWT (header ou payload) en objet JSON. */
export function decodeJwtPart<T>(part: string): T {
  const bytes = base64UrlToUint8Array(part)
  const json = new TextDecoder().decode(bytes)
  return JSON.parse(json) as T
}
