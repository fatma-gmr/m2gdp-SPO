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
import type { BinofitProfile, BinofitProfileDraft } from '../types/profile'

/** État réactif global (singleton) de l'utilisateur Firebase connecté */
const user = ref<User | null>(null)

/** Indicateur réactif confirmant que Firebase Auth a fini de vérifier la session initiale */
const authReady = ref(false)

// Écouteur d'état Firebase Auth
onAuthStateChanged(auth, (firebaseUser) => {
  user.value = firebaseUser
  authReady.value = true
})

/** Propriété calculée renvoyant le profil BINOFIT correspondant à l'utilisateur connecté */
const profile = computed<BinofitProfile | null>(() => {
  if (!user.value?.email) return null
  return getProfileByEmail(user.value.email)
})

/** Propriété calculée indiquant si un utilisateur est actuellement authentifié */
const isAuthenticated = computed(() => user.value !== null)

/**
 * Étape 1 de l'inscription : enregistre le profil BINOFIT localement puis envoie le lien magique par e-mail.
 * 
 * @param data Données du profil sans la date de création (`prenom`, `nom`, `email`, `sport`, `localisation`)
 * @returns Une promesse résolue lorsque le mail est envoyé par Firebase
 */
async function registerAndSendLink(
  data: BinofitProfileDraft,
): Promise<void> {
  const profileToSave: BinofitProfile = {
    ...data,
    createdAt: new Date().toISOString(),
  }
  saveProfile(profileToSave)
  await sendSignInLinkToEmail(auth, data.email, actionCodeSettings)
  setEmailForSignIn(data.email)
}

/**
 * Connexion (utilisateur déjà inscrit) : envoie un lien magique à l'adresse e-mail spécifiée.
 * 
 * @param email Adresse e-mail du compte BINOFIT
 * @returns Une promesse résolue lorsque le lien magique est envoyé
 */
async function sendLoginLink(email: string): Promise<void> {
  await sendSignInLinkToEmail(auth, email, actionCodeSettings)
  setEmailForSignIn(email)
}

/**
 * Vérifie si l'URL courante contient les paramètres d'un lien magique de connexion Firebase Auth.
 * 
 * @param url URL complète de la page actuelle
 * @returns `true` s'il s'agit d'un lien d'authentification valide, `false` sinon
 */
function isMagicLink(url: string): boolean {
  return isSignInWithEmailLink(auth, url)
}

/**
 * Finalise la connexion depuis le lien magique cliqué par l'utilisateur dans son e-mail.
 * Si l'e-mail n'est pas retrouvé en localStorage (lien ouvert sur un autre appareil/navigateur),
 * l'adresse est demandée via `fallbackEmail`.
 * 
 * @param url URL complète de redirection Firebase reçue par e-mail
 * @param fallbackEmail Adresse e-mail saisie manuellement en cas de changement de navigateur
 * @returns L'objet `User` Firebase après authentification réussie
 * @throws Error ('EMAIL_REQUIRED') si aucune adresse e-mail n'est disponible
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

/**
 * Déconnecte l'utilisateur courant de Firebase Auth.
 */
async function logout(): Promise<void> {
  await signOut(auth)
}

/**
 * Composable principal de gestion de l'authentification et du profil utilisateur BINOFIT.
 * Propose un état réactif centralisé et l'ensemble des méthodes de connexion/déconnexion.
 */
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

