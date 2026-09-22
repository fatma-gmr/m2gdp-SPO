import { createRouter, createWebHistory } from 'vue-router'
import { watch } from 'vue'
import { useAuth } from '../composables/useAuth'

/**
 * Extension des méta-données de route Vue Router pour BINOFIT.
 */
declare module 'vue-router' {
  interface RouteMeta {
    /** Définit si la route nécessite un utilisateur authentifié */
    requiresAuth?: boolean
    /** Définit si la route est réservée aux visiteurs non connectés */
    guestOnly?: boolean
    /** Titre affiché dans l'onglet du navigateur */
    title?: string
  }
}

/**
 * Instance du routeur Vue pour l'application BINOFIT.
 * Définit la cartographie des vues et la stratégie de navigation.
 */
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/connexion' },
    {
      path: '/inscription',
      name: 'inscription',
      component: () => import('../views/RegisterView.vue'),
      meta: { guestOnly: true, title: 'Inscription — BINOFIT' },
    },
    {
      path: '/connexion',
      name: 'connexion',
      component: () => import('../views/LoginView.vue'),
      meta: { guestOnly: true, title: 'Connexion — BINOFIT' },
    },
    {
      path: '/finish-signin',
      name: 'finish-signin',
      component: () => import('../views/FinishSignInView.vue'),
      meta: { title: 'Finalisation — BINOFIT' },
    },
    {
      path: '/accueil',
      name: 'accueil',
      component: () => import('../views/HomeView.vue'),
      meta: { requiresAuth: true, title: 'Accueil — BINOFIT' },
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

/**
 * Attend que Firebase Auth ait terminé sa vérification d'état initiale.
 * 
 * @returns Une promesse qui se résout lorsque `authReady` devient `true`
 */
function waitForAuthReady(): Promise<void> {
  const { authReady } = useAuth()
  if (authReady.value) return Promise.resolve()
  return new Promise((resolve) => {
    const stop = watch(authReady, (ready) => {
      if (ready) {
        stop()
        resolve()
      }
    })
  })
}

/**
 * Garde de navigation globale (beforeEach).
 * Protège les routes nécessitant une authentification et redirige les utilisateurs déjà connectés.
 */
router.beforeEach(async (to) => {
  if (!to.meta.requiresAuth && !to.meta.guestOnly) return true

  await waitForAuthReady()
  const { isAuthenticated } = useAuth()

  if (to.meta.requiresAuth && !isAuthenticated.value) {
    return { name: 'connexion' }
  }
  if (to.meta.guestOnly && isAuthenticated.value) {
    return { name: 'accueil' }
  }
  return true
})

/**
 * Hook après navigation pour mettre à jour le titre du document HTML.
 */
router.afterEach((to) => {
  if (to.meta.title) {
    document.title = to.meta.title
  } else {
    document.title = 'BINOFIT'
  }
})

export default router

