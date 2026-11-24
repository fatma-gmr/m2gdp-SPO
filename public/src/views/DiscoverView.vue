<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, toRef } from 'vue'
import { RouterLink } from 'vue-router'
import {
  ArrowUpRight,
  Bell,
  MapPin,
  Search,
  SlidersHorizontal,
} from 'lucide-vue-next'
import logoUrl from '../assets/logo-binofit-horizontal.png'
import { useAuth } from '../composables/useAuth'
import AthleteCard from '../components/AthleteCard.vue'
import SportIcon from '../components/SportIcon.vue'
import { api } from '../services/api'
import { SPORT_LABELS } from '../services/labels'
import { centerOf } from '../services/location'
import { useSearchFilters } from '../composables/useSearchFilters'
import { useToast } from '../composables/useToast'
import { FETCH_RADIUS_KM, matchesFilters } from '../services/searchFilters'
import { fetchUser } from '../services/users'
import type { Activity, ActivityStatus, Sport, User, UserSearchResult } from '../types/api'
import type { RealtimeEvent } from '../services/realtime'

const { user } = useAuth()
const me = ref<User | null>(null)
const profiles = ref<UserSearchResult[]>([])
const loading = ref(true)
const errorMessage = ref('')

/** Raccourcis de sport affichés sous la recherche, avec la valeur d'API correspondante. */
const quickSports: { label: string; sport: Sport }[] = [
  { label: 'Running', sport: 'course_a_pied' },
  { label: 'Vélo', sport: 'cyclisme' },
  { label: 'Tennis', sport: 'tennis' },
  { label: 'Yoga', sport: 'yoga' },
  { label: 'Muscu', sport: 'musculation' },
  { label: 'Natation', sport: 'natation' },
  { label: 'Football', sport: 'football' },
  { label: 'Basket', sport: 'basketball' },
  { label: 'Boxe', sport: 'boxe' },
  { label: 'CrossFit', sport: 'crossfit' },
  { label: 'Autre', sport: 'autre' },
]

/** Sport sélectionné dans les raccourcis ; null = pas de filtre. */
/** Sport choisi dans les raccourcis : même critère partagé avec Recherche et la Carte. */
const { filters } = useSearchFilters()
const selectedSport = toRef(filters, 'sport')

function toggleSport(sport: Sport) {
  selectedSport.value = selectedSport.value === sport ? null : sport
}

/** Texte de recherche : prénom, nom ou libellé d'un sport (sans accents ni casse). */
const query = ref('')

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

/** Profils affichés : filtre sport (sport principal) puis recherche texte. */
const visibleProfiles = computed(() => {
  const q = normalize(query.value)
  return profiles.value.filter((p) => {
    if (!matchesFilters(p, filters)) return false
    if (!q) return true
    const name = normalize(`${p.firstName} ${p.lastName}`)
    const sportMatch = p.sports.some((practice) => normalize(SPORT_LABELS[practice.sport]).includes(q))
    return name.includes(q) || sportMatch
  })
})

/** Cloche : liste des alertes récentes ; la pastille compte celles reçues depuis la dernière ouverture. */
const { history: notifications } = useToast()
const notifOpen = ref(false)
const seenCount = ref(0)
const unseenNotifications = computed(() => Math.max(0, notifications.length - seenCount.value))

function toggleNotifications() {
  notifOpen.value = !notifOpen.value
  if (notifOpen.value) seenCount.value = notifications.length
}

const greetingName = computed(
  () => me.value?.firstName ?? user.value?.email?.split('@')[0] ?? '',
)

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    const uid = user.value?.uid
    me.value = uid ? await fetchUser(uid) : null
    const center = centerOf(me.value)
    const results = await api.searchUsers({
      lat: center.lat,
      lng: center.lng,
      maxKm: FETCH_RADIUS_KM,
    })
    profiles.value = results.filter((p) => p.id !== uid)
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Impossible de charger les sportifs.'
  } finally {
    loading.value = false
  }
}

