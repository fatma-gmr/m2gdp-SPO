<script setup lang="ts">
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { computed, onMounted, reactive, ref, type Component } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import {
  Bike,
  Camera,
  CalendarDays,
  ChevronRight,
  Circle,
  Dumbbell,
  Flower2,
  Hand,
  LogOut,
  MapPin,
  PersonStanding,
  Plus,
  Trash2,
  Trophy,
  Waves,
  Zap,
  Target,
} from 'lucide-vue-next'
import { useAuth } from '../composables/useAuth'
import { api, ApiError } from '../services/api'
import { getProfileByEmail } from '../services/profileStore'
import { DAYS, DAY_LABELS, LEVEL_LABELS, SEXE_LABELS, SPORT_LABELS } from '../services/labels'
import { SEARCH_ZONES, nearestZone } from '../services/location'
import { fetchUser } from '../services/users'
import type { AvailabilitySlot, DayOfWeek, Level, Sexe, Sport, User, UserUpdate } from '../types/api'

const router = useRouter()
const { user, logout } = useAuth()

const SPORTS = Object.keys(SPORT_LABELS) as Sport[]
const LEVELS = Object.keys(LEVEL_LABELS) as Level[]
const SEXES = Object.keys(SEXE_LABELS) as Sexe[]
const TODAY = new Date().toISOString().slice(0, 10)
const BIO_MAX = 160

/** Icône de chaque sport dans la grille de sélection. */
const SPORT_ICONS: Record<Sport, Component> = {
  musculation: Dumbbell,
  course_a_pied: PersonStanding,
  football: Trophy,
  basketball: Circle,
  natation: Waves,
  cyclisme: Bike,
  yoga: Flower2,
  boxe: Hand,
  crossfit: Zap,
  tennis: Target,
  autre: Plus,
}

/** Lettre affichée pour chaque jour, dans les pastilles de disponibilité. */
const DAY_LETTERS: Record<DayOfWeek, string> = {
  lundi: 'L',
  mardi: 'M',
  mercredi: 'M',
  jeudi: 'J',
  vendredi: 'V',
  samedi: 'S',
  dimanche: 'D',
}

const me = ref<User | null>(null)
const loading = ref(true)
const loadError = ref('')
const saving = ref(false)
const saveError = ref('')
const saved = ref(false)

const firstName = ref('')
const lastName = ref('')
const bio = ref('')
const sexe = ref<Sexe | null>(null)
const birthDate = ref('')
const zoneIndex = ref(0)
const availability = ref<AvailabilitySlot[]>([])
const sportRows = reactive<Record<string, { on: boolean; level: Level }>>({})

/** Photo choisie, recadrée et réduite, en attente d'enregistrement. */
const fileInput = ref<HTMLInputElement | null>(null)
const avatarDraft = ref<string | null>(null)
const photoError = ref('')
const AVATAR_SIZE = 256
const MAX_PICK_BYTES = 8 * 1024 * 1024

const displayAvatar = computed(() => avatarDraft.value ?? me.value?.avatarUrl ?? null)

/** Recadre l'image au centre en carré et la réduit en JPEG, renvoyé sous forme de data URL. */
function resizeToDataUrl(file: File, size: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight)
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(url)
        reject(new Error('canvas'))
        return
      }
      const sx = (img.naturalWidth - side) / 2
      const sy = (img.naturalHeight - side) / 2
      ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('load'))
    }
    img.src = url
  })
}

async function onPhotoPicked(event: Event) {
  photoError.value = ''
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    photoError.value = 'Choisis une image (JPG, PNG…).'
    return
  }
  if (file.size > MAX_PICK_BYTES) {
    photoError.value = 'Image trop lourde (8 Mo maximum).'
    return
  }
  try {
    avatarDraft.value = await resizeToDataUrl(file, AVATAR_SIZE)
  } catch {
    photoError.value = 'Impossible de lire cette image.'
  }
}

const initialsText = computed(() => {
  const f = firstName.value.trim()[0] ?? ''
  const l = lastName.value.trim()[0] ?? ''
  return `${f}${l}`.toUpperCase() || '?'
})

