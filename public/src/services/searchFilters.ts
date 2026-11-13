import type { DayOfWeek, Level, Sexe, Sport, UserSearchResult } from '../types/api'
import { ageFromBirthDate } from './age'

/**
 * Critères de recherche partagés par Recherche, Découvrir et la Carte.
 * Règles (identiques partout) :
 * - sport et niveau : lus sur le sport PRINCIPAL du profil ; le niveau ne s'applique qu'avec un sport ;
 * - jour : au moins une disponibilité ce jour-là ;
 * - distance : distance à vol d'oiseau depuis le centre de recherche (≤ maxKm) ;
 * - sexe et âge : un profil sans l'information est exclu dès qu'on filtre dessus.
 */
export interface SearchFilters {
  maxKm: number
  sport: Sport | null
  level: Level | null
  day: DayOfWeek | null
  sexe: Sexe | null
  ageMin: number | null
  ageMax: number | null
}

export const DEFAULT_RADIUS_KM_FILTER = 10

export const DEFAULT_FILTERS: SearchFilters = {
  maxKm: DEFAULT_RADIUS_KM_FILTER,
  sport: null,
  level: null,
  day: null,
  sexe: null,
  ageMin: null,
  ageMax: null,
}

/** Rayon maximal interrogé auprès de l'API ; le filtrage de distance se fait ensuite localement. */
export const FETCH_RADIUS_KM = 20

export function matchesFilters(p: UserSearchResult, f: SearchFilters): boolean {
  if (p.distanceKm !== undefined && p.distanceKm > f.maxKm) return false

  const primary = p.sports[0]
  if (f.sport && primary?.sport !== f.sport) return false
  if (f.sport && f.level && primary?.level !== f.level) return false

  if (f.day && !p.availability.some((slot) => slot.dayOfWeek === f.day)) return false

  if (f.sexe && p.sexe !== f.sexe) return false

  if (f.ageMin !== null || f.ageMax !== null) {
    const age = ageFromBirthDate(p.birthDate)
    if (age === null) return false
    if (f.ageMin !== null && age < f.ageMin) return false
    if (f.ageMax !== null && age > f.ageMax) return false
  }

  return true
}

export function hasActiveFilters(f: SearchFilters): boolean {
  return f.maxKm !== DEFAULT_RADIUS_KM_FILTER || f.sport !== null || f.level !== null || f.day !== null ||
    f.sexe !== null || f.ageMin !== null || f.ageMax !== null
}
