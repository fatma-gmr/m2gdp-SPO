<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '../composables/useAuth'

const { sendLoginLink } = useAuth()

const email = ref('')
const loading = ref(false)
const error = ref('')
const linkSent = ref(false)

async function onSubmit() {
  error.value = ''
  if (!email.value) {
    error.value = 'Merci de renseigner ton adresse e-mail.'
    return
  }

  loading.value = true
  try {
    await sendLoginLink(email.value.trim())
    linkSent.value = true
  } catch (e) {
    error.value = toErrorMessage(e)
  } finally {
    loading.value = false
  }
}

function toErrorMessage(e: unknown): string {
  const code = (e as { code?: string } | undefined)?.code
  switch (code) {
    case 'auth/invalid-email':
      return "Cette adresse e-mail n'est pas valide."
    default:
      return "Impossible d'envoyer le lien de connexion. Vérifie la configuration Firebase (voir README)."
  }
}
</script>

<template>
  <div class="screen">
    <div class="screen__inner">
      <div class="brand">
        <div class="brand__mark">B</div>
        <div class="brand__name">BINO<span>FIT</span></div>
      </div>

      <template v-if="!linkSent">
        <div class="header-block">
          <h1>Content de te revoir</h1>
          <p>Reçois un lien magique pour te connecter, sans mot de passe.</p>
        </div>

        <form @submit.prevent="onSubmit" novalidate>
          <div class="form-row">
            <label for="email">E-mail</label>
            <input
              id="email"
              v-model="email"
              type="email"
              autocomplete="email"
              placeholder="alex.martin@email.com"
              :disabled="loading"
            />
          </div>

          <p v-if="error" class="alert alert-error">{{ error }}</p>

          <button type="submit" class="btn btn-primary" :disabled="loading">
            <span v-if="loading" class="spinner"></span>
            <span>{{ loading ? 'Envoi en cours…' : 'Recevoir le lien magique' }}</span>
          </button>
        </form>

        <div class="divider-text">ou</div>

        <p style="text-align: center; font-size: 14.5px; color: var(--color-text-muted)">
          Pas encore de compte ?
          <router-link class="btn-link" to="/inscription" style="display: inline">S'inscrire</router-link>
        </p>
      </template>

      <template v-else>
        <div class="confirm-box">
          <div class="confirm-box__icon">📩</div>
          <h1>Vérifie ta boîte mail</h1>
          <p style="color: var(--color-text-muted)">
            Un lien de connexion a été envoyé à <strong style="color: var(--color-text)">{{ email }}</strong>.
            Clique dessus depuis cet appareil pour te connecter.
          </p>
          <button type="button" class="btn btn-secondary" style="width: auto; padding-inline: 24px" @click="linkSent = false">
            Renvoyer / modifier l'e-mail
          </button>
        </div>
      </template>

      <p class="footer-note">Connexion 100% sans mot de passe, sécurisée par Firebase.</p>
    </div>
  </div>
</template>
