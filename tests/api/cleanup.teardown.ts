/** Supprime de Supabase les données des comptes de test et les jetons locaux. */
import { rmSync } from 'node:fs'
import { test as teardown } from '@playwright/test'
import { TOKENS_FILE, cleanupTestData } from '../lib/testData'

teardown('nettoyer les données de test', async () => {
  await cleanupTestData()
  rmSync(TOKENS_FILE, { force: true })
})
