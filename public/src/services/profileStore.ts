import type { BinofitProfile } from '../types/profile'

/**
  * Persistance du profil BINOFIT (prénom, nom, sport, localisation) en localStorage,
  * indexée par e-mail normalisé.
  *
  * Limite connue (POC) : Firebase Auth ne stocke pas ces champs, donc si le lien
  * magique est ouvert sur un autre appareil/navigateur que celui de l'inscription,
  * ce profil ne sera pas retrouvé automatiquement. En production, on remplacerait
  * ce store par une collection Firestore indexée par uid.
  */
const STORAGE_PREFIX = 'binofit_profile_'
const PENDING_EMAIL_KEY = 'binofit_email_for_sign_in'

/**
 * Normalise une adresse e-mail en supprimant les espaces superflus et en la passant en minuscules.
 * 
 * @param email L'adresse e-mail brute
 * @returns L'adresse e-mail nettoyée et normalisée
 */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * Enregistre un profil utilisateur BINOFIT dans le localStorage du navigateur.
 * 
 * @param profile Le profil BINOFIT à sauvegarder
 */
export function saveProfile(profile: BinofitProfile): void {
  try {
    const key = STORAGE_PREFIX + normalizeEmail(profile.email)
    window.localStorage.setItem(key, JSON.stringify(profile))
  } catch (error) {
    console.error('[BINOFIT profileStore] Erreur lors de la sauvegarde du profil:', error)
  }
}

/**
 * Récupère un profil BINOFIT en localStorage à partir de l'adresse e-mail de l'utilisateur.
 * 
 * @param email L'adresse e-mail de l'utilisateur recherché
 * @returns Le profil BINOFIT correspondant ou `null` si non trouvé
 */
export function getProfileByEmail(email: string): BinofitProfile | null {
  const key = STORAGE_PREFIX + normalizeEmail(email)
  const raw = window.localStorage.getItem(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as BinofitProfile
  } catch (error) {
    console.error('[BINOFIT profileStore] Erreur de parsing du profil stocké:', error)
    return null
  }
}

/**
 * Vérifie si un profil existe déjà pour une adresse e-mail donnée.
 * 
 * @param email L'adresse e-mail à vérifier
 * @returns `true` si le profil existe en localStorage, `false` sinon
 */
export function profileExists(email: string): boolean {
  return getProfileByEmail(email) !== null
}

/**
 * Stocke l'adresse e-mail de l'utilisateur en cours de connexion via lien magique.
 * 
 * @param email L'adresse e-mail à conserver temporairement
 */
export function setEmailForSignIn(email: string): void {
  window.localStorage.setItem(PENDING_EMAIL_KEY, normalizeEmail(email))
}

/**
 * Récupère l'adresse e-mail mémorisée pour la connexion en cours via lien magique.
 * 
 * @returns L'adresse e-mail en attente ou `null` si aucune session n'est active
 */
export function getEmailForSignIn(): string | null {
  return window.localStorage.getItem(PENDING_EMAIL_KEY)
}

/**
 * Efface l'adresse e-mail mémorisée pour la connexion par lien magique.
 */
export function clearEmailForSignIn(): void {
  window.localStorage.removeItem(PENDING_EMAIL_KEY)
}

