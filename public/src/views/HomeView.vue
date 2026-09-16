<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'

const router = useRouter()
const { user, profile, logout } = useAuth()

const initials = computed(() => {
  if (profile.value) {
    return (profile.value.prenom[0] ?? '') + (profile.value.nom[0] ?? '')
  }
  return user.value?.email?.[0]?.toUpperCase() ?? '?'
})

const displayName = computed(() => {
  if (profile.value) return `${profile.value.prenom} ${profile.value.nom}`
  return user.value?.email ?? 'Athlète BINOFIT'
})

const memberSince = computed(() => {
  if (!profile.value?.createdAt) return null
  return new Date(profile.value.createdAt).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
})

async function onLogout() {
  await logout()
  router.replace('/connexion')
}
</script>

<template>
  <div class="screen">
    <div class="screen__inner">
      <div class="top-bar">
        <div class="brand">
          <div class="brand__mark">B</div>
          <div class="brand__name">BINO<span>FIT</span></div>
        </div>
        <button type="button" class="icon-btn" title="Se déconnecter" @click="onLogout">⏻</button>
      </div>

      <div class="profile-hero">
        <div class="avatar">{{ initials.toUpperCase() }}</div>
        <h1>{{ displayName }}</h1>
        <span v-if="profile" class="pill">🏅 {{ profile.sport }}</span>
      </div>

      <template v-if="profile">
        <div class="info-list">
          <div class="info-row">
            <div class="info-row__icon">✉️</div>
            <div class="info-row__body">
              <span class="info-row__label">E-mail</span>
              <span class="info-row__value">{{ profile.email }}</span>
            </div>
          </div>
          <div class="info-row">
            <div class="info-row__icon">📍</div>
            <div class="info-row__body">
              <span class="info-row__label">Localisation</span>
              <span class="info-row__value">{{ profile.localisation }}</span>
            </div>
          </div>
          <div class="info-row">
            <div class="info-row__icon">🏋️</div>
            <div class="info-row__body">
              <span class="info-row__label">Sport pratiqué</span>
              <span class="info-row__value">{{ profile.sport }}</span>
            </div>
          </div>
          <div v-if="memberSince" class="info-row">
            <div class="info-row__icon">🗓️</div>
            <div class="info-row__body">
              <span class="info-row__label">Membre depuis</span>
              <span class="info-row__value">{{ memberSince }}</span>
            </div>
          </div>
        </div>
      </template>

      <p v-else class="alert alert-error">
        Profil introuvable sur cet appareil (POC : le profil est stocké localement).
        Connecté en tant que <strong>{{ user?.email }}</strong>.
      </p>

      <button type="button" class="btn btn-secondary" @click="onLogout">Se déconnecter</button>

      <p class="footer-note">BINOFIT · connecté via lien magique Firebase</p>
    </div>
  </div>
</template>
