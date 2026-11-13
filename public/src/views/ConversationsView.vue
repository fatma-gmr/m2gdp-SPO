<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { Send } from 'lucide-vue-next'
import { useAuth } from '../composables/useAuth'
import { api } from '../services/api'
import { formatTime, formatDate } from '../services/format'
import { getUserCached } from '../services/users'
import type { Conversation, User } from '../types/api'

const route = useRoute()
const router = useRouter()

/** Messages suggérés pour démarrer la conversation ; le texte reste modifiable. */
const STARTERS = [
  'Salut ! Tu serais partant pour une séance cette semaine ?',
  'Bonjour ! Tu t’entraînes souvent près de chez toi ?',
  'Hello, ça te dit un match ce week-end ?',
  'Salut ! On se fait une séance à deux ?',
]
const MESSAGE_MAX = 2000

/** Sportif avec qui démarrer une conversation (?to=<id>, venant de la carte). */
const recipientId = computed(() => (typeof route.query.to === 'string' ? route.query.to : ''))
const recipient = ref<User | null>(null)
const draft = ref('')
const sending = ref(false)
const sendError = ref('')

watch(
  recipientId,
  async (id) => {
    recipient.value = id ? await getUserCached(id) : null
  },
  { immediate: true },
)

/** Crée la conversation, y dépose le premier message, puis ouvre le chat. */
async function startWithRecipient() {
  const body = draft.value.trim()
  if (!body || !recipientId.value || sending.value) return
  sending.value = true
  sendError.value = ''
  try {
    const conversation = await api.createConversation({ participantId: recipientId.value })
    await api.sendMessage({ conversationId: conversation.id, text: body })
    router.push({ name: 'conversation', params: { id: conversation.id } })
  } catch (error) {
    sendError.value = error instanceof Error ? error.message : 'Impossible d’ouvrir la conversation.'
  } finally {
    sending.value = false
  }
}

const { user } = useAuth()

const conversations = ref<Conversation[]>([])
const names = reactive<Record<string, { firstName: string; lastName: string; avatarUrl: string | null }>>({})
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

function otherAvatar(c: Conversation): string | null {
  return names[otherId(c)]?.avatarUrl ?? null
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
        if (profile) names[id] = { firstName: profile.firstName, lastName: profile.lastName, avatarUrl: profile.avatarUrl ?? null }
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
      </header>

      <section v-if="recipientId" class="start">
        <h2>
          Démarrer la conversation<span v-if="recipient"> avec {{ recipient.firstName }}</span>
        </h2>
        <div class="start__chips">
          <button
            v-for="(msg, i) in STARTERS"
            :key="i"
            type="button"
            class="start__chip"
            @click="draft = msg"
          >
            {{ msg }}
          </button>
        </div>
        <textarea
          v-model="draft"
          class="start__field"
          rows="3"
          :maxlength="MESSAGE_MAX"
          aria-label="Premier message"
          placeholder="Écris ton premier message…"
        ></textarea>
        <p v-if="sendError" class="start__error">{{ sendError }}</p>
        <button
          type="button"
          class="start__send"
          :disabled="sending || !draft.trim()"
          @click="startWithRecipient"
        >
          <Send :size="18" aria-hidden="true" />
          {{ sending ? 'Envoi…' : 'Envoyer et ouvrir la conversation' }}
        </button>
      </section>

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
            <div class="avatar convo__avatar">
              <img v-if="otherAvatar(c)" :src="otherAvatar(c) ?? undefined" alt="" />
              <template v-else>{{ otherInitials(c) }}</template>
            </div>
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

.start {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 18px;
}

.start h2 {
  font-size: 16px;
  font-weight: 800;
}

.start__chips {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.start__chip {
  text-align: left;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
}

.start__chip:hover {
  border-color: var(--color-lime);
  background: var(--color-lime-soft);
}

.start__field {
  width: 100%;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  border: 1.5px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-size: 16px;
  resize: vertical;
}

.start__field:focus {
  outline: none;
  border-color: var(--color-lime);
  box-shadow: 0 0 0 3px var(--color-lime-soft);
}

.start__error {
  color: var(--color-danger, #b42318);
  font-size: 14px;
}

.start__send {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: var(--radius-md);
  border: none;
  background: var(--color-lime-dark);
  color: #fff;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.start__send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
