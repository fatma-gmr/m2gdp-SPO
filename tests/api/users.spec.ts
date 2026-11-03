/** Profils et recherche : PUT/GET /users/{id}, GET /users (distance et filtres), 403 profile_required. */
import { expect, test } from '@playwright/test'
import { call, inDays } from '../lib/api'
import { PRESQU_ILE, PROFILE_A, USER_A, USER_B, USER_SANS_PROFIL } from '../lib/testData'

type SearchResult = {
  id: string
  distanceKm?: number
  sports: { sport: string; level: string }[]
  availability: { dayOfWeek: string }[]
}

const near = (maxKm: number, extra = '') =>
  `/users?lat=${PRESQU_ILE.lat}&lng=${PRESQU_ILE.lng}&maxKm=${maxKm}${extra}`

test.describe('Profil', () => {
  test('US04 le profil créé est lisible avec GET /users/{id}', async ({ request }) => {
    const response = await call(request, USER_A.uid, 'GET', `/users/${USER_A.uid}`)
    expect(response.status()).toBe(200)
    const user = await response.json()
    expect(user).toMatchObject({
      id: USER_A.uid,
      email: USER_A.email,
      firstName: PROFILE_A.firstName,
      lastName: PROFILE_A.lastName,
      location: { lat: PRESQU_ILE.lat, lng: PRESQU_ILE.lng },
    })
  })

  test('US04 on ne peut pas créer ou modifier le profil d’un autre (403)', async ({ request }) => {
    const response = await call(request, USER_A.uid, 'PUT', `/users/${USER_B.uid}`, { bio: 'piratage' })
    expect(response.status()).toBe(403)
    expect((await response.json()).code).toBe('forbidden')
  })

  test('US04 création d’un profil incomplet refusée (400)', async ({ request }) => {
    const response = await call(request, USER_SANS_PROFIL.uid, 'PUT', `/users/${USER_SANS_PROFIL.uid}`, { firstName: 'Seul' })
    expect(response.status()).toBe(400)
  })

  test('US05 la modification est visible immédiatement', async ({ request }) => {
    const bio = `Bio modifiée ${Date.now()}`
    const put = await call(request, USER_A.uid, 'PUT', `/users/${USER_A.uid}`, { bio })
    expect(put.status()).toBe(200)
    const get = await call(request, USER_B.uid, 'GET', `/users/${USER_A.uid}`)
    expect((await get.json()).bio).toBe(bio)
  })

  test('US06 les disponibilités (jour, début, fin) sont remplacées et relues', async ({ request }) => {
    const availability = [
      { dayOfWeek: 'mardi', startTime: '18:00', endTime: '20:00' },
      { dayOfWeek: 'samedi', startTime: '10:00', endTime: '12:00' },
    ]
    const put = await call(request, USER_A.uid, 'PUT', `/users/${USER_A.uid}`, { availability })
    expect(put.status()).toBe(200)
    const user = await (await call(request, USER_A.uid, 'GET', `/users/${USER_A.uid}`)).json()
    expect(user.availability).toEqual(expect.arrayContaining(availability))
    expect(user.availability).toHaveLength(2)
  })

  test('US07 les sports et niveaux sont remplacés et relus', async ({ request }) => {
    const sports = [
      { sport: 'tennis', level: 'intermediaire' },
      { sport: 'course_a_pied', level: 'debutant' },
    ]
    const put = await call(request, USER_A.uid, 'PUT', `/users/${USER_A.uid}`, { sports })
    expect(put.status()).toBe(200)
    const user = await (await call(request, USER_A.uid, 'GET', `/users/${USER_A.uid}`)).json()
    expect(user.sports).toEqual(expect.arrayContaining(sports))
    expect(user.sports).toHaveLength(2)
  })

  test('US07 un sport inconnu est refusé (400)', async ({ request }) => {
    const response = await call(request, USER_A.uid, 'PUT', `/users/${USER_A.uid}`, {
      sports: [{ sport: 'curling', level: 'expert' }],
    })
    expect(response.status()).toBe(400)
  })

  test('US26 sexe et date de naissance sont enregistrés', async ({ request }) => {
    const put = await call(request, USER_A.uid, 'PUT', `/users/${USER_A.uid}`, { sexe: 'femme', birthDate: '1998-04-12' })
    expect(put.status()).toBe(200)
    const user = await (await call(request, USER_A.uid, 'GET', `/users/${USER_A.uid}`)).json()
    expect(user).toMatchObject({ sexe: 'femme', birthDate: '1998-04-12' })
  })

  test('US13 consulter le profil d’un autre sportif, 404 s’il n’existe pas', async ({ request }) => {
    const other = await call(request, USER_A.uid, 'GET', `/users/${USER_B.uid}`)
    expect(other.status()).toBe(200)
    const user = await other.json()
    expect(user.id).toBe(USER_B.uid)
    expect(user.sports.length).toBeGreaterThan(0)
    expect(user.availability.length).toBeGreaterThan(0)

    const missing = await call(request, USER_A.uid, 'GET', '/users/utilisateur-inexistant')
    expect(missing.status()).toBe(404)
  })
})

