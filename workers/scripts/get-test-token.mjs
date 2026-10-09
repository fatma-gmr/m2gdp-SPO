#!/usr/bin/env node
/**
 * BINOFIT — Génère un ID token Firebase valide, pour tester l'API Worker à la main.
 *
 * 1) Crée (ou récupère) l'utilisateur Firebase Auth "user-001" via firebase-admin.
 * 2) Génère un custom token pour cet utilisateur (admin.auth().createCustomToken).
 * 3) Échange ce custom token contre un ID token via l'API REST Identity Toolkit
 *    (accounts:signInWithCustomToken), qui est ce que fait normalement le SDK client.
 * 4) Affiche UNIQUEMENT l'ID token sur stdout (rien d'autre), prêt à coller dans
 *    `Authorization: Bearer <idToken>`.
 *
 * Identifiants : lus depuis GOOGLE_APPLICATION_CREDENTIALS (chemin vers le JSON du
 * compte de service) et FIREBASE_WEB_API_KEY (clé API web du projet, visible dans
 * Console Firebase > Paramètres du projet > Général > Clé API Web). Rien n'est
 * codé en dur dans ce fichier.
 *
 * Usage :
 *   GOOGLE_APPLICATION_CREDENTIALS=/chemin/vers/service-account.json \
 *   FIREBASE_WEB_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
 *   npm run test-token [uid]
 *
 * [uid] est optionnel, par défaut "user-001" (un des utilisateurs créés par seed.mjs).
 */
import { readFileSync } from 'node:fs'
import admin from 'firebase-admin'

const PROJECT_ID = 'binofit-a36cf'
const DEFAULT_TEST_UID = 'user-001'
const SIGN_IN_WITH_CUSTOM_TOKEN_URL = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken'

async function getOrCreateUser(uid) {
  try {
    return await admin.auth().getUser(uid)
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error
    return admin.auth().createUser({ uid })
  }
}

async function exchangeCustomTokenForIdToken(customToken, webApiKey) {
  const response = await fetch(`${SIGN_IN_WITH_CUSTOM_TOKEN_URL}?key=${webApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(
      `Échange du custom token échoué (${response.status}): ${data.error?.message ?? JSON.stringify(data)}`,
    )
  }
  return data.idToken
}

async function main() {
  const uid = process.argv[2] ?? DEFAULT_TEST_UID

  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (!credentialsPath) {
    console.error(
      "GOOGLE_APPLICATION_CREDENTIALS doit pointer vers le fichier JSON de la clé de compte de service Firebase.",
    )
    process.exit(1)
  }

  const webApiKey = process.env.FIREBASE_WEB_API_KEY
  if (!webApiKey) {
    console.error(
      'FIREBASE_WEB_API_KEY doit contenir la clé API web du projet (Console Firebase > Paramètres du projet > Général > Clé API Web).',
    )
    process.exit(1)
  }

  const serviceAccount = JSON.parse(readFileSync(credentialsPath, 'utf8'))
  if (serviceAccount.project_id !== PROJECT_ID) {
    console.warn(
      `⚠️  La clé de compte de service correspond au projet "${serviceAccount.project_id}", pas "${PROJECT_ID}". Vérifie GOOGLE_APPLICATION_CREDENTIALS.`,
    )
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
  })

  await getOrCreateUser(uid)
  const customToken = await admin.auth().createCustomToken(uid)
  const idToken = await exchangeCustomTokenForIdToken(customToken, webApiKey)

  // Seule ligne envoyée sur stdout : l'ID token (tout le reste passe par stderr).
  console.log(idToken)
  process.exit(0)
}

main().catch((error) => {
  console.error('Échec de la génération du jeton de test:', error)
  process.exit(1)
})