const selectedSportCount = computed(() => SPORTS.filter((s) => sportRows[s]?.on).length)

/** Complétion du profil : prénom, nom, bio, au moins un sport, au moins une disponibilité. */
const completion = computed(() => {
  const checks = [
    firstName.value.trim().length > 0,
    lastName.value.trim().length > 0,
    bio.value.trim().length > 0,
    selectedSportCount.value > 0,
    availability.value.length > 0,
  ]
  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
})

/** Visible dans les recherches dès que l'identité et au moins un sport sont renseignés. */
const isVisible = computed(
  () => firstName.value.trim() !== '' && lastName.value.trim() !== '' && selectedSportCount.value > 0,
)

function dayOn(day: DayOfWeek): boolean {
  return availability.value.some((s) => s.dayOfWeek === day)
}

/** Active ou retire toutes les disponibilités d'un jour. */
function toggleDay(day: DayOfWeek) {
  if (dayOn(day)) {
    availability.value = availability.value.filter((s) => s.dayOfWeek !== day)
  } else {
    availability.value.push({ dayOfWeek: day, startTime: '18:00', endTime: '20:00' })
  }
}

function fillForm(profile: User | null) {
  const localProfile = user.value?.email ? getProfileByEmail(user.value.email) : null
  firstName.value = profile?.firstName ?? localProfile?.prenom ?? ''
  lastName.value = profile?.lastName ?? localProfile?.nom ?? ''
  bio.value = profile?.bio ?? ''
  sexe.value = profile?.sexe ?? null
  birthDate.value = profile?.birthDate ?? ''
  zoneIndex.value = Math.max(0, SEARCH_ZONES.indexOf(nearestZone(profile?.location)))
  availability.value = profile?.availability.map((s) => ({ ...s })) ?? []

  for (const s of SPORTS) sportRows[s] = { on: false, level: 'intermediaire' }
  for (const practice of profile?.sports ?? []) {
    sportRows[practice.sport] = { on: true, level: practice.level }
  }
}

onMounted(async () => {
  try {
    me.value = user.value?.uid ? await fetchUser(user.value.uid) : null
    fillForm(me.value)
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'Impossible de charger ton profil.'
  } finally {
    loading.value = false
  }
})

function addSlot() {
  availability.value.push({ dayOfWeek: 'lundi', startTime: '18:00', endTime: '20:00' })
}

function removeSlot(index: number) {
  availability.value.splice(index, 1)
}

function setDay(index: number, day: DayOfWeek) {
  const slot = availability.value[index]
  if (slot) slot.dayOfWeek = day
}

async function save() {
  saveError.value = ''
  saved.value = false
  if (!user.value?.uid) return
  if (!firstName.value.trim() || !lastName.value.trim()) {
    saveError.value = 'Prénom et nom sont obligatoires.'
    return
  }
  const badSlot = availability.value.find((s) => s.startTime >= s.endTime)
  if (badSlot) {
    saveError.value = 'Chaque disponibilité doit finir après son début.'
    return
  }

  const zone = SEARCH_ZONES[zoneIndex.value] ?? SEARCH_ZONES[0]!
  const payload: UserUpdate = {
    firstName: firstName.value.trim(),
    lastName: lastName.value.trim(),
    bio: bio.value.trim() || null,
    sexe: sexe.value,
    birthDate: birthDate.value || null,
    location: zone.location,
    sports: SPORTS.filter((s) => sportRows[s]?.on).map((s) => ({
      sport: s,
      level: sportRows[s]!.level,
    })),
    availability: availability.value,
    ...(avatarDraft.value ? { avatarUrl: avatarDraft.value } : {}),
  }

  saving.value = true
  try {
    me.value = await api.updateUser(user.value.uid, payload)
    avatarDraft.value = null
    saved.value = true
  } catch (error) {
    saveError.value = error instanceof ApiError ? error.message : 'Enregistrement impossible.'
  } finally {
    saving.value = false
  }
}

async function onLogout() {
  await logout()
  router.replace('/connexion')
}
</script>

