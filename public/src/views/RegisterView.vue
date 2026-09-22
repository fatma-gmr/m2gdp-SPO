<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useAuth } from '../composables/useAuth'
import { SPORTS, type Sport } from '../types/profile'

/** Composable d'authentification BINOFIT */
const { registerAndSendLink } = useAuth()

/** État réactif du formulaire d'inscription */
const form = reactive({
  prenom: '',
  nom: '',
  email: '',
  sport: '' as Sport | '',
  localisation: '',
})

/** Indicateur de chargement lors de la soumission */
const loading = ref(false)

/** Message d'erreur de validation ou d'envoi */
const error = ref('')

/** Indicateur de succès d'envoi du lien magique */
const linkSent = ref(false)

/**
 * Soumet le formulaire d'inscription.
 * Valide la présence de tous les champs, stocke le profil localement et déclenche l'envoi du mail Firebase.
 */
async function onSubmit() {
  error.value = ''

  if (!form.prenom || !form.nom || !form.email || !form.sport || !form.localisation) {
    error.value = 'Merci de remplir tous les champs.'
    return
  }

  loading.value = true
  try {
    await registerAndSendLink({
      prenom: form.prenom.trim(),
      nom: form.nom.trim(),
      email: form.email.trim(),
      sport: form.sport,
      localisation: form.localisation.trim(),
    })
    linkSent.value = true
  } catch (e) {
    error.value = toErrorMessage(e)
  } finally {
    loading.value = false
  }
}

/**
 * Traduit les codes d'erreur Firebase Auth en messages utilisateur compréhensibles.
 * 
 * @param e L'exception capturée lors de l'appel Firebase
 * @returns Message d'erreur formaté en français
 */
function toErrorMessage(e: unknown): string {
  const code = (e as { code?: string } | undefined)?.code
  switch (code) {
    case 'auth/invalid-email':
      return "Cette adresse e-mail n'est pas valide."
    case 'auth/missing-email':
      return 'Merci de renseigner ton adresse e-mail.'
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
          <h1>Créer un compte</h1>
          <p>Rejoins la communauté BINOFIT en quelques secondes.</p>
        </div>

        <form @submit.prevent="onSubmit" novalidate>
          <div class="form-row form-row--split">
            <div class="form-row">
              <label for="prenom">Prénom</label>
              <input
                id="prenom"
                v-model="form.prenom"
                type="text"
                autocomplete="given-name"
                placeholder="Alex"
                :disabled="loading"
              />
            </div>
            <div class="form-row">
              <label for="nom">Nom</label>
              <input
                id="nom"
                v-model="form.nom"
                type="text"
                autocomplete="family-name"
                placeholder="Martin"
                :disabled="loading"
              />
            </div>
          </div>

          <div class="form-row">
            <label for="email">E-mail</label>
            <input
              id="email"
              v-model="form.email"
              type="email"
              autocomplete="email"
              placeholder="alex.martin@email.com"
              :disabled="loading"
            />
          </div>

          <div class="form-row">
            <label for="sport">Sport pratiqué</label>
            <select id="sport" v-model="form.sport" :disabled="loading">
              <option value="" disabled>Choisis un sport</option>
              <option v-for="s in SPORTS" :key="s" :value="s">{{ s }}</option>
            </select>
          </div>

          <div class="form-row">
            <label for="localisation">Localisation</label>
            <input
              id="localisation"
              v-model="form.localisation"
              type="text"
              autocomplete="address-level2"
              placeholder="Paris, France"
              :disabled="loading"
            />
          </div>

          <p v-if="error" class="alert alert-error">{{ error }}</p>

          <button type="submit" class="btn btn-primary" :disabled="loading">
            <span v-if="loading" class="spinner"></span>
            <span>{{ loading ? 'Envoi en cours…' : "S'inscrire" }}</span>
          </button>
        </form>

        <div class="divider-text">ou</div>

        <p style="text-align: center; font-size: 14.5px; color: var(--color-text-muted)">
          Déjà inscrit ?
          <router-link class="btn-link" to="/connexion" style="display: inline">Se connecter</router-link>
        </p>
      </template>

      <template v-else>
        <div class="confirm-box">
          <div class="confirm-box__icon">📩</div>
          <h1>Vérifie ta boîte mail</h1>
          <p style="color: var(--color-text-muted)">
            Un lien de connexion a été envoyé à <strong style="color: var(--color-text)">{{ form.email }}</strong>.
            Clique dessus depuis cet appareil pour activer ton compte BINOFIT.
          </p>
          <router-link to="/connexion" class="btn btn-secondary" style="width: auto; padding-inline: 24px">
            Retour
          </router-link>
        </div>
      </template>

      <p class="footer-note">Connexion 100% sans mot de passe, sécurisée par Firebase.</p>
    </div>
  </div>
</template>
