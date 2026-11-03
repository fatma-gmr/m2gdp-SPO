/** Activités : POST/GET /activities et PATCH /activities/{id}/status (transitions autorisées et interdites). */
import { type APIRequestContext, expect, test } from '@playwright/test'
import { call, inDays } from '../lib/api'
import { USER_A, USER_B } from '../lib/testData'

const LIEU = { nom: 'Parc de la Tête d’Or, entrée Lac', lat: 45.777, lng: 4.855 }

/** A propose une activité à B ; renvoie son id. */
async function propose(request: APIRequestContext, startAt = inDays(3)): Promise<string> {
  const response = await call(request, USER_A.uid, 'POST', '/activities', {
    guestId: USER_B.uid,
    sport: 'tennis',
    startAt,
    lieu: LIEU,
    message: 'Un match samedi ?',
  })
  expect(response.status(), await response.text()).toBe(201)
  return (await response.json()).id
}

const setStatus = (request: APIRequestContext, uid: string, id: string, status: string) =>
  call(request, uid, 'PATCH', `/activities/${id}/status`, { status })

test.describe('Proposition d’activités', () => {
  test('US16 proposer une activité : 201, statut « en_attente »', async ({ request }) => {
    const startAt = inDays(3)
    const response = await call(request, USER_A.uid, 'POST', '/activities', {
      guestId: USER_B.uid,
      sport: 'tennis',
      startAt,
      lieu: LIEU,
      message: 'Un match samedi ?',
    })
    expect(response.status()).toBe(201)
    expect(await response.json()).toMatchObject({
      createdBy: USER_A.uid,
      guestId: USER_B.uid,
      sport: 'tennis',
      status: 'en_attente',
      lieu: LIEU,
      message: 'Un match samedi ?',
    })
  })

  test('US16 on ne peut pas se proposer une activité à soi-même (400)', async ({ request }) => {
    const response = await call(request, USER_A.uid, 'POST', '/activities', {
      guestId: USER_A.uid,
      sport: 'tennis',
      startAt: inDays(3),
      lieu: LIEU,
      message: 'Moi contre moi',
    })
    expect(response.status()).toBe(400)
    expect((await response.json()).code).toBe('invalid_guest')
  })

  test('US16 invité inconnu (404) et corps invalide (400)', async ({ request }) => {
    const unknown = await call(request, USER_A.uid, 'POST', '/activities', {
      guestId: 'utilisateur-inexistant',
      sport: 'tennis',
      startAt: inDays(3),
      lieu: LIEU,
      message: 'Bonjour',
    })
    expect(unknown.status()).toBe(404)

    const invalid = await call(request, USER_A.uid, 'POST', '/activities', { guestId: USER_B.uid, sport: 'tennis' })
    expect(invalid.status()).toBe(400)
  })

  test('US17 l’invité retrouve la proposition reçue dans GET /activities', async ({ request }) => {
    const id = await propose(request)
    const response = await call(request, USER_B.uid, 'GET', '/activities')
    expect(response.status()).toBe(200)
    const received = (await response.json()).find((a: { id: string }) => a.id === id)
    expect(received).toMatchObject({ createdBy: USER_A.uid, guestId: USER_B.uid, status: 'en_attente' })
  })

  test('US20 on ne consulte que ses propres activités (403 pour un autre userId)', async ({ request }) => {
    const response = await call(request, USER_A.uid, 'GET', `/activities?userId=${USER_B.uid}`)
    expect(response.status()).toBe(403)
  })
})

test.describe('Suivi des activités : transitions de statut', () => {
  test('US18 l’invité accepte : en_attente → acceptee', async ({ request }) => {
    const id = await propose(request)
    const response = await setStatus(request, USER_B.uid, id, 'acceptee')
    expect(response.status()).toBe(200)
    expect((await response.json()).status).toBe('acceptee')
  })

  test('US18 seul l’invité peut accepter : le créateur reçoit 403', async ({ request }) => {
    const id = await propose(request)
    const response = await setStatus(request, USER_A.uid, id, 'acceptee')
    expect(response.status()).toBe(403)
    expect((await response.json()).code).toBe('forbidden')
  })

  test('US19 l’invité refuse : en_attente → refusee, puis plus aucune transition', async ({ request }) => {
    const id = await propose(request)
    const refused = await setStatus(request, USER_B.uid, id, 'refusee')
    expect(refused.status()).toBe(200)
    expect((await refused.json()).status).toBe('refusee')

    for (const next of ['acceptee', 'terminee', 'en_attente']) {
      expect((await setStatus(request, USER_B.uid, id, next)).status(), `refusee → ${next}`).toBe(403)
    }
  })

  test('US21 acceptee → terminee par le créateur, puis plus aucune transition', async ({ request }) => {
    const id = await propose(request)
    expect((await setStatus(request, USER_B.uid, id, 'acceptee')).status()).toBe(200)
    const done = await setStatus(request, USER_A.uid, id, 'terminee')
    expect(done.status()).toBe(200)
    expect((await done.json()).status).toBe('terminee')

    for (const next of ['acceptee', 'refusee', 'en_attente']) {
      expect((await setStatus(request, USER_B.uid, id, next)).status(), `terminee → ${next}`).toBe(403)
    }
  })

  test('US21 acceptee → terminee aussi possible par l’invité', async ({ request }) => {
    const id = await propose(request)
    expect((await setStatus(request, USER_B.uid, id, 'acceptee')).status()).toBe(200)
    expect((await setStatus(request, USER_B.uid, id, 'terminee')).status()).toBe(200)
  })

  test('US21 transitions interdites depuis en_attente (403) et statut invalide (400)', async ({ request }) => {
    const id = await propose(request)
    expect((await setStatus(request, USER_B.uid, id, 'terminee')).status(), 'en_attente → terminee').toBe(403)
    expect((await setStatus(request, USER_A.uid, id, 'refusee')).status(), 'créateur refuse').toBe(403)
    expect((await setStatus(request, USER_B.uid, id, 'annulee')).status(), 'statut inconnu').toBe(400)
    expect((await setStatus(request, USER_B.uid, 'activite-inexistante', 'acceptee')).status(), 'activité inconnue').toBe(404)
  })
})
