import { api } from './api'
import type { Sport, Venue } from '../types/api'

/**
 * Lieux de pratique à Lyon pour un sport, lus via GET /venues (OpenStreetMap côté serveur).
 * Résultat gardé en mémoire pour la durée de la page.
 */
const cache = new Map<Sport, Venue[]>()

export async function fetchVenues(sport: Sport): Promise<Venue[]> {
  const cached = cache.get(sport)
  if (cached) return cached
  const venues = await api.listVenues(sport)
  cache.set(sport, venues)
  return venues
}
