/**
 * BINOFIT - Définitions des types de données pour les profils utilisateurs.
 */

/** 
 * Liste exhaustive des sports proposés dans le formulaire d'inscription BINOFIT.
 * Cette liste est utilisée pour le typage strict et les éléments de sélection UI.
 */
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

/** Type représentant l'un des sports supportés par l'application BINOFIT. */
export type Sport = (typeof SPORTS)[number]

/** 
 * Données de profil saisies lors de l'inscription, propres à BINOFIT (hors Firebase Auth).
 */
export interface BinofitProfile {
  /** Prénom du sportif */
  prenom: string
  /** Nom de famille du sportif */
  nom: string
  /** Adresse e-mail unique (normalisée en minuscules) */
  email: string
  /** Discipline sportive principale pratiquée */
  sport: Sport
  /** Localisation / Ville de résidence ou de pratique */
  localisation: string
  /** Date et heure de création du profil au format ISO string */
  createdAt: string
}

/** Données de profil saisies dans le formulaire avant enregistrement de la date de création. */
export type BinofitProfileDraft = Omit<BinofitProfile, 'createdAt'>

/** Résultat de validation d'un formulaire de profil BINOFIT. */
export interface ProfileValidationResult {
  isValid: boolean
  errors: Partial<Record<keyof BinofitProfileDraft, string>>
}

