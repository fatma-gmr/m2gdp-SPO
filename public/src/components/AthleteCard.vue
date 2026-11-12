<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { RouterLink } from 'vue-router'
import { LEVEL_LABELS, SPORT_LABELS } from '../services/labels'
import { formatDistance } from '../services/format'
import { SPORT_ICONS } from '../services/sportIcons'
import type { UserSearchResult } from '../types/api'

const props = defineProps<{ profile: UserSearchResult }>()

/** Sport principal : sports[0] (le mapper de l'API le place en premier). */
const primary = computed(() => props.profile.sports[0])
/** Sports secondaires affichés en pastilles ; au-delà, un compteur « +N ». */
const MAX_SECONDARY_ICONS = 2
const secondary = computed(() => props.profile.sports.slice(1, 1 + MAX_SECONDARY_ICONS))
const hiddenCount = computed(() => Math.max(0, props.profile.sports.length - 1 - MAX_SECONDARY_ICONS))
</script>

<template>
  <li class="athlete-card">
    <div class="athlete-card__top">
      <div
        v-if="primary"
        class="athlete-card__sport"
        role="img"
        :aria-label="`Sport principal : ${SPORT_LABELS[primary.sport]}`"
      >
        <component :is="SPORT_ICONS[primary.sport]" :size="26" :stroke-width="2" aria-hidden="true" />
      </div>
      <div class="athlete-card__who">
        <h2>{{ profile.firstName }}</h2>
        <div class="athlete-card__sports">
          <span v-if="primary" class="pill">
            {{ SPORT_LABELS[primary.sport] }} · {{ LEVEL_LABELS[primary.level] }}
          </span>
          <span
            v-for="practice in secondary"
            :key="practice.sport"
            class="athlete-card__mini"
            role="img"
            :aria-label="`${SPORT_LABELS[practice.sport]}, ${LEVEL_LABELS[practice.level]}`"
            :title="SPORT_LABELS[practice.sport]"
          >
            <component :is="SPORT_ICONS[practice.sport]" :size="14" :stroke-width="2" aria-hidden="true" />
          </span>
          <span v-if="hiddenCount > 0" class="athlete-card__more">+{{ hiddenCount }}</span>
        </div>
      </div>
      <div class="athlete-card__distance">
        <strong>{{ formatDistance(profile.distanceKm) }}</strong>
      </div>
    </div>
    <Button as-child variant="outline"><RouterLink :to="{ name: 'athlete', params: { id: profile.id } }">
      Voir le profil
    </RouterLink></Button>
  </li>
</template>

<style scoped>
.athlete-card {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 14px;
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 16px;
}

.athlete-card__top {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* Sport principal : remplace la photo sur la carte (la photo reste sur la page détail) */
.athlete-card__sport {
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  border-radius: 16px;
  background: var(--color-lime-soft);
  color: var(--color-lime-dark);
  display: flex;
  align-items: center;
  justify-content: center;
}

.athlete-card__who {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  flex: 1;
}

.athlete-card__who h2 {
  font-size: 17px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.athlete-card__sports {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.athlete-card__sports .pill {
  font-size: 12px;
  padding: 4px 10px;
}

/* Sports secondaires : petites pastilles d'icône */
.athlete-card__mini {
  width: 24px;
  height: 24px;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.athlete-card__more {
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 600;
}

.athlete-card__distance {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  flex-shrink: 0;
}

.athlete-card__distance strong {
  color: var(--color-lime);
  font-size: 20px;
  font-weight: 800;
  white-space: nowrap;
}

.athlete-card > a {
  text-decoration: none;
}
</style>
