<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'

const router = useRouter()
const { isMagicLink, completeSignIn } = useAuth()

type Status = 'checking' | 'need-email' | 'signing-in' | 'error' | 'invalid'

const status = ref<Status>('checking')
const email = ref('')
const errorMessage = ref('')

async function attemptSignIn(fallbackEmail?: string) {
  status.value = 'signing-in'
  errorMessage.value = ''
  try {
    await completeSignIn(window.location.href, fallbackEmail)
    router.replace('/accueil')
  } catch (e) {
    const message = (e as Error)?.message
    if (message === 'EMAIL_REQUIRED') {
      status.value = 'need-email'
      return
    }
    status.value = 'error'
    errorMessage.value =
      "Ce lien de connexion est invalide ou a expiré. Merci de refaire une demande."
  }
}

function onConfirmEmail() {
  if (!email.value) return
  attemptSignIn(email.value.trim())
}

onMounted(() => {
  if (!isMagicLink(window.location.href)) {
    status.value = 'invalid'
    return
  }
  attemptSignIn()
})
</script>

<template>
  <div class="screen">
    <div class="screen__inner">
      <div class="brand">
        <div class="brand__mark">B</div>
        <div class="brand__name">BINO<span>FIT</span></div>
      </div>

      <div v-if="status === 'checking' || status === 'signing-in'" class="confirm-box">
        <span class="spinner spinner--muted" style="width: 28px; height: 28px"></span>
        <h1>Connexion en cours…</h1>
        <p style="color: var(--color-text-muted)">Un instant, on vérifie ton lien magique.</p>
      </div>

      <div v-else-if="status === 'need-email'" class="confirm-box" style="align-items: stretch; text-align: left">
        <div class="confirm-box__icon" style="align-self: center">✉️</div>
        <h1 style="text-align: center">Confirme ton e-mail</h1>
        <p style="color: var(--color-text-muted); text-align: center">
          Ce lien a été ouvert sur un autre appareil ou navigateur. Ressaisis ton e-mail pour finaliser la connexion.
        </p>
        <form @submit.prevent="onConfirmEmail">
          <div class="form-row">
            <label for="confirm-email">E-mail</label>
            <input id="confirm-email" v-model="email" type="email" placeholder="alex.martin@email.com" />
          </div>
          <button type="submit" class="btn btn-primary">Confirmer</button>
        </form>
      </div>

      <div v-else class="confirm-box">
        <div class="confirm-box__icon">⚠️</div>
        <h1>Lien invalide</h1>
        <p class="alert alert-error">{{ errorMessage || "Ce lien n'est pas un lien de connexion BINOFIT valide." }}</p>
        <router-link to="/connexion" class="btn btn-primary" style="width: auto; padding-inline: 24px">
          Retour à la connexion
        </router-link>
      </div>
    </div>
  </div>
</template>
