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

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function saveProfile(profile: BinofitProfile): void {
  const key = STORAGE_PREFIX + normalizeEmail(profile.email)
  window.localStorage.setItem(key, JSON.stringify(profile))
}

export function getProfileByEmail(email: string): BinofitProfile | null {
  const key = STORAGE_PREFIX + normalizeEmail(email)
  const raw = window.localStorage.getItem(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as BinofitProfile
  } catch {
    return null
  }
}

export function setEmailForSignIn(email: string): void {
  window.localStorage.setItem(PENDING_EMAIL_KEY, normalizeEmail(email))
}

export function getEmailForSignIn(): string | null {
  return window.localStorage.getItem(PENDING_EMAIL_KEY)
}

export function clearEmailForSignIn(): void {
  window.localStorage.removeItem(PENDING_EMAIL_KEY)
}
