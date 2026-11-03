/** Accès à l'API : routes publiques, et 401 sans jeton (ou avec un jeton invalide) sur les 13 routes protégées. */
import { expect, test } from '@playwright/test'

const PROTECTED: [string, string][] = [
  ['GET', '/users'],
  ['GET', '/users/test-e2e-a'],
  ['PUT', '/users/test-e2e-a'],
  ['POST', '/activities'],
  ['GET', '/activities'],
  ['PATCH', '/activities/x/status'],
  ['GET', '/conversations'],
  ['POST', '/conversations'],
  ['GET', '/conversations/x/messages'],
  ['POST', '/messages'],
  ['GET', '/favorites'],
  ['POST', '/favorites'],
  ['DELETE', '/favorites/x'],
]

test.describe('US02 - Connexion : accès à l’API', () => {
  test('US02 les 3 routes publiques répondent sans jeton', async ({ request }) => {
    const health = await request.get('/api/health')
    expect(health.status()).toBe(200)
    expect((await health.json()).status).toBe('ok')

    const spec = await request.get('/openapi.json')
    expect(spec.status()).toBe(200)
    // 9 chemins, 13 opérations : les 13 routes protégées.
    const paths: Record<string, object> = (await spec.json()).paths
    expect(Object.values(paths).flatMap((ops) => Object.keys(ops))).toHaveLength(13)

    const docs = await request.get('/docs')
    expect(docs.status()).toBe(200)
    expect(docs.headers()['content-type']).toContain('text/html')
  })

  for (const [method, url] of PROTECTED) {
    test(`US02 ${method} ${url} sans jeton = 401 missing_token`, async ({ request }) => {
      const response = await request.fetch(url, { method, data: method === 'GET' || method === 'DELETE' ? undefined : {} })
      expect(response.status()).toBe(401)
      expect((await response.json()).code).toBe('missing_token')
    })
  }

  test('US02 jeton invalide = 401 invalid_token', async ({ request }) => {
    const response = await request.get('/users', { headers: { Authorization: 'Bearer pas.un-vrai.jeton' } })
    expect(response.status()).toBe(401)
    expect((await response.json()).code).toBe('invalid_token')
  })
})
