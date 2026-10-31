<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft } from 'lucide-vue-next'
import { useAuth } from '../composables/useAuth'
import AthleteCard from '../components/AthleteCard.vue'
import { api } from '../services/api'
import { DAYS, DAY_LABELS, LEVEL_LABELS, SEXE_LABELS, SPORT_LABELS } from '../services/labels'
import { ageFromBirthDate } from '../services/age'
import { centerOf } from '../services/location'
import { fetchUser } from '../services/users'
import type { DayOfWeek, Level, Sexe, Sport, User, UserSearchResult } from '../types/api'

const RADIUS_OPTIONS = [1, 3, 5, 10]
const SPORTS = Object.keys(SPORT_LABELS) as Sport[]
const LEVELS = Object.keys(LEVEL_LABELS) as Level[]
const SEXES = Object.keys(SEXE_LABELS) as Sexe[]

const router = useRouter()
const { user } = useAuth()

const me = ref<User | null>(null)
const maxKm = ref(10)
const sport = ref<Sport | null>(null)
const level = ref<Level | null>(null)
const availability = ref<DayOfWeek | null>(null)
const sexe = ref<Sexe | null>(null)
const ageMin = ref<number | null>(null)
const ageMax = ref<number | null>(null)

/** Résultats renvoyés par l'API (distance, sport, niveau, disponibilité déjà filtrés côté serveur). */
const rawResults = ref<UserSearchResult[]>([])
const loading = ref(true)
const errorMessage = ref('')
let requestId = 0

const hasFilters = computed(
  () =>
    maxKm.value !== 10 ||
    sport.value !== null ||
    level.value !== null ||
    availability.value !== null ||
    sexe.value !== null ||
    ageMin.value !== null ||
    ageMax.value !== null,
)

/** Sexe et âge sont filtrés ici : un profil sans ces informations est exclu dès qu'on filtre dessus. */
const results = computed(() =>
  rawResults.value.filter((p) => {
    if (sexe.value && p.sexe !== sexe.value) return false
    if (ageMin.value !== null || ageMax.value !== null) {
      const age = ageFromBirthDate(p.birthDate)
      if (age === null) return false
      if (ageMin.value !== null && age < ageMin.value) return false
      if (ageMax.value !== null && age > ageMax.value) return false
    }
    return true
  }),
)

function resetFilters() {
  maxKm.value = 10
  sport.value = null
  level.value = null
  availability.value = null
  sexe.value = null
  ageMin.value = null
  ageMax.value = null
}

async function search() {
  const id = ++requestId
  loading.value = true
  errorMessage.value = ''
  try {
    const center = centerOf(me.value)
    const list = await api.searchUsers({
      lat: center.lat,
      lng: center.lng,
      maxKm: maxKm.value,
      sport: sport.value ?? undefined,
      level: sport.value ? (level.value ?? undefined) : undefined,
      availability: availability.value ?? undefined,
    })
    if (id !== requestId) return
    const uid = user.value?.uid
    rawResults.value = list.filter((p) => p.id !== uid)
  } catch (error) {
    if (id !== requestId) return
    errorMessage.value =
      error instanceof Error ? error.message : 'Impossible de lancer la recherche.'
  } finally {
    if (id === requestId) loading.value = false
  }
}

// Le niveau n'a de sens que pour un sport donné.
watch(sport, (value) => {
  if (!value) level.value = null
})

watch([maxKm, sport, level, availability], search)

onMounted(async () => {
  me.value = user.value?.uid ? await fetchUser(user.value.uid) : null
  await search()
})
</script>

