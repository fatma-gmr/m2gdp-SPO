<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Compass, Map as MapIcon, MessageCircle, User } from 'lucide-vue-next'

/** Onglets de la barre du bas. « Mes activités » s'ouvre depuis Profil. */
const tabs = [
  { to: '/decouvrir', label: 'Accueil', icon: Compass },
  { to: '/carte', label: 'Carte', icon: MapIcon },
  { to: '/messages', label: 'Messages', icon: MessageCircle },
  { to: '/profil', label: 'Profil', icon: User },
]

const route = useRoute()

/** Onglet actif d'après l'URL ; -1 si l'écran n'est pas un onglet. */
const activeIndex = computed(() =>
  tabs.findIndex((tab) => route.path === tab.to || route.path.startsWith(`${tab.to}/`)),
)

/** Éléments des liens, pour positionner l'indicateur glissant (desktop). */
const linkEls: (HTMLElement | undefined)[] = []
const indicator = ref({ left: 0, width: 0, opacity: 0 })

function setLinkRef(index: number, instance: unknown) {
  const el = (instance as { $el?: HTMLElement } | null)?.$el
  linkEls[index] = el instanceof HTMLElement ? el : undefined
}

function updateIndicator() {
  const el = activeIndex.value >= 0 ? linkEls[activeIndex.value] : undefined
  if (!el) {
    indicator.value = { left: 0, width: 0, opacity: 0 }
    return
  }
  indicator.value = { left: el.offsetLeft, width: el.offsetWidth, opacity: 1 }
}

watch(activeIndex, () => nextTick(updateIndicator))

onMounted(() => {
  updateIndicator()
  window.addEventListener('resize', updateIndicator)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateIndicator)
})
</script>

<template>
  <nav class="tabbar" aria-label="Navigation principale">
    <span
      class="tabbar__indicator"
      :style="{ left: indicator.left + 'px', width: indicator.width + 'px', opacity: indicator.opacity }"
      aria-hidden="true"
    />
    <RouterLink
      v-for="(tab, index) in tabs"
      :key="tab.to"
      :ref="(el) => setLinkRef(index, el)"
      :to="tab.to"
      class="tabbar__item"
      active-class="is-active"
    >
      <span class="tabbar__pill">
        <component :is="tab.icon" :size="22" :stroke-width="2" aria-hidden="true" />
      </span>
      <span class="tabbar__label">{{ tab.label }}</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
/* Pastille flottante, comme le FloatingNav de référence : arrondie, centrée, ombre et bordure. */
.tabbar {
  position: fixed;
  left: 50%;
  bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  z-index: 10;
  transform: translateX(-50%);
  width: min(calc(100% - 24px), 512px);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-surface);
  box-shadow: 0 10px 30px rgba(18, 21, 18, 0.12);
}

.tabbar__item {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  height: 52px;
  padding: 0 8px;
  border-radius: 999px;
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
  transition: color 0.2s ease;
}

/* Libellés masqués sur petit écran, comme dans le composant de référence */
.tabbar__label {
  display: none;
}

@media (min-width: 640px) {
  .tabbar__label {
    display: block;
  }
}

/* Pas de fond boxé sur l'icône : l'indicateur glissant porte la mise en évidence */
.tabbar__pill {
  display: flex;
  align-items: center;
  justify-content: center;
}

.tabbar__item.is-active {
  color: var(--color-lime-dark);
}

.tabbar__indicator {
  display: block;
  position: absolute;
  top: 6px;
  bottom: 6px;
  border-radius: 999px;
  background: var(--color-lime-soft);
  opacity: 0;
  transition:
    left 0.45s cubic-bezier(0.34, 1.4, 0.64, 1),
    width 0.45s cubic-bezier(0.34, 1.4, 0.64, 1),
    opacity 0.2s ease;
}

/* Desktop : menu flottant centré en haut, avec libellés */
@media (min-width: 1024px) {
  .tabbar {
    top: 16px;
    bottom: auto;
    width: max-content;
    padding: 6px;
  }

  .tabbar__item {
    flex: 0 0 auto;
    flex-direction: row;
    gap: 0;
    height: 40px;
    padding: 0 18px;
    font-size: 15px;
    color: var(--color-text);
  }

  .tabbar__item.is-active {
    color: var(--color-lime-dark);
  }

  .tabbar__pill {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tabbar__indicator {
    transition: none;
  }
}
</style>