test.describe('Recherche', () => {
  test('US08 GET /users trie les sportifs proches par distance, avec distanceKm', async ({ request }) => {
    const response = await call(request, USER_A.uid, 'GET', near(10))
    expect(response.status()).toBe(200)
    const users: SearchResult[] = await response.json()
    const b = users.find((u) => u.id === USER_B.uid)
    expect(b, 'B (Part-Dieu) doit être à moins de 10 km de la Presqu’île').toBeTruthy()
    expect(b!.distanceKm).toBeGreaterThan(1)
    expect(b!.distanceKm).toBeLessThan(3)
    const distances = users.map((u) => u.distanceKm!)
    expect(distances).toEqual([...distances].sort((x, y) => x - y))
    expect(distances.every((d) => d <= 10)).toBe(true)
  })

  test('US09 le rayon choisi (1, 5, 10, 20 km) limite les résultats', async ({ request }) => {
    for (const maxKm of [1, 5, 10, 20]) {
      const users: SearchResult[] = await (await call(request, USER_A.uid, 'GET', near(maxKm))).json()
      expect(users.every((u) => u.distanceKm! <= maxKm), `rayon ${maxKm} km`).toBe(true)
      // B est à environ 1,9 km : absent à 1 km, présent à partir de 5 km.
      expect(users.some((u) => u.id === USER_B.uid), `B dans le rayon ${maxKm} km`).toBe(maxKm >= 5)
    }
  })

  test('US09 lat, lng et maxKm doivent être fournis ensemble (400)', async ({ request }) => {
    const response = await call(request, USER_A.uid, 'GET', `/users?lat=${PRESQU_ILE.lat}&maxKm=5`)
    expect(response.status()).toBe(400)
  })

  test('US10 filtre par sport', async ({ request }) => {
    const users: SearchResult[] = await (await call(request, USER_A.uid, 'GET', near(20, '&sport=autre'))).json()
    expect(users.some((u) => u.id === USER_B.uid)).toBe(true)
    expect(users.every((u) => u.sports.some((s) => s.sport === 'autre'))).toBe(true)
  })

  test('US11 filtre par niveau', async ({ request }) => {
    const users: SearchResult[] = await (await call(request, USER_A.uid, 'GET', near(20, '&level=expert'))).json()
    expect(users.some((u) => u.id === USER_B.uid)).toBe(true)
    expect(users.every((u) => u.sports.some((s) => s.level === 'expert'))).toBe(true)

    const invalid = await call(request, USER_A.uid, 'GET', '/users?level=champion')
    expect(invalid.status()).toBe(400)
  })

  test('US12 filtre par jour de disponibilité', async ({ request }) => {
    const users: SearchResult[] = await (await call(request, USER_A.uid, 'GET', near(20, '&availability=dimanche'))).json()
    expect(users.some((u) => u.id === USER_B.uid)).toBe(true)
    expect(users.every((u) => u.availability.some((a) => a.dayOfWeek === 'dimanche'))).toBe(true)

    const lundi: SearchResult[] = await (await call(request, USER_A.uid, 'GET', near(20, '&availability=lundi'))).json()
    expect(lundi.some((u) => u.id === USER_B.uid)).toBe(false)
  })
})

test.describe('Profil obligatoire', () => {
  test('US04 sans profil, les 3 créations renvoient 403 profile_required', async ({ request }) => {
    const uid = USER_SANS_PROFIL.uid
    const attempts = [
      call(request, uid, 'POST', '/activities', {
        guestId: USER_A.uid,
        sport: 'tennis',
        startAt: inDays(2),
        lieu: { nom: 'Parc de la Tête d’Or', lat: 45.777, lng: 4.855 },
        message: 'Test sans profil',
      }),
      call(request, uid, 'POST', '/conversations', { participantId: USER_A.uid }),
      call(request, uid, 'POST', '/favorites', { targetType: 'user', targetId: USER_A.uid }),
    ]
    for (const response of await Promise.all(attempts)) {
      expect(response.status()).toBe(403)
      expect((await response.json()).code).toBe('profile_required')
    }
  })
})
