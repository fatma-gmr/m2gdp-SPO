<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import BottomNav from './components/BottomNav.vue'
import ToastHost from './components/ToastHost.vue'
import { useAuth } from './composables/useAuth'
import { useUnread } from './composables/useUnread'
import { pushToast } from './composables/useToast'
import type { RealtimeEvent } from './services/realtime'

const route = useRoute()
const showNav = computed(() => route.meta.tab === true)

// Surveille les nouveaux messages tant que l'utilisateur est connecté (quel que soit l'écran).
const { user } = useAuth()
const { startUnreadPolling, stopUnreadPolling } = useUnread()
watch(
  () => user.value?.uid,
  (uid) => (uid ? startUnreadPolling() : stopUnreadPolling()),
  { immediate: true },
)

/** Alerte à l'écran pour les événements qui concernent l'utilisateur (pas ses propres actions). */
function announce(event: RealtimeEvent) {
  const me = user.value?.uid
  if (!me) return
  if (event.type === 'message') {
    if (event.senderId !== me) pushToast('Nouveau message reçu')
    return
  }
  if (event.type === 'activity' && event.actorId !== me) {
    if (event.guestId === me && event.status === 'en_attente') {
      pushToast('Nouvelle proposition d’activité reçue', 'info')
    } else if (event.creatorId === me && event.status === 'acceptee') {
      pushToast('Ta proposition a été acceptée', 'success')
    } else if (event.creatorId === me && event.status === 'refusee') {
      pushToast('Ta proposition a été refusée', 'warning')
    }
  }
}

function onRealtime(e: Event) {
  announce((e as CustomEvent<RealtimeEvent>).detail)
}

onMounted(() => window.addEventListener('binofit:realtime', onRealtime))
onBeforeUnmount(() => window.removeEventListener('binofit:realtime', onRealtime))
</script>

<template>
  <div :class="{ 'has-tabbar': showNav }">
    <router-view />
    <BottomNav v-if="showNav" />
    <ToastHost />
  </div>
</template>

<style scoped>
.has-tabbar {
  min-height: 100svh;
  padding-bottom: calc(96px + env(safe-area-inset-bottom, 0px));
}

@media (min-width: 1024px) {
  .has-tabbar {
    padding-top: 96px;
    padding-bottom: 0;
  }
}
</style>
