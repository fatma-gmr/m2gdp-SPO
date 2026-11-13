/**
 * BINOFIT API — route /venues (voir /specs/openapi.json).
 *
 * Lieux de pratique d'un sport dans la commune de Lyon, lus depuis OpenStreetMap
 * (recherche Nominatim, bornée à Lyon). Le Worker envoie quelques termes par sport,
 * fusionne les résultats et garde la liste 7 jours dans le cache Cloudflare.
 * Nominatim demande au plus 1 requête par seconde : les termes sont envoyés l'un après l'autre.
 */
import { Hono } from 'hono'
import type { AppBindings } from '../env'
import { ApiError } from '../lib/apiError'
import { firebaseAuth } from '../middleware/auth'
import { SPORTS, type Sport } from '../types'

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const USER_AGENT = 'BINOFIT-api/1.0'
const CACHE_SECONDS = 7 * 24 * 3600
const BROWSER_CACHE_SECONDS = 3600
const PAUSE_BETWEEN_QUERIES_MS = 1100
const RETRY_DELAYS_MS = [1500, 4000]
/** Boîte englobante de Lyon (ouest, nord, est, sud). */
const LYON_VIEWBOX = '4.76,45.80,4.92,45.68'

/** Termes de recherche par sport. Absent = pas de lieu proposé (ex. « autre », course à pied). */
const SPORT_TERMS: Partial<Record<Sport, string[]>> = {
  natation: ['piscine'],
  football: ['stade', 'complexe sportif', 'terrain de sport', 'football'],
  basketball: ['gymnase', 'terrain de basket'],
  tennis: ['tennis club'],
  boxe: ['club de boxe', 'boxing gym'],
  yoga: ['yoga'],
  crossfit: ['crossfit', 'box crossfit'],
  musculation: ['salle de musculation', 'Basic-Fit', 'On Air Fitness', 'KeepCool', 'Neoness'],
  cyclisme: ['vélodrome', 'club cycliste'],
}

export interface Venue {
  name: string
  lat: number
  lng: number
}

interface NominatimResult {
  lat: string
  lon: string
  name?: string
  display_name: string
}

/** Une requête Nominatim, avec nouvelles tentatives si le service limite ou échoue. */
async function searchNominatim(term: string): Promise<NominatimResult[]> {
  const url = `${NOMINATIM_URL}?${new URLSearchParams({
    q: `${term} Lyon`,
    format: 'jsonv2',
    limit: '50',
    bounded: '1',
    viewbox: LYON_VIEWBOX,
    countrycodes: 'fr',
  })}`
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } })
      if (response.ok) return (await response.json()) as NominatimResult[]
    } catch {
      // Réseau : on réessaie ci-dessous.
    }
    const delay = RETRY_DELAYS_MS[attempt]
    if (delay === undefined) {
      throw new ApiError(503, 'venues_unavailable', 'Les lieux sont indisponibles pour le moment, réessaie plus tard')
    }
    await new Promise((resolve) => setTimeout(resolve, delay))
  }
}

/** Une voie (« Rue du Stade ») n'est pas un lieu de pratique. */
const STREET_NAME = /^(rue|boulevard|bd|avenue|allée|allee|chemin|place|impasse|quai|cours|route)\b/i

/** Lieux nommés situés à Lyon, sans doublon de nom, triés par nom. */
async function venuesForSport(terms: string[]): Promise<Venue[]> {
  const byName = new Map<string, Venue>()
  for (const [index, term] of terms.entries()) {
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, PAUSE_BETWEEN_QUERIES_MS))
    for (const result of await searchNominatim(term)) {
      const name = result.name?.trim()
      if (!name || STREET_NAME.test(name) || !/Lyon/i.test(result.display_name) || byName.has(name)) continue
      byName.set(name, { name, lat: Number(result.lat), lng: Number(result.lon) })
    }
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
}

export const venuesRoute = new Hono<AppBindings>()

venuesRoute.use('*', firebaseAuth())

/** GET /venues?sport= — lieux de pratique du sport à Lyon (cache 7 jours). */
venuesRoute.get('/', async (c) => {
  const sport = c.req.query('sport')
  if (!sport || !SPORTS.includes(sport as Sport)) {
    throw new ApiError(400, 'invalid_query', `sport doit valoir ${SPORTS.join(', ')}`)
  }
  const terms = SPORT_TERMS[sport as Sport]
  if (!terms) return c.json([] as Venue[])

  // Cache serveur 7 jours ; le navigateur, lui, revalide au bout d'une heure (liste plus fraîche).
  const cache = caches.default
  const cacheKey = new Request(`https://venues.binofit.internal/v3/${sport}`) // version : à incrémenter si les termes changent
  let body = await (await cache.match(cacheKey))?.text()
  if (body === undefined) {
    body = JSON.stringify(await venuesForSport(terms))
    await cache.put(
      cacheKey,
      new Response(body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${CACHE_SECONDS}` } }),
    )
  }
  return new Response(body, {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': `private, max-age=${BROWSER_CACHE_SECONDS}` },
  })
})
