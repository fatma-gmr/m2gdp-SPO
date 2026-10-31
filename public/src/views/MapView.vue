<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { LocateFixed, Search } from 'lucide-vue-next'
import { useAuth } from '../composables/useAuth'
import { api } from '../services/api'
import { LEVEL_LABELS, SPORT_LABELS } from '../services/labels'
import { formatDistance, initials } from '../services/format'
import { DEFAULT_RADIUS_KM, centerOf } from '../services/location'
import { fetchUser } from '../services/users'
import type { UserSearchResult } from '../types/api'

const { user } = useAuth()

const mapEl = ref<HTMLElement | null>(null)
const selected = ref<UserSearchResult | null>(null)
/** Sportifs proches, affichés dans la liste latérale (desktop). */
const people = ref<UserSearchResult[]>([])
const loading = ref(true)
const errorMessage = ref('')
let map: L.Map | null = null

function pinIcon(p: UserSearchResult) {
  return L.divIcon({
    className: 'binofit-pin-wrap',
    html: `<div class="binofit-pin">${initials(p.firstName, p.lastName)}</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  })
}

onMounted(async () => {
  try {
    const uid = user.value?.uid
    const me = uid ? await fetchUser(uid) : null
    const center = centerOf(me)
    if (!mapEl.value) return

    map = L.map(mapEl.value, { zoomControl: false }).setView([center.lat, center.lng], 13)
    L.control.zoom({ position: 'bottomright' }).addTo(map)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(map)
    L.circle([center.lat, center.lng], {
      radius: DEFAULT_RADIUS_KM * 1000,
      color: '#178A2E',
      weight: 1,
      dashArray: '6 6',
      fillColor: '#178A2E',
      fillOpacity: 0.06,
    }).addTo(map)

    const results = await api.searchUsers({
      lat: center.lat,
      lng: center.lng,
      maxKm: DEFAULT_RADIUS_KM,
    })
    people.value = results.filter((p) => p.id !== uid)
    for (const p of results) {
      if (p.id === uid) continue
      L.marker([p.location.lat, p.location.lng], { icon: pinIcon(p), title: p.firstName })
        .on('click', () => {
          selected.value = p
        })
        .addTo(map)
    }

    await nextTick()
    map.invalidateSize()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Impossible de charger la carte.'
  } finally {
    loading.value = false
  }
})

onBeforeUnmount(() => {
  map?.remove()
  map = null
})
</script>

<template>
  <div class="map-screen">
    <!-- Liste latérale (desktop uniquement) -->
    <aside class="map-list" aria-label="Sportifs proches">
      <h2>Carte</h2>
      <p class="map-list__count">{{ people.length }} sportifs · {{ DEFAULT_RADIUS_KM }} km</p>
      <button
        v-for="p in people"
        :key="p.id"
        type="button"
        class="map-list__item"
        :class="{ 'is-active': selected?.id === p.id }"
        @click="selected = p"
      >
        <span class="avatar map-list__avatar">{{ initials(p.firstName, p.lastName) }}</span>
        <span class="map-list__who">
          <strong>{{ p.firstName }}</strong>
          <small v-if="p.sports[0]">{{ SPORT_LABELS[p.sports[0].sport] }} · {{ LEVEL_LABELS[p.sports[0].level] }}</small>
        </span>
        <span class="map-list__km">{{ formatDistance(p.distanceKm) }}</span>
      </button>
    </aside>

    <div class="map-area">
    <div ref="mapEl" class="map"></div>

    <div v-if="loading" class="map-loading">
      <span class="spinner spinner--muted" aria-hidden="true"></span>
    </div>

    <!-- Recherche et filtres, au-dessus de la carte -->
    <div class="map-top">
      <div class="map-search">
        <label class="map-search__input">
          <Search :size="18" aria-hidden="true" />
          <input type="search" placeholder="Lyon · Presqu'île" aria-label="Lieu de recherche" />
        </label>
        <button type="button" class="map-search__locate" aria-label="Me localiser">
          <LocateFixed :size="18" aria-hidden="true" />
        </button>
      </div>
      <div class="map-chips">
        <span class="map-chip is-active">Rayon {{ DEFAULT_RADIUS_KM }} km</span>
        <span class="map-chip">Tous les sports</span>
        <span class="map-chip">Tous niveaux</span>
      </div>
      <div v-if="errorMessage" class="alert alert-error">{{ errorMessage }}</div>
    </div>

    <!-- Fiche du sportif sélectionné -->
    <div v-if="selected" class="map-sheet">
      <span class="map-sheet__grabber" aria-hidden="true"></span>
      <div class="map-sheet__head">
        <div class="avatar map-sheet__avatar">
          <img v-if="selected.avatarUrl" :src="selected.avatarUrl" :alt="selected.firstName" />
          <template v-else>{{ initials(selected.firstName, selected.lastName) }}</template>
        </div>
        <div class="map-sheet__who">
          <h2>{{ selected.firstName }}</h2>
          <p>
            <span v-if="selected.sports[0]" class="pill">{{ SPORT_LABELS[selected.sports[0].sport] }}</span>
            <span v-if="selected.sports[0]">{{ LEVEL_LABELS[selected.sports[0].level] }}</span>
            <span v-if="selected.sports.length > 1" class="muted">· +{{ selected.sports.length - 1 }} sport</span>
          </p>
        </div>
        <strong class="map-sheet__distance">{{ formatDistance(selected.distanceKm) }}</strong>
      </div>
      <div class="map-sheet__actions">
        <RouterLink :to="{ name: 'athlete', params: { id: selected.id } }" class="map-btn map-btn--outline">
          Voir le profil
        </RouterLink>
        <RouterLink :to="{ name: 'athlete', params: { id: selected.id } }" class="map-btn map-btn--primary">
          Écrire →
        </RouterLink>
      </div>
    </div>
    <p v-else-if="!loading" class="map-hint">Touche un marqueur pour voir le profil.</p>
    </div>
  </div>
</template>

<style scoped>
.map-area {
  position: relative;
  height: 100%;
}

.map-list {
  display: none;
}

.map-screen {
  position: relative;
  width: 100%;
  height: calc(100svh - 72px - env(safe-area-inset-bottom, 0px));
  overflow: hidden;
}

.map {
  position: absolute;
  inset: 0;
  background: var(--color-surface-2);
}

.map-loading {
  position: absolute;
  inset: 0;
  z-index: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(246, 246, 244, 0.5);
}

.map-top {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 400;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px 16px 0;
}

.map-search {
  display: flex;
  align-items: center;
  gap: 10px;
}

.map-search__input {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 50px;
  padding: 0 16px;
  border-radius: var(--radius-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
  box-shadow: 0 6px 16px rgba(18, 21, 18, 0.08);
}

.map-search__input input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--color-text);
  font: inherit;
  font-size: 15px;
  outline: none;
}

.map-search__locate {
  width: 50px;
  height: 50px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 16px rgba(18, 21, 18, 0.08);
  cursor: pointer;
}

.map-chips {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.map-chip {
  flex: 0 0 auto;
  padding: 8px 14px;
  border-radius: 999px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  font-size: 14px;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(18, 21, 18, 0.06);
}

.map-chip.is-active {
  background: var(--color-lime);
  border-color: var(--color-lime);
  color: var(--primary-foreground);
}

.map-sheet {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 12px;
  z-index: 400;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 12px 16px 16px;
  border-radius: 24px;
  background: var(--color-surface);
  box-shadow: 0 16px 36px rgba(18, 21, 18, 0.16);
}

.map-sheet__grabber {
  align-self: center;
  width: 40px;
  height: 4px;
  border-radius: 999px;
  background: var(--color-border);
}

.map-sheet__head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.map-sheet__avatar {
  width: 56px;
  height: 56px;
  font-size: 18px;
}

.map-sheet__avatar img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.map-sheet__who {
  flex: 1;
  min-width: 0;
}

.map-sheet__who h2 {
  font-size: 18px;
  font-weight: 800;
}

.map-sheet__who p {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  color: var(--color-text-muted);
  font-size: 14px;
}

.map-sheet__distance {
  color: var(--color-lime);
  font-size: 20px;
  font-weight: 800;
}

.map-sheet__actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.map-btn {
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  font-weight: 700;
  font-size: 15px;
  text-decoration: none;
}

.map-btn--outline {
  border: 1.5px solid var(--color-lime);
  color: var(--color-lime);
  background: var(--color-surface);
}

.map-btn--primary {
  background: var(--color-lime);
  color: var(--primary-foreground);
}

.map-hint {
  position: absolute;
  left: 16px;
  right: 16px;
  bottom: 16px;
  z-index: 400;
  padding: 12px 16px;
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: 14px;
  text-align: center;
  box-shadow: 0 8px 20px rgba(18, 21, 18, 0.1);
}

/* Desktop : liste des sportifs à gauche, carte à droite */
@media (min-width: 1024px) {
  .map-screen {
    display: grid;
    grid-template-columns: 320px minmax(0, 1fr);
    height: calc(100svh - 72px);
  }

  .map-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 18px 16px;
    overflow-y: auto;
    background: var(--color-surface);
    border-right: 1px solid var(--color-border);
  }

  .map-list h2 {
    font-size: 24px;
    font-weight: 800;
  }

  .map-list__count {
    margin-bottom: 8px;
    font-size: 14px;
    color: var(--color-text-muted);
  }

  .map-list__item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .map-list__item.is-active {
    border-color: var(--color-lime);
    background: var(--color-lime-soft);
  }

  .map-list__avatar {
    width: 44px;
    height: 44px;
    font-size: 15px;
    flex-shrink: 0;
  }

  .map-list__who {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .map-list__who strong {
    font-size: 15px;
  }

  .map-list__who small {
    font-size: 13px;
    color: var(--color-text-muted);
  }

  .map-list__km {
    color: var(--color-lime);
    font-weight: 800;
    font-size: 14px;
  }
}
</style>

<style>
/* Marqueurs Leaflet (HTML injecté par divIcon, donc hors du scope du composant). */
.binofit-pin-wrap {
  background: transparent;
  border: none;
}

.binofit-pin {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--color-lime);
  color: var(--primary-foreground);
  font-weight: 800;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3px solid var(--color-surface);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}
</style>
