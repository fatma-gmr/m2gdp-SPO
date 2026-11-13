import type { User } from '../types/api'

/**
 * Éléments manquants pour compléter le profil, dans le même ordre que la jauge de la page Profil
 * (prénom, nom, bio, au moins un sport, au moins une disponibilité).
 * Liste vide = profil complet.
 */
export function missingProfileItems(profile: User | null): string[] {
  if (!profile) return ['Créer ton profil (prénom, nom, localisation)']
  const missing: string[] = []
  if (!profile.firstName.trim()) missing.push('Prénom')
  if (!profile.lastName.trim()) missing.push('Nom')
  if (!profile.bio?.trim()) missing.push('Bio')
  if (profile.sports.length === 0) missing.push('Au moins un sport pratiqué')
  if (profile.availability.length === 0) missing.push('Au moins une disponibilité')
  return missing
}
