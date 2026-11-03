/**
 * Simule l'API Firebase Auth (Identity Toolkit) dans le navigateur.
 * Aucun e-mail réel n'est envoyé : l'appel accounts:sendOobCode est intercepté et
 * toute autre requête vers identitytoolkit / securetoken est bloquée.
 */
import type { Page } from '@playwright/test'

export interface OobCall {
  requestType: string
  email: string
}

export async function mockFirebaseAuth(page: Page): Promise<OobCall[]> {
  const calls: OobCall[] = []
  await page.route(/https:\/\/(identitytoolkit|securetoken)\.googleapis\.com\/.*/, async (route) => {
    const url = route.request().url()
    if (!url.includes('accounts:sendOobCode')) {
      return route.abort()
    }
    const body = route.request().postDataJSON() as OobCall
    calls.push({ requestType: body.requestType, email: body.email })
    // Même règle de base que Firebase : une adresse sans « @domaine.tld » est refusée.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email ?? '')) {
      return route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 400, message: 'INVALID_EMAIL', errors: [{ message: 'INVALID_EMAIL' }] } }),
      })
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ kind: 'identitytoolkit#GetOobConfirmationCodeResponse', email: body.email }),
    })
  })
  return calls
}