/** Tableau de bord personnel : mes rendez-vous (créés ou reçus) par statut. */
const activities = ref<Activity[]>([])

const RING_RADIUS = 62
const RING_LENGTH = 2 * Math.PI * RING_RADIUS

const statTiles = computed(() => {
  const counts: Record<ActivityStatus, number> = { en_attente: 0, acceptee: 0, refusee: 0, terminee: 0 }
  for (const a of activities.value) counts[a.status]++
  return [
    // Couleurs à 3:1 minimum sur fond blanc (WCAG 1.4.11) ; le sens reste aussi porté par la légende.
    { status: 'en_attente', label: 'En attente', count: counts.en_attente, color: '#B7791F' },
    { status: 'acceptee', label: 'Confirmés', count: counts.acceptee, color: '#2563EB' },
    { status: 'terminee', label: 'Réalisés', count: counts.terminee, color: '#178A2E' },
    { status: 'refusee', label: 'Refusés', count: counts.refusee, color: '#E62E2E' },
  ] as const
})

/** Totaux, taux de réalisation et arcs de l'anneau (un arc par statut non nul, dans l'ordre de la légende). */
const summary = computed(() => {
  const total = activities.value.length
  const done = activities.value.filter((a) => a.status === 'terminee').length
  const rate = total === 0 ? 0 : Math.round((done / total) * 100)
  let offset = 0
  const segments = statTiles.value
    .filter((tile) => tile.count > 0)
    .map((tile) => {
      const length = (tile.count / total) * RING_LENGTH
      const seg = {
        status: tile.status,
        color: tile.color,
        dash: `${length} ${RING_LENGTH - length}`,
        offset: -offset,
      }
      offset += length
      return seg
    })
  return { total, done, rate, segments }
})

async function loadActivities() {
  try {
    activities.value = await api.listActivities()
  } catch {
    // Le tableau de bord reste à zéro si la liste ne charge pas ; le reste de la page fonctionne.
  }
}

function onRealtime(event: Event) {
  const detail = (event as CustomEvent<RealtimeEvent>).detail
  if (detail.type === 'activity') void loadActivities()
}

onMounted(() => {
  void load()
  void loadActivities()
  window.addEventListener('binofit:realtime', onRealtime)
})
onBeforeUnmount(() => window.removeEventListener('binofit:realtime', onRealtime))
</script>

