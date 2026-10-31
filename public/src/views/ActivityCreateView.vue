<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ArrowLeft, CheckCircle2 } from 'lucide-vue-next'
import { useAuth } from '../composables/useAuth'
import { api, ApiError } from '../services/api'
import { SPORT_LABELS } from '../services/labels'
import { centerOf } from '../services/location'
import { fetchUser } from '../services/users'
import type { Sport, User } from '../types/api'

const route = useRoute()
const router = useRouter()
const { user } = useAuth()

const guestId = computed(() => String(route.query.guestId ?? ''))
const SPORTS = Object.keys(SPORT_LABELS) as Sport[]

const me = ref<User | null>(null)
const guest = ref<User | null>(null)
const loading = ref(true)
const loadError = ref('')

const sport = ref<Sport>('autre')
const date = ref('')
const time = ref('')
const placeName = ref('')
const message = ref('')

const submitting = ref(false)
const formError = ref('')
const sent = ref(false)

const today = new Date().toISOString().slice(0, 10)

const messageLeft = computed(() => 500 - message.value.length)

onMounted(async () => {
  try {
    if (!guestId.value || guestId.value === user.value?.uid) {
      loadError.value = 'Choisis un sportif depuis son profil pour lui proposer une activité.'
      return
    }
    const [myProfile, guestProfile] = await Promise.all([
      user.value?.uid ? fetchUser(user.value.uid) : Promise.resolve(null),
      fetchUser(guestId.value),
    ])
    me.value = myProfile
    guest.value = guestProfile
    if (!guestProfile) {
      loadError.value = 'Ce profil n’existe pas.'
      return
    }
    if (guestProfile.sports[0]) sport.value = guestProfile.sports[0].sport
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'Impossible de charger le profil.'
  } finally {
    loading.value = false
  }
})

/** Point de rendez-vous : milieu entre les deux profils (lieu précis à préciser dans le message). */
function meetingPoint() {
  const a = centerOf(me.value)
  const b = guest.value?.location ?? a
  return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 }
}

async function submit() {
  formError.value = ''
  if (!date.value || !time.value) {
    formError.value = 'Indique la date et l’heure.'
    return
  }
  const startAt = new Date(`${date.value}T${time.value}`)
  if (Number.isNaN(startAt.getTime()) || startAt.getTime() <= Date.now()) {
    formError.value = 'La date doit être dans le futur.'
    return
  }
  if (!placeName.value.trim()) {
    formError.value = 'Indique le lieu.'
    return
  }
  if (!message.value.trim()) {
    formError.value = 'Ajoute un petit message.'
    return
  }

  submitting.value = true
  try {
    const point = meetingPoint()
    await api.createActivity({
      guestId: guestId.value,
      sport: sport.value,
      startAt: startAt.toISOString(),
      lieu: { nom: placeName.value.trim(), lat: point.lat, lng: point.lng },
      message: message.value.trim(),
    })
    sent.value = true
  } catch (error) {
    formError.value =
      error instanceof ApiError ? error.message : 'Impossible d’envoyer la proposition.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="screen">
    <div class="screen__inner">
      <div class="top-bar">
        <button type="button" class="icon-btn" aria-label="Retour" @click="router.back()">
          <ArrowLeft :size="18" aria-hidden="true" />
        </button>
      </div>

      <div v-if="loading" class="state">
        <span class="spinner spinner--muted" aria-hidden="true"></span>
        <span>Chargement…</span>
      </div>

      <div v-else-if="loadError" class="alert alert-error">{{ loadError }}</div>

      <div v-else-if="sent" class="confirm-box">
        <div class="confirm-box__icon">
          <CheckCircle2 :size="30" aria-hidden="true" color="#178A2E" />
        </div>
        <h1>Proposition envoyée !</h1>
        <p class="sent__text">
          {{ guest?.firstName }} va recevoir ta proposition. Tu la retrouveras dans « Mes activités ».
        </p>
        <div class="sent__actions">
          <Button as-child><RouterLink :to="{ name: 'activities' }">Voir mes activités</RouterLink></Button>
          <Button as-child variant="outline"><RouterLink :to="{ name: 'athlete', params: { id: guestId } }">
            Retour au profil
          </RouterLink></Button>
        </div>
      </div>

      <template v-else>
        <div class="header-block">
          <h1>Proposer une activité</h1>
          <p>Pour {{ guest?.firstName }}</p>
        </div>

        <form @submit.prevent="submit">
          <div class="form-row">
            <label for="sport">Sport</label>
            <select id="sport" v-model="sport">
              <option v-for="s in SPORTS" :key="s" :value="s">{{ SPORT_LABELS[s] }}</option>
            </select>
          </div>

          <div class="form-row--split">
            <div class="form-row">
              <label for="date">Date</label>
              <Input id="date" v-model="date" type="date" :min="today" required />
            </div>
            <div class="form-row">
              <label for="time">Heure</label>
              <Input id="time" v-model="time" type="time" required />
            </div>
          </div>

          <div class="form-row">
            <label for="place">Lieu</label>
            <Input
              id="place"
              v-model="placeName"
              type="text"
              maxlength="120"
              placeholder="Ex. Parc de la Tête d’Or, entrée Lac"
              required />
            <span class="field-hint">Le point sur la carte est placé entre vous deux.</span>
          </div>

          <div class="form-row">
            <label for="message">Message</label>
            <Textarea
              id="message"
              v-model="message"
              rows="4"
              maxlength="500"
              placeholder="Présente-toi et précise ton idée"
              required
            ></Textarea>
            <span class="field-hint">{{ messageLeft }} caractères restants</span>
          </div>

          <p v-if="formError" class="alert alert-error">{{ formError }}</p>

          <Button type="submit" :disabled="submitting">
            {{ submitting ? 'Envoi…' : 'Envoyer la proposition' }}
          </Button>
        </form>
      </template>
    </div>
  </div>
</template>

<style scoped>
.state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 48px 0;
  color: var(--color-text-muted);
  font-size: 14px;
}

.sent__text {
  color: var(--color-text-muted);
  line-height: 1.5;
}

.sent__actions {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sent__actions > * {
  text-decoration: none;
}

textarea {
  appearance: none;
  width: 100%;
  background: var(--color-surface-2);
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text);
  font-size: 16px;
  padding: 13px 14px;
  font-family: inherit;
  resize: vertical;
}

textarea:focus {
  outline: none;
  border-color: var(--color-lime);
  box-shadow: 0 0 0 3px var(--color-lime-soft);
}

textarea::placeholder {
  color: var(--color-text-muted);
}
</style>
