/** Inscription, connexion et routes protégées, sans connexion réelle (Firebase simulé). */
import { expect, test, type Page } from '@playwright/test'
import { mockFirebaseAuth } from './firebaseMock'

async function fillRegister(page: Page, email: string) {
  await page.goto('/inscription')
  await page.locator('#prenom').fill('Alex')
  await page.locator('#nom').fill('Martin')
  await page.locator('#email').fill(email)
  await page.locator('#sport').selectOption({ index: 1 })
  await page.locator('#localisation').fill('Lyon')
  await page.getByRole('button', { name: "S'inscrire" }).click()
}

test.describe('US01 - Inscription', () => {
  test('US01 une adresse e-mail invalide affiche un message d’erreur', async ({ page }) => {
    const calls = await mockFirebaseAuth(page)
    await fillRegister(page, 'alex.martin@email')
    await expect(page.locator('.alert-error')).toHaveText("Cette adresse e-mail n'est pas valide.")
    await expect(page.getByRole('heading', { name: 'Vérifie ta boîte mail' })).toHaveCount(0)
    expect(calls).toHaveLength(1)
  })

  test('US01 un formulaire incomplet affiche un message, sans appel à Firebase', async ({ page }) => {
    const calls = await mockFirebaseAuth(page)
    await page.goto('/inscription')
    await page.locator('#email').fill('alex.martin@email.com')
    await page.getByRole('button', { name: "S'inscrire" }).click()
    await expect(page.locator('.alert-error')).toHaveText('Merci de remplir tous les champs.')
    expect(calls).toHaveLength(0)
  })

  test('US01 une adresse valide demande le lien magique (appel simulé)', async ({ page }) => {
    const calls = await mockFirebaseAuth(page)
    await fillRegister(page, 'alex.martin@example.com')
    await expect(page.getByRole('heading', { name: 'Vérifie ta boîte mail' })).toBeVisible()
    expect(calls).toEqual([{ requestType: 'EMAIL_SIGNIN', email: 'alex.martin@example.com' }])
  })
})

test.describe('US02 - Connexion', () => {
  test('US02 la page de connexion signale une adresse invalide', async ({ page }) => {
    const calls = await mockFirebaseAuth(page)
    await page.goto('/connexion')
    await expect(page.getByRole('heading', { name: 'Content de te revoir' })).toBeVisible()
    await page.locator('#email').fill('pas-une-adresse')
    await page.locator('form button[type="submit"]').click()
    await expect(page.locator('.alert-error')).toHaveText("Cette adresse e-mail n'est pas valide.")
    expect(calls).toHaveLength(1)
  })

  for (const path of ['/decouvrir', '/carte', '/messages', '/profil', '/activites', '/recherche']) {
    test(`US02 sans connexion, ${path} redirige vers /connexion`, async ({ page }) => {
      await mockFirebaseAuth(page)
      await page.goto(path)
      await expect(page).toHaveURL(/\/connexion$/)
      await expect(page.getByRole('heading', { name: 'Content de te revoir' })).toBeVisible()
    })
  }
})
