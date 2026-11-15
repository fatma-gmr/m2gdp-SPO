<script setup lang="ts">
import { Plus } from 'lucide-vue-next'
import { SPORT_IMAGES } from '../services/sportIcons'
import type { Sport } from '../types/api'

/** Icône d'un sport (images du pack BINOFIT). « Autre » n'a pas d'image : un Plus vert. */
withDefaults(defineProps<{ sport: Sport; size?: number }>(), { size: 38 })
</script>

<template>
  <img
    v-if="SPORT_IMAGES[sport]"
    class="sport-icon"
    :src="SPORT_IMAGES[sport]"
    :width="size"
    :height="size"
    :style="{ width: size + 'px', height: size + 'px' }"
    alt=""
  />
  <Plus v-else class="sport-icon-plus" :size="size" aria-hidden="true" />
</template>

<style scoped>
.sport-icon {
  display: block;
  object-fit: contain;
  border-radius: 0;
}

.sport-icon-plus {
  color: var(--color-lime-dark);
}
</style>