<template>
  <div class="screen">
    <div class="screen__inner discover">
      <header class="discover__top">
        <img :src="logoUrl" alt="BINOFIT" class="discover__logo" />
        <div class="discover__bell">
          <button
            type="button"
            class="icon-btn"
            aria-label="Notifications"
            :aria-expanded="notifOpen"
            @click="toggleNotifications"
          >
            <Bell :size="18" aria-hidden="true" />
            <span v-if="unseenNotifications > 0" class="discover__bell-dot" aria-hidden="true"></span>
          </button>
          <div v-if="notifOpen" class="discover__notifs" role="region" aria-label="Notifications récentes">
            <p v-if="notifications.length === 0" class="discover__notifs-empty">Aucune notification pour l'instant.</p>
            <ul v-else class="discover__notifs-list">
              <li v-for="(n, i) in notifications" :key="i">
                <span>{{ n.message }}</span>
                <small>{{ new Date(n.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }}</small>
              </li>
            </ul>
          </div>
        </div>
      </header>

      <div class="discover__intro">
        <p class="discover__greeting">Salut {{ greetingName }}</p>
        <h1>Trouve ton <span class="text-lime">binôme</span> près de chez toi</h1>
      </div>


      <div class="discover__search">
        <label class="discover__input">
          <Search :size="18" aria-hidden="true" />
          <input v-model="query" type="search" placeholder="Un sport, un prénom…" aria-label="Rechercher un sportif" />
        </label>
        <RouterLink :to="{ name: 'recherche' }" class="discover__filter" aria-label="Filtrer">
          <SlidersHorizontal :size="18" aria-hidden="true" />
        </RouterLink>
      </div>

      <ul class="discover__sports" aria-label="Filtrer par sport">
        <li v-for="item in quickSports" :key="item.sport">
          <button
            type="button"
            class="sport-chip"
            :class="{ 'is-active': selectedSport === item.sport }"
            :aria-pressed="selectedSport === item.sport"
            @click="toggleSport(item.sport)"
          >
            <span class="sport-chip__icon">
              <SportIcon :sport="item.sport" :size="item.sport === 'autre' ? 26 : 54" />
            </span>
            <span>{{ item.label }}</span>
          </button>
        </li>
      </ul>

      <section class="rdv-card" aria-labelledby="rdv-card-title">
        <div class="rdv-card__head">
          <div>
            <h2 id="rdv-card-title" class="rdv-card__title">Mes rendez-vous</h2>
            <p class="rdv-card__subtitle">Vue d'ensemble</p>
          </div>
          <RouterLink :to="{ name: 'activities' }" class="rdv-card__link" aria-label="Voir tous mes rendez-vous">
            <ArrowUpRight :size="20" aria-hidden="true" />
          </RouterLink>
        </div>

        <div class="rdv-card__body">
          <div class="rdv-card__donut" role="img" :aria-label="`${summary.total} rendez-vous, ${summary.done} réalisés sur ${summary.total}`">
            <svg viewBox="0 0 160 160" aria-hidden="true">
              <g transform="rotate(-90 80 80)">
                <circle class="rdv-card__track" cx="80" cy="80" r="62" fill="none" stroke-width="16" />
                <circle
                  v-for="seg in summary.segments"
                  :key="seg.status"
                  cx="80"
                  cy="80"
                  r="62"
                  fill="none"
                  :stroke="seg.color"
                  stroke-width="16"
                  :stroke-dasharray="seg.dash"
                  :stroke-dashoffset="seg.offset"
                />
              </g>
            </svg>
            <div class="rdv-card__center">
              <span class="rdv-card__total">{{ summary.total }}</span>
              <span class="rdv-card__total-label">rendez-vous</span>
            </div>
          </div>

          <ul class="rdv-card__legend">
            <li v-for="tile in statTiles" :key="tile.status">
              <span class="rdv-card__dot" :class="{ 'rdv-card__dot--ring': tile.status === 'acceptee' }" :style="{ '--dot': tile.color }" aria-hidden="true"></span>
              <span class="rdv-card__legend-label">{{ tile.label }}</span>
              <span class="rdv-card__legend-count">{{ tile.count }}</span>
            </li>
          </ul>
        </div>

        <div class="rdv-card__rate">
          <div class="rdv-card__rate-head">
            <span>Taux de réalisation</span>
            <span class="rdv-card__rate-value">{{ summary.rate }} %</span>
          </div>
          <div class="rdv-card__bar" role="progressbar" :aria-valuenow="summary.rate" aria-valuemin="0" aria-valuemax="100">
            <div class="rdv-card__bar-fill" :style="{ width: `${summary.rate}%` }"></div>
          </div>
          <span class="rdv-card__rate-caption">{{ summary.done }} rendez-vous réalisés sur {{ summary.total }}</span>
        </div>
      </section>

      <RouterLink :to="{ name: 'carte' }" class="discover__banner discover__banner--mobile-only">
        <img src="/assets/banner-decouvrir.png" alt="" class="discover__banner-img" />
        <span class="discover__banner-link">
          <MapPin :size="18" aria-hidden="true" />
          Voir la carte
        </span>
      </RouterLink>

      <p v-if="!me && !loading" class="field-hint">
        Ton profil n'est pas encore enregistré : recherche autour de Lyon.
      </p>

      <div class="discover__section-head">
        <h2>Près de chez toi</h2>
        <RouterLink :to="{ name: 'carte' }" class="discover__more">Voir la carte</RouterLink>
      </div>

      <div v-if="loading" class="state">
        <span class="spinner spinner--muted" aria-hidden="true"></span>
        <span>Recherche des sportifs…</span>
      </div>

      <div v-else-if="errorMessage" class="alert alert-error">
        {{ errorMessage }}
        <button type="button" class="btn-link" @click="load">Réessayer</button>
      </div>

      <p v-else-if="visibleProfiles.length === 0" class="state">
        {{ selectedSport || query ? 'Aucun sportif ne correspond dans ce rayon.' : 'Personne dans ce rayon pour l\'instant.' }}
      </p>

      <ul v-else class="athlete-list">
        <AthleteCard v-for="p in visibleProfiles" :key="p.id" :profile="p" />
      </ul>
    </div>
  </div>
</template>

<style scoped>
.discover {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding-bottom: 24px;
}

.discover__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.discover__logo {
  height: 28px;
  width: auto;
}

.discover__intro {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* Carte « Mes rendez-vous » : anneau par statut, légende et taux de réalisation. */
.rdv-card {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text);
}

.rdv-card__track {
  stroke: var(--color-surface-2);
}

.rdv-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.rdv-card__title {
  font-size: 18px;
  font-weight: 800;
  line-height: 1.2;
}

.rdv-card__subtitle {
  font-size: 13px;
  color: var(--color-text-muted);
  margin-top: 2px;
}

.rdv-card__link {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--color-lime-soft);
  color: var(--color-lime-dark);
  text-decoration: none;
}

