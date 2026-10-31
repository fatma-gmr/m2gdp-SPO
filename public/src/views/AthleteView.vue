<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, CalendarPlus, MapPin, Send } from 'lucide-vue-next'
import { useAuth } from '../composables/useAuth'
import { api, ApiError } from '../services/api'
import { LEVEL_LABELS, SPORT_LABELS } from '../services/labels'
import type { DayOfWeek, User } from '../types/api'

const DAY_LABELS: Record<DayOfWeek, string> = {
  lundi: 'Lundi',
  mardi: 'Mardi',
  mercredi: 'Mercredi',
  jeudi: 'Jeudi',
  vendredi: 'Vendredi',
  samedi: 'Samedi',
  dimanche: 'Dimanche',
}

const route = useRoute()
const router = useRouter()
const { user: currentUser } = useAuth()

const athlete = ref<User | null>(null)
const loading = ref(true)
const notFound = ref(false)
const errorMessage = ref('')
const contacting = ref(false)

/** Messages suggérés pour démarrer la conversation ; le texte reste modifiable. */
const STARTERS = [
  'Salut ! Tu serais partant pour une séance cette semaine ?',
  'Bonjour ! Tu t’entraînes souvent près de chez toi ?',
  'Hello, ça te dit un match ce week-end ?',
  'Salut ! On se fait une séance à deux ?',
]
const starter = ref('')
const MESSAGE_MAX = 2000

const athleteId = computed(() => String(route.params.id))
const isMe = computed(() => currentUser.value?.uid === athleteId.value)

const initials = computed(() =>
  athlete.value
    ? `${athlete.value.firstName[0] ?? ''}${athlete.value.lastName[0] ?? ''}`.toUpperCase()
    : '',
)

async function load() {
  loading.value = true
  notFound.value = false
  errorMessage.value = ''
  try {
    athlete.value = await api.getUser(athleteId.value)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound.value = true
    } else {
      errorMessage.value =
        error instanceof Error ? error.message : 'Impossible de charger ce profil.'
    }
  } finally {
    loading.value = false
  }
}

/** Crée la conversation, y dépose le premier message, puis ouvre le chat. */
async function startConversation() {
  const text = starter.value.trim()
  if (!athlete.value || contacting.value) return
  if (!text) {
    errorMessage.value = 'Écris ou choisis un premier message.'
    return
  }
  contacting.value = true
  errorMessage.value = ''
  try {
    const conversation = await api.createConversation({ participantId: athlete.value.id })
    await api.sendMessage({ conversationId: conversation.id, text })
    router.push({ name: 'conversation', params: { id: conversation.id } })
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Impossible d’ouvrir la conversation.'
  } finally {
    contacting.value = false
  }
}

function proposeActivity() {
  if (!athlete.value) return
  router.push({ name: 'activity-new', query: { guestId: athlete.value.id } })
}

onMounted(load)
watch(athleteId, load)
</script>

