import { defineConfig, devices } from '@playwright/test'

/** API Worker lancée en local par `wrangler dev` (ou une autre URL via API_URL). */
const API_URL = process.env.API_URL ?? 'http://localhost:8787'
/** Front Vite (vitrine + application) lancé en local. */
const APP_URL = process.env.APP_URL ?? 'http://localhost:5173'

export default defineConfig({
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  projects: [
    // Prépare les comptes de test (jetons + profils), puis nettoie la base à la fin.
    { name: 'setup', testMatch: /api\/auth\.setup\.ts/, use: { baseURL: API_URL }, teardown: 'cleanup' },
    { name: 'cleanup', testMatch: /api\/cleanup\.teardown\.ts/ },
    {
      name: 'api',
      testDir: './api',
      testMatch: /.*\.spec\.ts/,
      dependencies: ['setup'],
      use: { baseURL: API_URL },
    },
    {
      name: 'e2e',
      testDir: './e2e',
      use: { ...devices['Desktop Chrome'], baseURL: APP_URL },
    },
  ],
  webServer: [
    {
      command: 'npm run dev',
      cwd: '../workers',
      url: `${API_URL}/api/health`,
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: 'npm run dev -- --port 5173 --strictPort',
      cwd: '../public',
      url: APP_URL,
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
})
