/**
 * Lecture des identifiants locaux, sans jamais les écrire dans le dépôt :
 * - workers/.dev.vars : FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, SUPABASE_SECRET_KEY ;
 * - workers/wrangler.toml : SUPABASE_URL ;
 * - public/.env : VITE_FIREBASE_API_KEY (clé web, utilisée comme FIREBASE_WEB_API_KEY).
 * Les variables d'environnement du même nom sont prioritaires.
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

export const ROOT = path.resolve(__dirname, '../..')

function parseEnvFile(file: string): Record<string, string> {
  if (!existsSync(file)) return {}
  const values: Record<string, string> = {}
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!match) continue
    let value = match[2]
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    values[match[1]] = value
  }
  return values
}

function supabaseUrlFromWrangler(): string | undefined {
  const file = path.join(ROOT, 'workers/wrangler.toml')
  if (!existsSync(file)) return undefined
  return readFileSync(file, 'utf8').match(/^SUPABASE_URL\s*=\s*"([^"]+)"/m)?.[1]
}

export interface Secrets {
  firebaseClientEmail: string
  firebasePrivateKey: string
  firebaseWebApiKey: string
  supabaseUrl: string
  supabaseSecretKey: string
}

export function loadSecrets(): Secrets {
  const devVars = parseEnvFile(path.join(ROOT, 'workers/.dev.vars'))
  const frontEnv = parseEnvFile(path.join(ROOT, 'public/.env'))
  const pick = (name: string, fallback?: string) => process.env[name] ?? fallback

  const secrets = {
    firebaseClientEmail: pick('FIREBASE_CLIENT_EMAIL', devVars.FIREBASE_CLIENT_EMAIL),
    firebasePrivateKey: pick('FIREBASE_PRIVATE_KEY', devVars.FIREBASE_PRIVATE_KEY)?.replace(/\\n/g, '\n'),
    firebaseWebApiKey: pick('FIREBASE_WEB_API_KEY', frontEnv.VITE_FIREBASE_API_KEY),
    supabaseUrl: pick('SUPABASE_URL', supabaseUrlFromWrangler()),
    supabaseSecretKey: pick('SUPABASE_SECRET_KEY', devVars.SUPABASE_SECRET_KEY),
  }
  const missing = Object.entries(secrets)
    .filter(([, value]) => !value)
    .map(([key]) => key)
  if (missing.length > 0) {
    throw new Error(`Identifiants manquants pour les tests API : ${missing.join(', ')} (voir tests/README.md).`)
  }
  return secrets as Secrets
}