.rdv-card__link:focus-visible {
  outline: 3px solid var(--color-lime-soft);
  outline-offset: 2px;
}

.rdv-card__body {
  display: flex;
  align-items: center;
  gap: 16px;
}

.rdv-card__donut {
  position: relative;
  flex-shrink: 0;
  width: 150px;
  height: 150px;
}

.rdv-card__donut svg {
  width: 100%;
  height: 100%;
  display: block;
}

.rdv-card__center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.rdv-card__total {
  font-size: 34px;
  font-weight: 800;
}

.rdv-card__total-label {
  font-size: 12px;
  color: var(--color-text-muted);
  margin-top: 4px;
}

.rdv-card__legend {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  list-style: none;
  padding: 0;
  margin: 0;
}

.rdv-card__legend li {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.rdv-card__dot {
  flex-shrink: 0;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--dot);
}

.rdv-card__dot--ring {
  background: transparent;
  border: 2px solid var(--dot);
  box-sizing: border-box;
}

.rdv-card__legend-label {
  flex: 1;
  color: var(--color-text-muted);
}

.rdv-card__legend-count {
  font-weight: 800;
  font-size: 16px;
  font-variant-numeric: tabular-nums;
}

.rdv-card__rate {
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rdv-card__rate-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 14px;
}

.rdv-card__rate-value {
  font-size: 18px;
  font-weight: 800;
  color: var(--color-lime-dark);
}

.rdv-card__bar {
  height: 8px;
  border-radius: 999px;
  background: var(--color-surface-2);
  overflow: hidden;
}

.rdv-card__bar-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--color-lime);
  transition: width 0.4s ease;
}

.rdv-card__rate-caption {
  font-size: 12px;
  color: var(--color-text-muted);
}

@media (prefers-reduced-motion: reduce) {
  .rdv-card__bar-fill {
    transition: none;
  }
}

.discover__intro h1 {
  font-size: 25px;
  line-height: 1.15;
  font-weight: 800;
}

.discover__bell {
  position: relative;
}

.discover__bell-dot {
  position: absolute;
  top: 6px;
  right: 7px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #E62E2E;
  border: 2px solid var(--color-surface);
}

