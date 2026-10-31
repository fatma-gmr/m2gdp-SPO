<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, MapPin } from 'lucide-vue-next'
import { useAuth } from '../composables/useAuth'
import { api } from '../services/api'
import { ACTIVITY_STATUS_LABELS, SPORT_LABELS } from '../services/labels'
import { formatDateTime } from '../services/format'
import { getUserCached } from '../services/users'
import type { Activity, ActivityStatus } from '../types/api'

const router = useRouter()
const { user } = useAuth()

const activities = ref<Activity[]>([])
const names = reactive<Record<string, string>>({})
const tab = ref<'upcoming' | 'past'>('upcoming')
const loading = ref(true)
const errorMessage = ref('')
const busyId = ref<string | null>(null)

const uid = computed(() => user.value?.uid ?? '')

function counterpartId(a: Activity): string {
  return a.createdBy === uid.value ? a.guestId : a.createdBy
}

function counterpartName(a: Activity): string {
  return names[counterpartId(a)] ?? '…'
}

function isUpcoming(a: Activity): boolean {
  return new Date(a.startAt).getTime() >= Date.now() && (a.status === 'en_attente' || a.status === 'acceptee')
}

const upcoming = computed(() =>
  activities.value
    .filter(isUpcoming)
    .sort((a, b) => a.startAt.localeCompare(b.startAt)),
)

const past = computed(() =>
  activities.value
    .filter((a) => !isUpcoming(a))
    .sort((a, b) => b.startAt.localeCompare(a.startAt)),
)

const shown = computed(() => (tab.value === 'upcoming' ? upcoming.value : past.value))

function canAccept(a: Activity): boolean {
  return a.guestId === uid.value && a.status === 'en_attente'
}

function canClose(a: Activity): boolean {
  return a.status === 'acceptee' && (a.createdBy === uid.value || a.guestId === uid.value)
}

async function setStatus(a: Activity, status: ActivityStatus) {
  busyId.value = a.id
  errorMessage.value = ''
  try {
    const updated = await api.updateActivityStatus(a.id, status)
    activities.value = activities.value.map((x) => (x.id === a.id ? updated : x))
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Mise à jour impossible.'
  } finally {
    busyId.value = null
  }
}

onMounted(async () => {
  try {
    activities.value = await api.listActivities()
    const ids = new Set(activities.value.map(counterpartId))
    await Promise.all(
      [...ids].map(async (id) => {
        const profile = await getUserCached(id)
        if (profile) names[id] = profile.firstName
      }),
    )
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Impossible de charger tes activités.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="screen">
    <div class="screen__inner">
      <div class="top-bar">
        <button type="button" class="icon-btn" aria-label="Retour" @click="router.back()">
          <ArrowLeft :size="18" aria-hidden="true" />
        </button>
      </div>

      <div class="header-block">
        <h1>Mes activités</h1>
      </div>

      <div class="segment" role="tablist">
        <button
          type="button"
          role="tab"
          class="segment__btn"
          :class="{ 'is-active': tab === 'upcoming' }"
          :aria-selected="tab === 'upcoming'"
          @click="tab = 'upcoming'"
        >
          À venir ({{ upcoming.length }})
        </button>
        <button
          type="button"
          role="tab"
          class="segment__btn"
          :class="{ 'is-active': tab === 'past' }"
          :aria-selected="tab === 'past'"
          @click="tab = 'past'"
        >
          Passées ({{ past.length }})
        </button>
      </div>

      <div v-if="loading" class="state">
        <span class="spinner spinner--muted" aria-hidden="true"></span>
        <span>Chargement…</span>
      </div>

      <div v-else-if="errorMessage" class="alert alert-error">{{ errorMessage }}</div>

      <p v-else-if="shown.length === 0" class="state">
        {{ tab === 'upcoming' ? 'Aucune activité à venir.' : 'Aucune activité passée.' }}
      </p>

      <ul v-else class="activity-list">
        <li v-for="a in shown" :key="a.id" class="activity-card">
          <div class="activity-card__head">
            <span class="activity-card__sport">{{ SPORT_LABELS[a.sport] }}</span>
            <span class="status" :class="`status--${a.status}`">
              {{ ACTIVITY_STATUS_LABELS[a.status] }}
            </span>
          </div>
          <p class="activity-card__when">{{ formatDateTime(a.startAt) }}</p>
          <p class="activity-card__place">
            <MapPin :size="14" aria-hidden="true" />
            {{ a.lieu.nom }}
          </p>
          <p class="activity-card__with">
            {{ a.createdBy === uid ? 'Proposée à' : 'Proposée par' }}
            <strong>{{ counterpartName(a) }}</strong>
          </p>
          <p v-if="a.message" class="activity-card__message">« {{ a.message }} »</p>

          <div v-if="canAccept(a) || canClose(a)" class="activity-card__actions">
            <template v-if="canAccept(a)">
              <Button
                type="button"
                :disabled="busyId === a.id"
                @click="setStatus(a, 'acceptee')"
              >
                Accepter
              </Button>
              <Button variant="outline"
                type="button"
                :disabled="busyId === a.id"
                @click="setStatus(a, 'refusee')"
              >
                Refuser
              </Button>
            </template>
            <Button variant="outline"
              v-else-if="canClose(a)"
              type="button"
              :disabled="busyId === a.id"
              @click="setStatus(a, 'terminee')"
            >
              Marquer comme terminée
            </Button>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 32px 0;
  color: var(--color-text-muted);
  font-size: 14px;
  text-align: center;
}

.segment {
  display: grid;
  grid-template-columns: 1fr 1fr;
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 4px;
  gap: 4px;
}

.segment__btn {
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  font-weight: 700;
  font-size: 14px;
  padding: 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.segment__btn.is-active {
  background: var(--color-lime);
  color: var(--primary-foreground);
}

.activity-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.activity-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 16px;
}

.activity-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.activity-card__sport {
  font-size: 17px;
  font-weight: 800;
}

.activity-card__when {
  color: var(--color-lime);
  font-weight: 700;
  font-size: 14px;
}

.activity-card__place,
.activity-card__with,
.activity-card__message {
  font-size: 14px;
  color: var(--color-text-muted);
}

.activity-card__place {
  display: flex;
  align-items: center;
  gap: 6px;
}

.activity-card__with strong {
  color: var(--color-text);
}

.activity-card__message {
  font-style: italic;
}

.activity-card__actions {
  display: flex;
  gap: 10px;
  margin-top: 6px;
}

.activity-card__actions > * {
  width: auto;
  flex: 1;
}

.status {
  font-size: 12px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 999px;
  white-space: nowrap;
  background: var(--color-surface);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
}

.status--en_attente {
  color: #ffc86b;
  border-color: rgba(255, 200, 107, 0.35);
}

.status--acceptee {
  color: var(--color-lime);
  border-color: rgba(76, 200, 0, 0.35);
  background: var(--color-lime-soft);
}

.status--refusee {
  color: var(--color-danger);
  border-color: rgba(255, 92, 92, 0.35);
}
</style>
