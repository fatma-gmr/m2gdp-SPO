/**
 * BINOFIT API — client minimal pour l'API REST Firestore.
 *
 * On n'utilise pas le SDK Firebase Admin (incompatible avec le runtime Workers) :
 * on appelle directement https://firestore.googleapis.com/v1/... avec un access_token
 * de compte de service (voir serviceAccountAuth.ts), et on convertit nous-mêmes entre
 * le format "typed value" de Firestore et des objets JS classiques.
 */
import type { Env } from '../env'
import { ApiError } from './apiError'
import { getGoogleAccessToken } from './serviceAccountAuth'

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { timestampValue: string }
  | { mapValue: { fields?: Record<string, FirestoreValue> } }
  | { arrayValue: { values?: FirestoreValue[] } }

export interface FirestoreDocument {
  name: string
  fields?: Record<string, FirestoreValue>
  createTime?: string
  updateTime?: string
}

function firestoreBaseUrl(env: Env): string {
  return `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`
}

async function authorizedFetch(env: Env, url: string, init?: RequestInit): Promise<Response> {
  const accessToken = await getGoogleAccessToken(env)
  return fetch(url, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${accessToken}`,
    },
  })
}

// --- Conversion valeurs JS <-> Firestore "typed value" ---------------------

export function encodeFirestoreValue(value: unknown): FirestoreValue {
  if (value === null || value === undefined) return { nullValue: null }
  if (typeof value === 'string') return { stringValue: value }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value }
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(encodeFirestoreValue) } }
  }
  if (typeof value === 'object') {
    return { mapValue: { fields: encodeFirestoreFields(value as Record<string, unknown>) } }
  }
  throw new ApiError(500, 'encode_error', `Type non supporté pour Firestore: ${typeof value}`)
}

export function encodeFirestoreFields(obj: Record<string, unknown>): Record<string, FirestoreValue> {
  const fields: Record<string, FirestoreValue> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue
    fields[key] = encodeFirestoreValue(value)
  }
  return fields
}

export function decodeFirestoreValue(value: FirestoreValue): unknown {
  if ('stringValue' in value) return value.stringValue
  if ('integerValue' in value) return Number(value.integerValue)
  if ('doubleValue' in value) return value.doubleValue
  if ('booleanValue' in value) return value.booleanValue
  if ('nullValue' in value) return null
  if ('timestampValue' in value) return value.timestampValue
  if ('mapValue' in value) return decodeFirestoreFields(value.mapValue.fields ?? {})
  if ('arrayValue' in value) return (value.arrayValue.values ?? []).map(decodeFirestoreValue)
  return null
}

export function decodeFirestoreFields(fields: Record<string, FirestoreValue>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(fields)) {
    result[key] = decodeFirestoreValue(value)
  }
  return result
}

/** Extrait l'identifiant du document depuis son `name` complet Firestore. */
export function documentIdFromName(name: string): string {
  const id = name.split('/').pop()
  if (!id) throw new ApiError(500, 'firestore_error', `Nom de document Firestore invalide: ${name}`)
  return id
}

// --- Opérations REST --------------------------------------------------------

/** Récupère un document par id, ou `null` s'il n'existe pas. */
export async function getDocument(
  env: Env,
  collection: string,
  id: string,
): Promise<FirestoreDocument | null> {
  const response = await authorizedFetch(env, `${firestoreBaseUrl(env)}/${collection}/${id}`)
  if (response.status === 404) return null
  if (!response.ok) {
    throw new ApiError(502, 'firestore_error', `Erreur Firestore (${response.status}) sur ${collection}/${id}`)
  }
  return (await response.json()) as FirestoreDocument
}

/**
 * Liste tous les documents d'une collection (avec pagination automatique).
 *
 * Note : les filtres avancés (sport/level/availability/distance) sont appliqués
 * côté Worker après récupération — voir /specs/data-model.md pour la justification
 * (Firestore ne permet pas nativement une requête géographique par rayon, et les
 * filtres sur sous-champs d'un tableau de maps nécessiteraient une dénormalisation).
 */
export async function listDocuments(env: Env, collection: string): Promise<FirestoreDocument[]> {
  const documents: FirestoreDocument[] = []
  let pageToken: string | undefined

  do {
    const url = new URL(`${firestoreBaseUrl(env)}/${collection}`)
    url.searchParams.set('pageSize', '300')
    if (pageToken) url.searchParams.set('pageToken', pageToken)

    const response = await authorizedFetch(env, url.toString())
    if (!response.ok) {
      throw new ApiError(502, 'firestore_error', `Erreur Firestore (${response.status}) sur ${collection}`)
    }

    const data = (await response.json()) as { documents?: FirestoreDocument[]; nextPageToken?: string }
    documents.push(...(data.documents ?? []))
    pageToken = data.nextPageToken
  } while (pageToken)

  return documents
}

/** Met à jour partiellement un document (PATCH + updateMask sur les champs fournis). */
export async function patchDocument(
  env: Env,
  collection: string,
  id: string,
  fields: Record<string, unknown>,
): Promise<FirestoreDocument> {
  const url = new URL(`${firestoreBaseUrl(env)}/${collection}/${id}`)
  for (const key of Object.keys(fields)) {
    url.searchParams.append('updateMask.fieldPaths', key)
  }

  const response = await authorizedFetch(env, url.toString(), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: encodeFirestoreFields(fields) }),
  })

  if (!response.ok) {
    throw new ApiError(502, 'firestore_error', `Erreur Firestore (${response.status}) sur ${collection}/${id}`)
  }
  return (await response.json()) as FirestoreDocument
}

/**
 * Crée un document. Sans `id`, Firestore génère un identifiant aléatoire.
 * Un `id` déjà existant provoque une erreur 409.
 */
export async function createDocument(
  env: Env,
  collection: string,
  fields: Record<string, unknown>,
  id?: string,
): Promise<FirestoreDocument> {
  const url = new URL(`${firestoreBaseUrl(env)}/${collection}`)
  if (id) url.searchParams.set('documentId', id)

  const response = await authorizedFetch(env, url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: encodeFirestoreFields(fields) }),
  })

  if (response.status === 409) {
    throw new ApiError(409, 'already_exists', `Le document ${collection}/${id} existe déjà`)
  }
  if (!response.ok) {
    throw new ApiError(502, 'firestore_error', `Erreur Firestore (${response.status}) sur ${collection}`)
  }
  return (await response.json()) as FirestoreDocument
}

/** Supprime un document (sans erreur s'il n'existe pas). */
export async function deleteDocument(env: Env, collection: string, id: string): Promise<void> {
  const response = await authorizedFetch(env, `${firestoreBaseUrl(env)}/${collection}/${id}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    throw new ApiError(502, 'firestore_error', `Erreur Firestore (${response.status}) sur ${collection}/${id}`)
  }
}