<template>
  <div class="screen">
    <div class="screen__inner">
      <div class="search__top">
        <button type="button" class="icon-btn" aria-label="Retour" @click="router.back()">
          <ArrowLeft :size="18" aria-hidden="true" />
        </button>
        <button
          v-if="hasFilters"
          type="button"
          class="btn-link"
          @click="resetFilters"
        >
          Réinitialiser
        </button>
      </div>

      <div class="header-block">
        <h1>Rechercher</h1>
        <p>Les sportifs près de toi, filtrés comme tu veux.</p>
      </div>

      <section class="filter">
        <h2 class="filter__title">Distance</h2>
        <div class="chips" role="radiogroup" aria-label="Distance">
          <button
            v-for="km in RADIUS_OPTIONS"
            :key="km"
            type="button"
            class="chip"
            :class="{ 'is-active': maxKm === km }"
            :aria-checked="maxKm === km"
            role="radio"
            @click="maxKm = km"
          >
            {{ km }} km
          </button>
        </div>
      </section>

      <section class="filter">
        <h2 class="filter__title">Sport</h2>
        <div class="chips chips--scroll" role="radiogroup" aria-label="Sport">
          <button
            type="button"
            class="chip"
            :class="{ 'is-active': sport === null }"
            :aria-checked="sport === null"
            role="radio"
            @click="sport = null"
          >
            Tous
          </button>
          <button
            v-for="s in SPORTS"
            :key="s"
            type="button"
            class="chip"
            :class="{ 'is-active': sport === s }"
            :aria-checked="sport === s"
            role="radio"
            @click="sport = s"
          >
            {{ SPORT_LABELS[s] }}
          </button>
        </div>
      </section>

      <section class="filter">
        <h2 class="filter__title">Niveau</h2>
        <div class="chips" role="radiogroup" aria-label="Niveau">
          <button
            v-for="l in LEVELS"
            :key="l"
            type="button"
            class="chip"
            :class="{ 'is-active': level === l }"
            :aria-checked="level === l"
            :disabled="!sport"
            role="radio"
            @click="level = level === l ? null : l"
          >
            {{ LEVEL_LABELS[l] }}
          </button>
        </div>
        <p v-if="!sport" class="field-hint">Choisis un sport pour filtrer par niveau.</p>
      </section>

      <section class="filter">
        <h2 class="filter__title">Disponibilité</h2>
        <div class="chips chips--scroll" role="radiogroup" aria-label="Disponibilité">
          <button
            v-for="d in DAYS"
            :key="d"
            type="button"
            class="chip"
            :class="{ 'is-active': availability === d }"
            :aria-checked="availability === d"
            role="radio"
            @click="availability = availability === d ? null : d"
          >
            {{ DAY_LABELS[d] }}
          </button>
        </div>
      </section>

      <section class="filter">
        <h2 class="filter__title">Sexe</h2>
        <div class="chips" role="radiogroup" aria-label="Sexe">
          <button
            type="button"
            class="chip"
            :class="{ 'is-active': sexe === null }"
            :aria-checked="sexe === null"
            role="radio"
            @click="sexe = null"
          >
            Tous
          </button>
          <button
            v-for="v in SEXES"
            :key="v"
            type="button"
            class="chip"
            :class="{ 'is-active': sexe === v }"
            :aria-checked="sexe === v"
            role="radio"
            @click="sexe = sexe === v ? null : v"
          >
            {{ SEXE_LABELS[v] }}
          </button>
        </div>
      </section>

      <section class="filter">
        <h2 class="filter__title">Âge</h2>
        <div class="age-range">
          <label>
            <span>Min</span>
            <input v-model.number="ageMin" type="number" min="16" max="99" placeholder="16" aria-label="Âge minimum" />
          </label>
          <span class="age-range__sep" aria-hidden="true">–</span>
          <label>
            <span>Max</span>
            <input v-model.number="ageMax" type="number" min="16" max="99" placeholder="99" aria-label="Âge maximum" />
          </label>
        </div>
      </section>

      <div v-if="loading" class="state">
        <span class="spinner spinner--muted" aria-hidden="true"></span>
        <span>Recherche en cours…</span>
      </div>

      <div v-else-if="errorMessage" class="alert alert-error">{{ errorMessage }}</div>

      <p v-else-if="results.length === 0" class="state">
        Aucun sportif ne correspond à ces filtres.
      </p>

      <template v-else>
        <p class="field-hint">{{ results.length }} sportif{{ results.length > 1 ? 's' : '' }}</p>
        <ul class="athlete-list">
          <AthleteCard v-for="p in results" :key="p.id" :profile="p" />
        </ul>
      </template>
    </div>
  </div>
</template>

<style scoped>
.search__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.age-range {
  display: flex;
  align-items: flex-end;
  gap: 10px;
}

.age-range label {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  color: var(--color-text-muted);
}

.age-range input {
  height: 44px;
  padding: 0 12px;
  border-radius: var(--radius-md);
  border: 1.5px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-size: 15px;
}

.age-range__sep {
  padding-bottom: 12px;
  color: var(--color-text-muted);
}

.filter {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.filter__title {
  font-size: 15px;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chips--scroll {
  flex-wrap: nowrap;
  overflow-x: auto;
  scrollbar-width: none;
  margin: 0 -20px;
  padding: 0 20px;
}

.chips--scroll::-webkit-scrollbar {
  display: none;
}

.chip {
  flex-shrink: 0;
  border: 1.5px solid var(--color-border);
  background: var(--color-surface-2);
  color: var(--color-text-muted);
  border-radius: 999px;
  padding: 8px 14px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    color 0.15s ease,
    background 0.15s ease;
}

.chip:hover:not(:disabled) {
  border-color: var(--color-lime);
}

.chip.is-active {
  background: var(--color-lime);
  border-color: var(--color-lime);
  color: var(--primary-foreground);
}

.chip:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px 0;
  color: var(--color-text-muted);
  font-size: 14px;
  text-align: center;
}

.athlete-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
