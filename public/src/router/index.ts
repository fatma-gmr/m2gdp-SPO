import { createRouter, createWebHistory } from 'vue-router'
import { watch } from 'vue'
import { useAuth } from '../composables/useAuth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/connexion' },
    {
      path: '/inscription',
      name: 'inscription',
      component: () => import('../views/RegisterView.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/connexion',
      name: 'connexion',
      component: () => import('../views/LoginView.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/finish-signin',
      name: 'finish-signin',
      component: () => import('../views/FinishSignInView.vue'),
    },
    {
      path: '/accueil',
      name: 'accueil',
      component: () => import('../views/HomeView.vue'),
      meta: { requiresAuth: true },
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

/** Attend que Firebase ait déterminé l'état de connexion avant de trancher la garde. */
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

export default router