/**
 * Retourne les documents d'une collection dont `fieldPath` vérifie `op` (égalité ou
 * appartenance à un tableau). Un seul filtre par requête : ces requêtes sont couvertes
 * par les index mono-champ automatiques de Firestore, sans index composite à déclarer.
 * Le tri éventuel est fait côté Worker.
 */
export async function queryDocuments(
  env: Env,
  collection: string,
  fieldPath: string,
  op: 'EQUAL' | 'ARRAY_CONTAINS',
  value: unknown,
): Promise<FirestoreDocument[]> {
  const response = await authorizedFetch(env, `${firestoreBaseUrl(env)}:runQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: collection }],
        where: { fieldFilter: { field: { fieldPath }, op, value: encodeFirestoreValue(value) } },
      },
    }),
  })

  if (!response.ok) {
    throw new ApiError(502, 'firestore_error', `Erreur Firestore (${response.status}) sur la requête ${collection}`)
  }

  // runQuery renvoie un élément par résultat, plus un élément sans `document` si vide.
  const results = (await response.json()) as { document?: FirestoreDocument }[]
  return results.flatMap((result) => (result.document ? [result.document] : []))
}

/** Convertit un document Firestore en entité de domaine `{ id, ...champs }`. */
export function firestoreDocumentToEntity<T extends { id: string }>(doc: FirestoreDocument): T {
  return { id: documentIdFromName(doc.name), ...decodeFirestoreFields(doc.fields ?? {}) } as T
}