.discover__notifs {
  position: absolute;
  top: 46px;
  right: 0;
  z-index: 50;
  width: min(300px, 80vw);
  max-height: 320px;
  overflow-y: auto;
  padding: 10px;
  border-radius: var(--radius-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  box-shadow: 0 10px 30px rgba(18, 21, 18, 0.14);
}

.discover__notifs-empty {
  margin: 0;
  padding: 8px;
  color: var(--color-text-muted);
  font-size: 13px;
}

.discover__notifs-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.discover__notifs-list li {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px;
  border-radius: 10px;
  background: var(--color-surface-2);
  font-size: 13px;
}

.discover__notifs-list small {
  color: var(--color-text-muted);
  font-size: 11px;
}

.discover__greeting {
  color: var(--color-lime-dark);
  font-family: 'Caveat', cursive;
  font-size: 26px;
  font-weight: 700;
  line-height: 1.1;
}

.text-lime {
  color: var(--color-lime);
}

.discover__search {
  display: flex;
  align-items: center;
  gap: 10px;
}

.discover__input {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 16px;
  height: 52px;
  border-radius: var(--radius-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
}

.discover__input input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--color-text);
  font: inherit;
  font-size: 13.5px;
  outline: none;
}

/* Pas de halo vert au focus : le champ garde sa bordure grise */
.discover__input input:focus,
.discover__input input:focus-visible {
  outline: none;
  box-shadow: none;
  border-color: transparent;
}

.discover__filter {
  width: 52px;
  height: 52px;
  border-radius: var(--radius-md);
  background: var(--color-lime);
  color: var(--primary-foreground);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.discover__sports {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  list-style: none;
  margin: 0;
  padding: 0 0 4px;
}

.sport-chip:focus-visible {
  outline: 3px solid var(--color-lime-soft);
  outline-offset: 2px;
  border-radius: var(--radius-md);
}

.sport-chip {
  flex: 0 0 auto;
  width: 76px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: 0;
  padding: 0;
  color: var(--color-text);
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
}

.sport-chip__icon {
  width: 68px;
  height: 60px;
  border-radius: var(--radius-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  display: flex;
  align-items: center;
  justify-content: center;
}

.sport-chip.is-active .sport-chip__icon {
  background: var(--color-lime);
  border-color: var(--color-lime);
  color: var(--primary-foreground);
}

.discover__banner {
  position: relative;
  display: block;
  border-radius: var(--radius-lg);
  overflow: hidden;
  text-decoration: none;
}

.discover__banner-img {
  display: block;
  width: 100%;
  height: auto;
}

/* La bannière illustrée n'est affichée que sur mobile */
@media (min-width: 1024px) {
  .discover__banner--mobile-only {
    display: none;
  }
}



/* Bouton blanc en bas à gauche, comme sur l'illustration de référence */
.discover__banner-link {
  position: absolute;
  left: 5%;
  bottom: 8%;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 12px 20px;
  border-radius: 999px;
  background: #FFFFFF;
  color: var(--color-text);
  font-size: 16px;
  font-weight: 700;
  box-shadow: 0 6px 18px rgba(18, 21, 18, 0.12);
}

.discover__banner-link svg {
  color: var(--color-lime-dark);
}

.discover__section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
}

.discover__section-head h2 {
  font-size: 18px;
  font-weight: 800;
}

.discover__more {
  color: var(--color-lime);
  font-size: 12.5px;
  font-weight: 700;
  text-decoration: none;
}

.state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 32px 0;
  color: var(--color-text-muted);
  font-size: 12.5px;
  text-align: center;
}

.athlete-list {
  list-style: none;
  margin: 0;
  padding: 0 0 8px;
  display: flex;
  flex-direction: row;
  gap: 12px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
}

/* Une carte par défilement horizontal, chacune à demi-largeur ou presque */
.athlete-list > li {
  flex: 0 0 min(230px, 70%);
  scroll-snap-align: start;
}

/* Desktop : grille de profils sur trois colonnes */
@media (min-width: 1024px) {
  .discover {
    gap: 22px;
  }

  .discover__intro h1 {
    font-size: 36px;
  }

  .discover__search {
    max-width: 720px;
  }

  .discover__sports {
    flex-wrap: wrap;
    overflow: visible;
  }


}
</style>
