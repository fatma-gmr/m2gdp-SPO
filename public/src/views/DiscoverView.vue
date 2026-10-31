<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { Bell, Bike, Dumbbell, Flower2, PersonStanding, Search, SlidersHorizontal, Target } from 'lucide-vue-next'
import logoUrl from '../assets/logo-binofit-horizontal.png'
import { useAuth } from '../composables/useAuth'
import AthleteCard from '../components/AthleteCard.vue'
import { api } from '../services/api'
import { DEFAULT_RADIUS_KM, centerOf } from '../services/location'
import { fetchUser } from '../services/users'
import type { Sport, User, UserSearchResult } from '../types/api'

const { user } = useAuth()
const me = ref<User | null>(null)
const profiles = ref<UserSearchResult[]>([])
const loading = ref(true)
const errorMessage = ref('')

/** Raccourcis de sport affichés sous la recherche, avec la valeur d'API correspondante. */
const quickSports: { label: string; sport: Sport; icon: typeof Dumbbell }[] = [
  { label: 'Running', sport: 'course_a_pied', icon: PersonStanding },
  { label: 'Vélo', sport: 'cyclisme', icon: Bike },
  { label: 'Tennis', sport: 'tennis', icon: Target },
  { label: 'Yoga', sport: 'yoga', icon: Flower2 },
  { label: 'Muscu', sport: 'musculation', icon: Dumbbell },
]

/** Sport sélectionné dans les raccourcis ; null = pas de filtre. */
const selectedSport = ref<Sport | null>(null)

function toggleSport(sport: Sport) {
  selectedSport.value = selectedSport.value === sport ? null : sport
}

/** Profils affichés : tous, ou seulement ceux qui pratiquent le sport sélectionné. */
const visibleProfiles = computed(() =>
  selectedSport.value
    ? profiles.value.filter((p) => p.sports.some((practice) => practice.sport === selectedSport.value))
    : profiles.value,
)

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
      maxKm: DEFAULT_RADIUS_KM,
    })
    profiles.value = results.filter((p) => p.id !== uid)
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Impossible de charger les sportifs.'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="screen">
    <div class="screen__inner discover">
      <header class="discover__top">
        <img :src="logoUrl" alt="BINOFIT" class="discover__logo" />
        <button type="button" class="icon-btn" aria-label="Notifications">
          <Bell :size="18" aria-hidden="true" />
        </button>
      </header>

      <div class="discover__intro">
        <p class="discover__greeting">Salut {{ greetingName }}</p>
        <h1>Trouve ton <span class="text-lime">binôme</span> près de chez toi</h1>
      </div>

      <div class="discover__search">
        <label class="discover__input">
          <Search :size="18" aria-hidden="true" />
          <input type="search" placeholder="Un sport, un prénom…" aria-label="Rechercher un sportif" />
        </label>
        <RouterLink :to="{ name: 'recherche' }" class="discover__filter" aria-label="Filtrer">
          <SlidersHorizontal :size="18" aria-hidden="true" />
        </RouterLink>
      </div>

      <div class="discover__sports" role="list">
        <button
          v-for="item in quickSports"
          :key="item.sport"
          type="button"
          role="listitem"
          class="sport-chip"
          :class="{ 'is-active': selectedSport === item.sport }"
          :aria-pressed="selectedSport === item.sport"
          @click="toggleSport(item.sport)"
        >
          <span class="sport-chip__icon">
            <component :is="item.icon" :size="22" aria-hidden="true" />
          </span>
          <span>{{ item.label }}</span>
        </button>
      </div>

      <div class="discover__banner">
        <p>Rencontrez des partenaires sportifs près de chez vous</p>
        <RouterLink :to="{ name: 'carte' }" class="discover__banner-link">Voir la carte</RouterLink>
      </div>

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
        {{ selectedSport ? 'Personne pratiquant ce sport dans ce rayon.' : 'Personne dans ce rayon pour l\'instant.' }}
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
  height: 40px;
  width: auto;
}

.discover__intro {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.discover__intro h1 {
  font-size: 28px;
  line-height: 1.15;
  font-weight: 800;
}

.discover__greeting {
  color: var(--color-text-muted);
  font-size: 15px;
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
  font-size: 15px;
  outline: none;
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
  padding-bottom: 4px;
}

.sport-chip {
  flex: 0 0 auto;
  width: 72px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: 0;
  padding: 0;
  color: var(--color-text);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.sport-chip__icon {
  width: 64px;
  height: 56px;
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
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 18px;
  border-radius: var(--radius-lg);
  background: var(--color-lime-soft);
  color: var(--color-text);
}

.discover__banner p {
  font-weight: 600;
  font-size: 16px;
}

.discover__banner-link {
  align-self: flex-start;
  padding: 8px 14px;
  border-radius: 999px;
  background: var(--color-lime);
  color: var(--primary-foreground);
  font-size: 14px;
  font-weight: 700;
  text-decoration: none;
}

.discover__section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
}

.discover__section-head h2 {
  font-size: 20px;
  font-weight: 800;
}

.discover__more {
  color: var(--color-lime);
  font-size: 14px;
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

/* Desktop : grille de profils sur trois colonnes */
@media (min-width: 1024px) {
  .discover {
    gap: 22px;
  }

  .discover__intro h1 {
    font-size: 40px;
  }

  .discover__search {
    max-width: 720px;
  }

  .discover__sports {
    flex-wrap: wrap;
    overflow: visible;
  }

  .discover__banner {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }

  .athlete-list {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
  }
}
</style>
