/**
 * Prépare les tests API :
 * 1. nettoie les restes d'un lancement précédent ;
 * 2. crée (ou complète) les comptes Firebase de test, avec un e-mail (l'API en a besoin pour créer un profil) ;
 * 3. obtient un ID token par compte avec workers/scripts/get-test-token.mjs ;
 * 4. crée les profils de A et B via PUT /users/{id}.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, test as setup } from '@playwright/test'
import admin from 'firebase-admin'
import { ROOT, loadSecrets } from '../lib/env'
import {
  PROFILE_A,
  PROFILE_B,
  TOKENS_FILE,
  USER_A,
  USER_B,
  USER_SANS_PROFIL,
  cleanupTestData,
} from '../lib/testData'

const PROJECT_ID = 'binofit-a36cf'

setup('préparer les comptes et profils de test', async ({ request }) => {
  setup.setTimeout(90_000)
  const secrets = loadSecrets()
  await cleanupTestData()

  const app =
    admin.apps.find((a) => a?.name === 'binofit-tests') ??
    admin.initializeApp(
      {
        credential: admin.credential.cert({
          projectId: PROJECT_ID,
          clientEmail: secrets.firebaseClientEmail,
          privateKey: secrets.firebasePrivateKey,
        }),
        projectId: PROJECT_ID,
      },
      'binofit-tests',
    )

  // get-test-token.mjs attend un fichier JSON de compte de service : on le crée
  // le temps de l'appel, dans un dossier temporaire hors du dépôt, puis on le supprime.
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'binofit-sa-'))
  const serviceAccountPath = path.join(tmpDir, 'service-account.json')
  const tokens: Record<string, string> = {}
  try {
    writeFileSync(
      serviceAccountPath,
      JSON.stringify({
        type: 'service_account',
        project_id: PROJECT_ID,
        client_email: secrets.firebaseClientEmail,
        private_key: secrets.firebasePrivateKey,
      }),
      { mode: 0o600 },
    )
    for (const user of [USER_A, USER_B, USER_SANS_PROFIL]) {
      try {
        await app.auth().updateUser(user.uid, { email: user.email, emailVerified: true })
      } catch (error) {
        if ((error as { code?: string }).code !== 'auth/user-not-found') throw error
        await app.auth().createUser({ uid: user.uid, email: user.email, emailVerified: true })
      }
      tokens[user.uid] = execFileSync('node', [path.join(ROOT, 'workers/scripts/get-test-token.mjs'), user.uid], {
        cwd: path.join(ROOT, 'workers'),
        env: {
          ...process.env,
          GOOGLE_APPLICATION_CREDENTIALS: serviceAccountPath,
          FIREBASE_WEB_API_KEY: secrets.firebaseWebApiKey,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      })
        .toString()
        .trim()
    }
  } finally {
    rmSync(tmpDir, { recursive: true, force: true })
  }

  for (const [user, profile] of [
    [USER_A, PROFILE_A],
    [USER_B, PROFILE_B],
  ] as const) {
    const response = await request.put(`/users/${user.uid}`, {
      headers: { Authorization: `Bearer ${tokens[user.uid]}` },
      data: profile,
    })
    expect(response.status(), await response.text()).toBe(201)
  }

  mkdirSync(path.dirname(TOKENS_FILE), { recursive: true })
  writeFileSync(TOKENS_FILE, JSON.stringify(tokens), { mode: 0o600 })
})