<template>
  <div class="screen">
    <div class="screen__inner profile">
      <header class="profile__top">
        <h1>Mon profil</h1>
        <button type="button" class="logout-btn" @click="onLogout">
          <LogOut :size="16" aria-hidden="true" />
          Se déconnecter
        </button>
      </header>

      <div v-if="loading" class="state">
        <span class="spinner spinner--muted" aria-hidden="true"></span>
        <span>Chargement…</span>
      </div>

      <div v-else-if="loadError" class="alert alert-error">{{ loadError }}</div>

      <template v-else>
        <aside class="profile__side">
        <!-- Carte d'identité et complétion -->
        <section class="profile-card">
          <button
            type="button"
            class="profile-card__avatar"
            aria-label="Changer la photo de profil"
            @click="fileInput?.click()"
          >
            <img v-if="displayAvatar" :src="displayAvatar" :alt="firstName" />
            <template v-else>{{ initialsText }}</template>
            <span class="profile-card__camera" aria-hidden="true"><Camera :size="12" /></span>
          </button>
          <input
            ref="fileInput"
            type="file"
            accept="image/*"
            class="sr-only"
            tabindex="-1"
            @change="onPhotoPicked"
          />
          <div class="profile-card__info">
            <strong>{{ firstName || 'Ton prénom' }} {{ lastName }}</strong>
            <button type="button" class="photo-link" @click="fileInput?.click()">Changer la photo</button>
            <span class="profile-card__status">
              Profil complété à {{ completion }} % · {{ isVisible ? 'visible' : 'non visible' }}
            </span>
            <div class="progress" role="progressbar" :aria-valuenow="completion" aria-valuemin="0" aria-valuemax="100">
              <span :style="{ width: completion + '%' }"></span>
            </div>
          </div>
        </section>

        <p v-if="photoError" class="alert alert-error">{{ photoError }}</p>
        <p v-if="!me" class="field-hint">
          Ton profil n'est pas encore dans BINOFIT : enregistre-le pour apparaître dans les recherches.
        </p>

        <RouterLink :to="{ name: 'activities' }" class="activities-link">
          <span class="activities-link__icon"><CalendarDays :size="18" aria-hidden="true" /></span>
          <span>Mes activités</span>
          <ChevronRight :size="18" aria-hidden="true" class="activities-link__chevron" />
        </RouterLink>
        </aside>

        <form class="profile__form" @submit.prevent="save">
          <div class="form-row--split">
            <div class="form-row">
              <label for="firstName">Prénom</label>
              <Input id="firstName" v-model="firstName" type="text" maxlength="60" placeholder="Ton prénom" required />
            </div>
            <div class="form-row">
              <label for="lastName">Nom</label>
              <Input id="lastName" v-model="lastName" type="text" maxlength="60" placeholder="Ton nom" required />
            </div>
          </div>

          <div class="form-row">
            <div class="field-head">
              <label for="bio">Bio</label>
              <span class="field-counter">{{ bio.length }} / {{ BIO_MAX }}</span>
            </div>
            <Textarea
              id="bio"
              v-model="bio"
              rows="3"
              :maxlength="BIO_MAX"
              placeholder="Quelques mots sur toi"
            ></Textarea>
          </div>

          <div class="form-row">
            <label for="zone">Zone de recherche</label>
            <div class="select-wrap">
              <MapPin :size="16" aria-hidden="true" />
              <select id="zone" v-model="zoneIndex">
                <option v-for="(z, i) in SEARCH_ZONES" :key="z.label" :value="i">{{ z.label }}</option>
              </select>
            </div>
          </div>

          <!-- Informations : sexe et date de naissance, utilisés comme filtres de recherche -->
          <fieldset class="section">
            <div class="section__head">
              <legend>Informations</legend>
            </div>
            <div class="form-row">
              <span class="field-label" id="sexe-label">Sexe</span>
              <div class="choice-row" role="radiogroup" aria-labelledby="sexe-label">
                <button
                  v-for="v in SEXES"
                  :key="v"
                  type="button"
                  class="choice"
                  :class="{ 'is-on': sexe === v }"
                  role="radio"
                  :aria-checked="sexe === v"
                  @click="sexe = sexe === v ? null : v"
                >
                  {{ SEXE_LABELS[v] }}
                </button>
              </div>
            </div>
            <div class="form-row">
              <label for="birthDate">Date de naissance</label>
              <Input id="birthDate" v-model="birthDate" type="date" :max="TODAY" />
            </div>
          </fieldset>

          <!-- Sports : grille de tuiles, niveau à régler pour chaque sport choisi -->
          <fieldset class="section">
            <div class="section__head">
              <legend>Sports pratiqués</legend>
              <span class="field-counter">{{ selectedSportCount }} sélectionné(s)</span>
            </div>
            <div class="sport-grid">
              <label
                v-for="s in SPORTS"
                :key="s"
                class="sport-tile"
                :class="{ 'is-on': sportRows[s]?.on }"
              >
                <input v-model="sportRows[s]!.on" type="checkbox" class="sr-only" />
                <component :is="SPORT_ICONS[s]" :size="22" aria-hidden="true" />
                <span>{{ SPORT_LABELS[s] }}</span>
              </label>
            </div>
            <div v-for="s in SPORTS.filter((x) => sportRows[x]?.on)" :key="s" class="level-row">
              <span>{{ SPORT_LABELS[s] }}</span>
              <select v-model="sportRows[s]!.level" :aria-label="`Niveau en ${SPORT_LABELS[s]}`">
                <option v-for="l in LEVELS" :key="l" :value="l">{{ LEVEL_LABELS[l] }}</option>
              </select>
            </div>
          </fieldset>

          <!-- Disponibilités : jours sélectionnables, puis créneaux détaillés -->
          <fieldset class="section">
            <div class="section__head">
              <legend>Disponibilités</legend>
            </div>
            <div class="day-row" role="group" aria-label="Jours de disponibilité">
              <button
                v-for="d in DAYS"
                :key="d"
                type="button"
                class="day-chip"
                :class="{ 'is-on': dayOn(d) }"
                :aria-pressed="dayOn(d)"
                :aria-label="DAY_LABELS[d]"
                @click="toggleDay(d)"
              >
                {{ DAY_LETTERS[d] }}
              </button>
            </div>

            <p v-if="availability.length === 0" class="field-hint">Aucune disponibilité ajoutée.</p>
            <div v-for="(slot, i) in availability" :key="i" class="slot">
              <select :value="slot.dayOfWeek" aria-label="Jour" @change="setDay(i, ($event.target as HTMLSelectElement).value as DayOfWeek)">
                <option v-for="d in DAYS" :key="d" :value="d">{{ DAY_LABELS[d] }}</option>
              </select>
              <Input v-model="slot.startTime" type="time" aria-label="Début" />
              <Input v-model="slot.endTime" type="time" aria-label="Fin" />
              <button type="button" class="icon-btn" aria-label="Supprimer" @click="removeSlot(i)">
                <Trash2 :size="16" aria-hidden="true" />
              </button>
            </div>
            <button type="button" class="add-slot" @click="addSlot">
              <Plus :size="16" aria-hidden="true" />
              Ajouter un créneau
            </button>
          </fieldset>

          <p v-if="saveError" class="alert alert-error">{{ saveError }}</p>
          <p v-if="saved" class="alert alert-success">Profil enregistré.</p>

          <button type="submit" class="save-btn" :disabled="saving">
            {{ saving ? 'Enregistrement…' : 'Enregistrer mon profil' }}
          </button>
        </form>
      </template>
    </div>
  </div>
