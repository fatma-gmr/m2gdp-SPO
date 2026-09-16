import { ref, computed } from 'vue'
import {
  onAuthStateChanged,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signOut,
  type User,
} from 'firebase/auth'
import { auth, actionCodeSettings } from '../firebase'
import {
  saveProfile,
  getProfileByEmail,
  setEmailForSignIn,
  getEmailForSignIn,
  clearEmailForSignIn,
} from '../services/profileStore'
import type { BinofitProfile } from '../types/profile'

// État partagé (singleton) entre tous les composants qui utilisent useAuth().
const user = ref<User | null>(null)
const authReady = ref(false)

onAuthStateChanged(auth, (firebaseUser) => {
  user.value = firebaseUser
  authReady.value = true
})

const profile = computed<BinofitProfile | null>(() => {
  if (!user.value?.email) return null
  return getProfileByEmail(user.value.email)
})

const isAuthenticated = computed(() => user.value !== null)

/** Étape 1 de l'inscription : enregistre le profil localement puis envoie le lien magique. */
async function registerAndSendLink(
  data: Omit<BinofitProfile, 'createdAt'>,
): Promise<void> {
  const profileToSave: BinofitProfile = {
    ...data,
    createdAt: new Date().toISOString(),
  }
  saveProfile(profileToSave)
  await sendSignInLinkToEmail(auth, data.email, actionCodeSettings)
  setEmailForSignIn(data.email)
}

/** Connexion (utilisateur déjà inscrit) : envoie simplement un lien magique. */
async function sendLoginLink(email: string): Promise<void> {
  await sendSignInLinkToEmail(auth, email, actionCodeSettings)
  setEmailForSignIn(email)
}

function isMagicLink(url: string): boolean {
  return isSignInWithEmailLink(auth, url)
}

/**
 * Finalise la connexion depuis le lien magique.
 * Si l'e-mail n'est pas retrouvé (lien ouvert sur un autre appareil), on le demande
 * à l'utilisateur via `fallbackEmail`.
 */
async function completeSignIn(
  url: string,
  fallbackEmail?: string,
): Promise<User> {
  const email = getEmailForSignIn() ?? fallbackEmail
  if (!email) {
    throw new Error('EMAIL_REQUIRED')
  }
  const result = await signInWithEmailLink(auth, email, url)
  clearEmailForSignIn()
  return result.user
}

async function logout(): Promise<void> {
  await signOut(auth)
}

export function useAuth() {
  return {
    user,
    profile,
    authReady,
    isAuthenticated,
    registerAndSendLink,
    sendLoginLink,
    isMagicLink,
    completeSignIn,
    logout,
  }
}
