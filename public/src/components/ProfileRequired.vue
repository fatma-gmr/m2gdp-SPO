<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { missingProfileItems } from '../services/profileCompletion'
import { fetchUser } from '../services/users'

/** Affiché quand l'API répond `profile_required` : dit ce qui manque et renvoie vers la page Profil. */
const { user } = useAuth()
const missing = ref<string[]>([])

onMounted(async () => {
  try {
    missing.value = missingProfileItems(user.value?.uid ? await fetchUser(user.value.uid) : null)
  } catch {
    missing.value = missingProfileItems(null)
  }
})
</script>

<template>
  <div class="profile-required alert alert-error" role="alert">
    <p><strong>Complète ton profil pour continuer.</strong></p>
    <ul v-if="missing.length" class="profile-required__list">
      <li v-for="item in missing" :key="item">{{ item }}</li>
    </ul>
    <RouterLink :to="{ name: 'profil' }" class="profile-required__link">Compléter mon profil →</RouterLink>
  </div>
</template>

<style scoped>
.profile-required {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.profile-required p {
  margin: 0;
}

.profile-required__list {
  margin: 0;
  padding-left: 18px;
  font-size: 12.5px;
}

.profile-required__link {
  font-weight: 700;
  text-decoration: underline;
  color: inherit;
}
</style>
