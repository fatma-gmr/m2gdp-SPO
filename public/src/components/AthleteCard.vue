<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowRight, MapPin } from 'lucide-vue-next'
import { LEVEL_LABELS, SPORT_LABELS } from '../services/labels'
import { formatDistance, initials } from '../services/format'
import { SPORT_ICONS } from '../services/sportIcons'
import type { UserSearchResult } from '../types/api'

const props = defineProps<{ profile: UserSearchResult }>()

/** Sport principal : sports[0] (le mapper de l'API le place en premier). */
const primary = computed(() => props.profile.sports[0])
</script>

<template>
  <li class="athlete-card">
    <RouterLink :to="{ name: 'athlete', params: { id: profile.id } }" class="athlete-card__link">
      <div class="athlete-card__avatar">
        <img v-if="profile.avatarUrl" :src="profile.avatarUrl" :alt="profile.firstName" />
        <template v-else>{{ initials(profile.firstName, profile.lastName) }}</template>
        <span
          v-if="primary"
          class="athlete-card__badge"
          role="img"
          :aria-label="`Sport principal : ${SPORT_LABELS[primary.sport]}`"
        >
          <component :is="SPORT_ICONS[primary.sport]" :size="13" aria-hidden="true" />
        </span>
      </div>

      <strong class="athlete-card__name">{{ profile.firstName }}</strong>
      <span v-if="primary" class="athlete-card__sport">
        {{ SPORT_LABELS[primary.sport] }} · {{ LEVEL_LABELS[primary.level] }}
      </span>

      <div class="athlete-card__footer">
        <span class="athlete-card__distance">
          <MapPin :size="14" aria-hidden="true" />
          {{ formatDistance(profile.distanceKm) }}
        </span>
        <span class="athlete-card__arrow" aria-hidden="true">
          <ArrowRight :size="18" />
        </span>
      </div>
    </RouterLink>
  </li>
</template>

<style scoped>
.athlete-card {
  list-style: none;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 14px;
}

.athlete-card__link {
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: inherit;
  text-decoration: none;
  border-radius: var(--radius-md);
}

.athlete-card__link:focus-visible {
  outline: 2px solid var(--color-lime);
  outline-offset: 2px;
}

.athlete-card:has(.athlete-card__link:hover) {
  border-color: var(--color-lime);
}

/* Avatar rond : photo, sinon initiales ; badge du sport principal en bas à droite */
.athlete-card__avatar {
  position: relative;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--color-lime-soft);
  color: var(--color-lime-dark);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 800;
  margin-bottom: 8px;
}

.athlete-card__avatar img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.athlete-card__badge {
  position: absolute;
  right: -4px;
  bottom: -2px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-lime-dark);
  display: flex;
  align-items: center;
  justify-content: center;
}

.athlete-card__name {
  font-size: 15px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.athlete-card__sport {
  font-size: 13px;
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.athlete-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
}

.athlete-card__distance {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--color-lime-dark);
  font-size: 13px;
  font-weight: 700;
}

.athlete-card__arrow {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--color-lime-soft);
  color: var(--color-lime-dark);
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
