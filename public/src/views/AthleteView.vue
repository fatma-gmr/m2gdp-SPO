<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, CalendarPlus, MapPin, MessageCircle } from 'lucide-vue-next'
import { useAuth } from '../composables/useAuth'
import { api, ApiError } from '../services/api'
import { LEVEL_LABELS, SPORT_LABELS } from '../services/labels'
import { SPORT_ICONS } from '../services/sportIcons'
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

/** Ouvre la page Messages avec ce sportif, qui propose les messages de départ. */
function startConversation() {
  if (!athlete.value) return
  router.push({ name: 'messages', query: { to: athlete.value.id } })
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
            <component
              :is="SPORT_ICONS[athlete.sports[0].sport]"
              v-else-if="athlete.sports[0]"
              :size="32"
              :stroke-width="2"
              aria-hidden="true"
            />
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

        <div v-if="!isMe" class="athlete__actions">
          <Button type="button" @click="startConversation">
            <MessageCircle :size="18" aria-hidden="true" />
            Démarrer la conversation
          </Button>
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
  font-size: 12.5px;
  text-align: center;
}

.athlete__section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.athlete__section h2 {
  font-size: 15.5px;
}

.athlete__bio {
  line-height: 1.55;
  white-space: pre-line;
}

.athlete__muted {
  color: var(--color-text-muted);
  font-size: 12.5px;
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