</template>

<style scoped>
.profile {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 24px;
}

.profile__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.profile__top h1 {
  font-size: 28px;
  font-weight: 800;
}

.logout-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 40px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 48px 0;
  color: var(--color-text-muted);
  font-size: 14px;
}

.profile-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px;
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
}

.profile-card__avatar {
  position: relative;
  border: 0;
  padding: 0;
  cursor: pointer;
  font: inherit;
  width: 76px;
  height: 76px;
  border-radius: 50%;
  background: var(--color-lime-soft);
  color: var(--color-lime);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  font-weight: 800;
  flex-shrink: 0;
}

.profile-card__avatar img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.profile-card__camera {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--color-lime);
  color: var(--primary-foreground);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--color-surface);
}

.profile-card__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.profile-card__info strong {
  font-size: 17px;
  font-weight: 800;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.photo-link {
  align-self: flex-start;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-lime);
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.profile-card__status {
  color: var(--color-text-muted);
  font-size: 13px;
}

.progress {
  height: 6px;
  margin-top: 6px;
  border-radius: 999px;
  background: var(--color-surface-2);
  overflow: hidden;
}

.progress span {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--color-lime);
  transition: width 0.3s ease;
}

.activities-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  font-weight: 700;
  text-decoration: none;
}

.activities-link__icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--color-lime-soft);
  color: var(--color-lime);
  display: flex;
  align-items: center;
  justify-content: center;
}

