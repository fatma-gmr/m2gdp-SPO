<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { SquarePen } from 'lucide-vue-next'
import { useAuth } from '../composables/useAuth'
import { api } from '../services/api'
import { formatTime, formatDate } from '../services/format'
import { getUserCached } from '../services/users'
import type { Conversation } from '../types/api'

const { user } = useAuth()

const conversations = ref<Conversation[]>([])
const names = reactive<Record<string, { firstName: string; lastName: string }>>({})
const loading = ref(true)
const errorMessage = ref('')
const tab = ref<'conversations' | 'demandes'>('conversations')

const uid = computed(() => user.value?.uid ?? '')

function otherId(c: Conversation): string {
  return c.participantIds.find((id) => id !== uid.value) ?? ''
}

function otherName(c: Conversation): string {
  const n = names[otherId(c)]
  return n ? `${n.firstName} ${n.lastName}` : '…'
}

function otherInitials(c: Conversation): string {
  const n = names[otherId(c)]
  return n ? `${n.firstName[0] ?? ''}${n.lastName[0] ?? ''}`.toUpperCase() : '?'
}

function previewTime(iso: string): string {
  const d = new Date(iso)
  const sameDay = d.toDateString() === new Date().toDateString()
  return sameDay ? formatTime(iso) : formatDate(iso)
}

onMounted(async () => {
  try {
    const list = await api.listConversations()
    conversations.value = list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    await Promise.all(
      [...new Set(list.map(otherId))].map(async (id) => {
        const profile = await getUserCached(id)
        if (profile) names[id] = { firstName: profile.firstName, lastName: profile.lastName }
      }),
    )
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Impossible de charger les messages.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="screen">
    <div class="screen__inner messages">
      <div class="messages__col">
      <header class="messages__head">
        <h1>Messages</h1>
        <button type="button" class="icon-btn icon-btn--primary" aria-label="Nouveau message">
          <SquarePen :size="18" aria-hidden="true" />
        </button>
      </header>

      <div class="segmented" role="tablist" aria-label="Type de messages">
        <button
          type="button"
          role="tab"
          class="segmented__item"
          :aria-selected="tab === 'conversations'"
          @click="tab = 'conversations'"
        >
          Conversations
        </button>
        <button
          type="button"
          role="tab"
          class="segmented__item"
          :aria-selected="tab === 'demandes'"
          @click="tab = 'demandes'"
        >
          Demandes
        </button>
      </div>

      <div v-if="loading" class="state">
        <span class="spinner spinner--muted" aria-hidden="true"></span>
        <span>Chargement…</span>
      </div>

      <div v-else-if="errorMessage" class="alert alert-error">{{ errorMessage }}</div>

      <template v-else-if="tab === 'demandes'">
        <p class="state">Les demandes de binôme arrivent bientôt.</p>
      </template>

      <template v-else-if="conversations.length === 0">
        <section class="empty">
          <div class="empty__art" aria-hidden="true">
            <span class="empty__bubble">Le sport<br />crée du lien !</span>
          </div>
          <div class="empty__body">
            <h2>Aucune conversation pour l’instant</h2>
            <p>Contacte un sportif depuis son profil pour planifier ta première séance.</p>
            <RouterLink :to="{ name: 'decouvrir' }" class="empty__cta">Trouver un binôme →</RouterLink>
          </div>
        </section>
      </template>

      <ul v-else class="convo-list">
        <li v-for="c in conversations" :key="c.id">
          <RouterLink :to="{ name: 'conversation', params: { id: c.id } }" class="convo">
            <div class="avatar convo__avatar">{{ otherInitials(c) }}</div>
            <div class="convo__body">
              <div class="convo__top">
                <strong>{{ otherName(c) }}</strong>
                <span class="convo__time">{{ previewTime(c.updatedAt) }}</span>
              </div>
              <p class="convo__preview">
                <template v-if="c.lastMessage">
                  {{ c.lastMessage.senderId === uid ? 'Toi : ' : '' }}{{ c.lastMessage.text }}
                </template>
                <template v-else>Pas encore de message</template>
              </p>
            </div>
          </RouterLink>
        </li>
      </ul>
      </div>

      <!-- Panneau de droite (desktop) : invitation à démarrer une conversation -->
      <section class="messages__panel" aria-label="Conversation">
        <div class="messages__panel-body">
          <p class="messages__panel-script">Le sport crée du lien !</p>
          <h2>Lance ta première conversation</h2>
          <p>Choisis un sportif près de chez toi et propose-lui une séance. Tes échanges apparaîtront ici.</p>
          <RouterLink :to="{ name: 'decouvrir' }" class="empty__cta messages__panel-cta">Trouver un binôme →</RouterLink>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.messages {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding-bottom: 24px;
}

.messages__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.messages__head h1 {
  font-size: 28px;
  font-weight: 800;
}

.icon-btn--primary {
  background: var(--color-lime);
  border-color: var(--color-lime);
  color: var(--primary-foreground);
}

.icon-btn--primary:hover {
  color: var(--primary-foreground);
}

.segmented {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  padding: 4px;
  border-radius: var(--radius-md);
  background: var(--color-surface-2);
}

.segmented__item {
  height: 42px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--color-text-muted);
  font: inherit;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}

.segmented__item[aria-selected='true'] {
  background: var(--color-surface);
  color: var(--color-text);
  box-shadow: 0 2px 8px rgba(18, 21, 18, 0.08);
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

.empty {
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  overflow: hidden;
}

.empty__art {
  position: relative;
  height: 170px;
  background: var(--color-lime-soft);
}

.empty__bubble {
  position: absolute;
  top: 16px;
  right: 16px;
  padding: 10px 14px;
  border-radius: 16px;
  background: var(--color-surface);
  box-shadow: 0 8px 20px rgba(18, 21, 18, 0.1);
  color: var(--color-text);
  font-family: var(--font-sans);
  font-weight: 800;
  font-size: 15px;
  line-height: 1.2;
}

.empty__body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 20px;
}

.empty__body h2 {
  font-size: 20px;
  font-weight: 800;
}

.empty__body p {
  color: var(--color-text-muted);
  font-size: 15px;
}

.empty__cta {
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 6px;
  border-radius: var(--radius-md);
  background: var(--color-lime);
  color: var(--primary-foreground);
  font-weight: 700;
  font-size: 15px;
  text-decoration: none;
}

.convo-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.convo {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  text-decoration: none;
  color: var(--color-text);
}

.convo__avatar {
  width: 48px;
  height: 48px;
  font-size: 16px;
  flex-shrink: 0;
  border: none;
}

.convo__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.convo__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.convo__time {
  font-size: 12px;
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.convo__preview {
  font-size: 14px;
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.messages__panel {
  display: none;
}

/* Desktop : liste à gauche, panneau de conversation à droite */
@media (min-width: 1024px) {
  .messages {
    display: grid;
    grid-template-columns: 380px minmax(0, 1fr);
    gap: 20px;
    align-items: stretch;
  }

  .messages__col {
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 22px;
    border-radius: 24px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    min-height: 620px;
  }

  .messages__panel {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px;
    border-radius: 24px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    text-align: center;
  }

  .messages__panel-body {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    max-width: 420px;
  }

  .messages__panel-body h2 {
    font-size: 26px;
    font-weight: 800;
  }

  .messages__panel-body p {
    color: var(--color-text-muted);
  }

  .messages__panel-script {
    font-family: 'Caveat', cursive;
    font-size: 28px;
    font-weight: 700;
    color: var(--color-lime);
  }

  .messages__panel-cta {
    margin-top: 8px;
    padding: 0 28px;
    width: auto;
  }
}
</style>
