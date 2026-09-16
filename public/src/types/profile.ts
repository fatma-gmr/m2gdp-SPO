/** Sports proposés dans le formulaire d'inscription BINOFIT. */
export const SPORTS = [
  'Musculation',
  'Course à pied',
  'Football',
  'Basketball',
  'Natation',
  'Cyclisme',
  'Yoga',
  'Boxe',
  'CrossFit',
  'Tennis',
  'Autre',
] as const

export type Sport = (typeof SPORTS)[number]

/** Données de profil saisies à l'inscription, propres à BINOFIT (hors Firebase Auth). */
export interface BinofitProfile {
  prenom: string
  nom: string
  email: string
  sport: Sport
  localisation: string
  createdAt: string
}