<template>
  <div class="screen">
    <div class="screen__inner">
      <div class="top-bar">
        <button type="button" class="icon-btn" aria-label="Retour" @click="router.back()">
          <ArrowLeft :size="18" aria-hidden="true" />
        </button>
      </div>

      <div v-if="loading" class="athlete__state">
        <span class="spinner spinner--muted" aria-hidden="true"></span>
        <span>Chargement du profil…</span>
      </div>

      <div v-else-if="notFound" class="athlete__state">
        <p>Ce profil n'existe pas.</p>
        <RouterLink :to="{ name: 'decouvrir' }" class="btn-link">Retour à Découvrir</RouterLink>
      </div>

      <div v-else-if="errorMessage && !athlete" class="alert alert-error">
        {{ errorMessage }}
        <button type="button" class="btn-link" @click="load">Réessayer</button>
      </div>

      <template v-else-if="athlete">
        <section class="profile-hero">
          <div class="avatar">
            <img v-if="athlete.avatarUrl" :src="athlete.avatarUrl" :alt="athlete.firstName" />
            <template v-else>{{ initials }}</template>
          </div>
          <h1>{{ athlete.firstName }} {{ athlete.lastName }}</h1>
          <span v-if="athlete.location.city" class="pill">
            <MapPin :size="14" aria-hidden="true" />
            {{ athlete.location.city }}
          </span>
        </section>

        <section class="athlete__section">
          <h2>À propos</h2>
          <p v-if="athlete.bio" class="athlete__bio">{{ athlete.bio }}</p>
          <p v-else class="athlete__muted">Pas encore de bio.</p>
        </section>

        <section class="athlete__section">
          <h2>Sports</h2>
          <div v-if="athlete.sports.length" class="info-list">
            <div v-for="s in athlete.sports" :key="s.sport" class="info-row">
              <div class="info-row__body">
                <span class="info-row__label">{{ LEVEL_LABELS[s.level] }}</span>
                <span class="info-row__value">{{ SPORT_LABELS[s.sport] }}</span>
              </div>
            </div>
          </div>
          <p v-else class="athlete__muted">Aucun sport renseigné.</p>
        </section>

        <section class="athlete__section">
          <h2>Disponibilités</h2>
          <div v-if="athlete.availability.length" class="info-list">
            <div
              v-for="(slot, index) in athlete.availability"
              :key="index"
              class="info-row"
            >
              <div class="info-row__body">
                <span class="info-row__label">{{ DAY_LABELS[slot.dayOfWeek] }}</span>
                <span class="info-row__value">{{ slot.startTime }} – {{ slot.endTime }}</span>
              </div>
            </div>
          </div>
          <p v-else class="athlete__muted">Aucune disponibilité renseignée.</p>
        </section>

        <p v-if="errorMessage" class="alert alert-error">{{ errorMessage }}</p>

        <section v-if="!isMe" class="athlete__section starter">
          <h2>Démarrer la conversation</h2>
          <div class="starter__chips">
            <button
              v-for="(msg, i) in STARTERS"
              :key="i"
              type="button"
              class="starter__chip"
              @click="starter = msg"
            >
              {{ msg }}
            </button>
          </div>
          <label class="starter__field">
            <span class="sr-only">Premier message</span>
            <textarea
              v-model="starter"
              rows="3"
              :maxlength="MESSAGE_MAX"
              placeholder="Écris ton premier message…"
            ></textarea>
          </label>
          <Button type="button" :disabled="contacting || !starter.trim()" @click="startConversation">
            <Send :size="18" aria-hidden="true" />
            {{ contacting ? 'Envoi…' : 'Envoyer et ouvrir la conversation' }}
          </Button>
        </section>

        <div v-if="!isMe" class="athlete__actions">
          <Button type="button" @click="proposeActivity">
            <CalendarPlus :size="18" aria-hidden="true" />
            Proposer une activité
          </Button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.starter__chips {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.starter__chip {
  text-align: left;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
}

.starter__chip:hover {
  border-color: var(--color-lime);
  background: var(--color-lime-soft);
}

.starter__field textarea {
  width: 100%;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  border: 1.5px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-size: 16px;
  resize: vertical;
}

.starter__field textarea:focus {
  outline: none;
  border-color: var(--color-lime);
  box-shadow: 0 0 0 3px var(--color-lime-soft);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}

.athlete__state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 48px 0;
  color: var(--color-text-muted);
  font-size: 14px;
  text-align: center;
}

.athlete__section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.athlete__section h2 {
  font-size: 17px;
}

.athlete__bio {
  line-height: 1.55;
  white-space: pre-line;
}

.athlete__muted {
  color: var(--color-text-muted);
  font-size: 14px;
}

.athlete__actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: auto;
  padding-top: 8px;
}

.athlete__actions > * {
  text-decoration: none;
}

.profile-hero .avatar {
  overflow: hidden;
}

.profile-hero .avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
