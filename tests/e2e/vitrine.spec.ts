/**
 * Site vitrine : les 6 pages se chargent, la navigation fonctionne, aucun lien vide,
 * le dépôt GitHub pointe vers le dépôt officiel et toutes les ressources locales existent.
 * La vitrine ne correspond à aucune US : ces tests portent le préfixe « Vitrine ».
 */
import { expect, test } from '@playwright/test'
import { mockFirebaseAuth } from './firebaseMock'

const REPO = 'https://github.com/fatma-gmr/m2gdp-SPO'
const PAGES = [
  { file: 'index.html', nav: 'Accueil' },
  { file: 'maquette.html', nav: 'Maquette' },
  { file: 'charte.html', nav: 'Charte graphique' },
  { file: 'parcours.html', nav: 'Parcours utilisateurs' },
  { file: 'po.html', nav: 'PO' },
  { file: 'dev.html', nav: 'DEV' },
]

for (const { file, nav } of PAGES) {
  test(`Vitrine - ${file} : chargement, menu, liens et ressources`, async ({ page, request }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    const response = await page.goto(`/${file}`)
    expect(response?.status()).toBe(200)
    await expect(page).toHaveTitle(/BINOFIT/)
    await expect(page.locator('.site-nav__list a')).toHaveCount(6)
    await expect(page.locator(`.site-nav__list a[aria-current="page"]`)).toHaveText(nav)

    // Aucun lien vide, et le lien « Dépôt GitHub » du pied de page vise le dépôt officiel.
    await expect(page.locator('a[href="#"]')).toHaveCount(0)
    await expect(page.locator('.site-footer a', { hasText: 'Dépôt GitHub' })).toHaveAttribute('href', REPO)

    // Toutes les ressources et pages locales répondent (pas de 404).
    const urls = await page.$$eval('a[href], img[src], link[href], script[src]', (elements) =>
      elements.map((el) => (el as HTMLAnchorElement).href || (el as HTMLImageElement).src),
    )
    const local = [...new Set(urls.filter((u) => u.startsWith(new URL(page.url()).origin)).map((u) => u.split('#')[0]))]
    for (const url of local) {
      const check = await request.get(url)
      expect(check.status(), url).toBe(200)
    }
    expect(errors, 'erreurs JavaScript').toEqual([])
  })
}

test('Vitrine - le menu mène aux 6 pages', async ({ page }) => {
  await page.goto('/index.html')
  for (const { file, nav } of PAGES.slice(1)) {
    await page.locator('.site-nav__list a', { hasText: new RegExp(`^${nav}$`) }).click()
    await expect(page).toHaveURL(new RegExp(`/${file}$`))
  }
})

test('Vitrine - page DEV : 16 routes et 71 tests annoncés', async ({ page }) => {
  await page.goto('/dev.html')
  await expect(page.locator('td.mono')).toHaveCount(16)
  await expect(page.getByText('71 tests Playwright', { exact: true })).toBeVisible()
  await expect(page.getByText('52 API, 19 de bout en bout.', { exact: false })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Voir le dépôt GitHub' })).toHaveAttribute('href', REPO)
})

test('Vitrine - « Ouvrir l’application » mène à l’inscription', async ({ page }) => {
  await mockFirebaseAuth(page)
  await page.goto('/index.html')
  await page.getByRole('link', { name: 'Ouvrir l’application' }).first().click()
  await expect(page).toHaveURL(/\/inscription$/)
  await expect(page.getByRole('heading', { name: 'Créer un compte' })).toBeVisible()
})
