<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ChevronRight } from 'lucide-vue-next'
import { SPORT_ICONS } from '../services/sportIcons'
import { useAuth } from '../composables/useAuth'
import { useUnread } from '../composables/useUnread'
import { api } from '../services/api'
import type { RealtimeEvent } from '../services/realtime'
import { ACTIVITY_STATUS_LABELS, SPORT_LABELS } from '../services/labels'
import { getUserCached } from '../services/users'
import type { Activity, ActivityStatus } from '../types/api'

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

/** « À venir » : toute proposition en attente, et les activités acceptées dont la date n'est pas passée. */
function isUpcoming(a: Activity): boolean {
  if (a.status === 'en_attente') return true
  return a.status === 'acceptee' && new Date(a.startAt).getTime() >= Date.now()
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

/** Activités groupées par jour (heure locale), dans l'ordre affiché : frise par jour. */
const dayGroups = computed(() => {
  const groups: { key: string; label: string; items: Activity[] }[] = []
  for (const a of shown.value) {
    const d = new Date(a.startAt)
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    let group = groups.find((g) => g.key === key)
    if (!group) {
      const raw = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
      group = { key, label: raw.charAt(0).toUpperCase() + raw.slice(1), items: [] }
      groups.push(group)
    }
    group.items.push(a)
  }
  return groups
})

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

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

const { markActivitiesSeen } = useUnread()

/** Recharge la liste des activités (à l'ouverture et à chaque événement temps réel). */
async function loadActivities() {
  try {
    activities.value = await api.listActivities()
    markActivitiesSeen(
      activities.value.filter((a) => a.guestId === uid.value && a.status === 'en_attente').map((a) => a.id),
      Object.fromEntries(
        activities.value
          .filter((a) => a.createdBy === uid.value && (a.status === 'acceptee' || a.status === 'refusee'))
          .map((a) => [a.id, a.status]),
      ),
    )
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
}

function onRealtime(event: Event) {
  const detail = (event as CustomEvent<RealtimeEvent>).detail
  if (detail.type === 'activity') void loadActivities()
}

onMounted(() => {
  void loadActivities()
  window.addEventListener('binofit:realtime', onRealtime)
})
onBeforeUnmount(() => window.removeEventListener('binofit:realtime', onRealtime))
</script>

<template>
  <div class="screen">
    <div class="screen__inner">
      <h1 class="page-title">Mes activités</h1>

      <div class="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          class="tabs__btn"
          :class="{ 'is-active': tab === 'upcoming' }"
          :aria-selected="tab === 'upcoming'"
          @click="tab = 'upcoming'"
        >
          À venir · {{ upcoming.length }}
        </button>
        <button
          type="button"
          role="tab"
          class="tabs__btn"
          :class="{ 'is-active': tab === 'past' }"
          :aria-selected="tab === 'past'"
          @click="tab = 'past'"
        >
          Passées · {{ past.length }}
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

      <div v-else class="timeline">
        <section v-for="group in dayGroups" :key="group.key" class="timeline__day">
          <h2 class="timeline__label">
            <span class="timeline__dot" aria-hidden="true"></span>
            {{ group.label }}
          </h2>

          <article v-for="a in group.items" :key="a.id" class="event">
            <div class="event__head">
              <span class="event__time">{{ formatTime(a.startAt) }}</span>
              <span class="status" :class="`status--${a.status}`">
                {{ ACTIVITY_STATUS_LABELS[a.status] }}
              </span>
            </div>

            <div class="event__card">
              <span class="event__icon" aria-hidden="true">
                <component :is="SPORT_ICONS[a.sport]" :size="20" />
              </span>
              <div class="event__body">
                <strong>{{ SPORT_LABELS[a.sport] }} avec {{ counterpartName(a) }}</strong>
                <span class="event__place">{{ a.lieu.nom }}</span>
                <p v-if="a.message" class="event__message">« {{ a.message }} »</p>
              </div>
              <ChevronRight :size="18" class="event__chevron" aria-hidden="true" />
            </div>

            <div v-if="canAccept(a) || canClose(a)" class="event__actions">
              <template v-if="canAccept(a)">
                <Button type="button" :disabled="busyId === a.id" @click="setStatus(a, 'acceptee')">
                  Accepter
                </Button>
                <Button variant="outline" type="button" :disabled="busyId === a.id" @click="setStatus(a, 'refusee')">
                  Refuser
                </Button>
              </template>
              <Button
                v-else-if="canClose(a)"
                variant="outline"
                type="button"
                :disabled="busyId === a.id"
                @click="setStatus(a, 'terminee')"
              >
                Marquer comme terminée
              </Button>
            </div>
          </article>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-title {
  font-size: 26px;
  font-weight: 800;
}

.state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 32px 0;
  color: var(--color-text-muted);
  font-size: 13px;
  text-align: center;
}

/* Onglets soulignés */
.tabs {
  display: flex;
  gap: 20px;
  border-bottom: 1px solid var(--color-border);
}

.tabs__btn {
  padding: 8px 0 10px;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  background: transparent;
  color: var(--color-text-muted);
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
}

.tabs__btn.is-active {
  color: var(--color-text);
  border-bottom-color: var(--color-lime);
}

/* Frise : une section par jour, ligne verticale et points */
.timeline {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding-left: 4px;
}

.timeline__day {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-left: 26px;
}

.timeline__day::before {
  content: '';
  position: absolute;
  left: 9px;
  top: 22px;
  bottom: -18px;
  width: 2px;
  background: var(--color-border);
}

.timeline__day:last-child::before {
  display: none;
}

.timeline__label {
  position: relative;
  font-size: 15px;
  font-weight: 700;
}

.timeline__dot {
  position: absolute;
  left: -26px;
  top: 50%;
  transform: translateY(-50%);
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--color-surface);
  border: 2px solid var(--color-border);
}

.timeline__day:first-child .timeline__dot {
  background: var(--color-lime-soft);
  border-color: var(--color-lime);
}

.event {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.event__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.event__time {
  font-size: 22px;
  font-weight: 800;
}

.event__card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: var(--radius-lg);
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
}

.event__icon {
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  border-radius: 12px;
  background: var(--color-surface);
  color: var(--color-lime-dark);
  display: flex;
  align-items: center;
  justify-content: center;
}

.event__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.event__body strong {
  font-size: 14px;
}

.event__place {
  font-size: 12px;
  color: var(--color-text-muted);
}

.event__message {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--color-text-muted);
  font-style: italic;
}

.event__chevron {
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.event__actions {
  display: flex;
  gap: 8px;
}

.event__actions > * {
  flex: 1;
}

.status {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.status--en_attente {
  background: #FFF4D6;
  color: #9A6B00;
}

.status--acceptee {
  background: var(--color-lime-soft);
  color: var(--color-lime-dark);
}

.status--refusee {
  background: #FDE7E8;
  color: #B42318;
}

.status--terminee {
  background: var(--color-surface-2);
  color: var(--color-text-muted);
}
</style>