.activities-link__chevron {
  margin-left: auto;
  color: var(--color-text-muted);
}

.profile__form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.field-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.field-counter {
  color: var(--color-text-muted);
  font-size: 13px;
}

textarea {
  appearance: none;
  width: 100%;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
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

.select-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.select-wrap > svg {
  position: absolute;
  left: 14px;
  color: var(--color-lime);
  pointer-events: none;
}

.select-wrap select {
  width: 100%;
  padding-left: 40px;
}

.section {
  border: 0;
  padding: 0;
  margin: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.section legend {
  font-size: 17px;
  font-weight: 800;
  color: var(--color-text);
  padding: 0;
}

.sport-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.sport-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 74px;
  padding: 8px 4px;
  border-radius: var(--radius-md);
  background: var(--color-surface);
  border: 1.5px solid var(--color-border);
  color: var(--color-text);
  font-size: 12px;
  font-weight: 600;
  text-align: center;
  cursor: pointer;
}

.sport-tile.is-on {
  border-color: var(--color-lime);
  background: var(--color-lime-soft);
  color: var(--color-lime-dark);
}

.sport-tile svg {
  color: var(--color-lime);
}

.sport-tile:focus-within {
  outline: 3px solid var(--color-lime);
  outline-offset: 2px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

.level-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  font-size: 15px;
  font-weight: 600;
}

.level-row select {
  width: auto;
  padding: 8px 12px;
  font-size: 14px;
}

.field-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}

.choice-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.choice {
  height: 46px;
  border-radius: var(--radius-md);
  border: 1.5px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.choice.is-on {
  background: var(--color-lime);
  border-color: var(--color-lime);
  color: var(--primary-foreground);
}

.day-row {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 6px;
}

.day-chip {
  height: 46px;
  border-radius: var(--radius-md);
  border: 1.5px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

.day-chip.is-on {
  background: var(--color-lime);
  border-color: var(--color-lime);
  color: var(--primary-foreground);
}

.slot {
  display: grid;
  grid-template-columns: 1.2fr 1fr 1fr auto;
  gap: 6px;
  align-items: center;
}

.slot select,
.slot input {
  padding: 10px 8px;
  font-size: 14px;
  min-width: 0;
}

.slot .icon-btn {
  width: 36px;
  height: 36px;
}

.add-slot {
  height: 46px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: var(--radius-md);
  border: 1.5px dashed var(--color-lime);
  background: transparent;
  color: var(--color-lime);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.save-btn {
  height: 56px;
  border-radius: var(--radius-md);
  border: 0;
  background: var(--color-lime);
  color: var(--primary-foreground);
  font: inherit;
  font-size: 17px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 8px 20px rgba(23, 138, 46, 0.25);
}

.save-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

@media (max-width: 360px) {
  .sport-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

/* Desktop : identité et actions à gauche, formulaire à droite */
@media (min-width: 1024px) {
  .profile {
    display: grid;
    grid-template-columns: 300px minmax(0, 1fr);
    gap: 24px;
    align-items: start;
  }

  .profile__top {
    grid-column: 1 / -1;
  }

  .profile__side {
    display: flex;
    flex-direction: column;
    gap: 14px;
    position: sticky;
    top: 96px;
  }

  .profile__form {
    gap: 20px;
    padding: 24px;
    border-radius: 24px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
  }

  .sport-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  }

  .profile > .state,
  .profile > .alert,
  .profile > .field-hint {
    grid-column: 1 / -1;
  }
}
</style>
