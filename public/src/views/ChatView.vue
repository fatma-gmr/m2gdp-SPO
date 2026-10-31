<script setup lang="ts">
import { Input } from '@/components/ui/input'
import { computed, nextTick, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Send } from 'lucide-vue-next'
import { useAuth } from '../composables/useAuth'
import { api, ApiError } from '../services/api'
import { formatTime } from '../services/format'
import { fetchUser } from '../services/users'
import type { Message, User } from '../types/api'

const route = useRoute()
const router = useRouter()
const { user } = useAuth()

const conversationId = computed(() => String(route.params.id))
const uid = computed(() => user.value?.uid ?? '')

const other = ref<User | null>(null)
const messages = ref<Message[]>([])
const draft = ref('')
const loading = ref(true)
const errorMessage = ref('')
const sending = ref(false)
const listEl = ref<HTMLElement | null>(null)

function scrollToEnd() {
  nextTick(() => {
    if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight
  })
}

async function load() {
  try {
    const conversations = await api.listConversations()
    const conversation = conversations.find((c) => c.id === conversationId.value)
    if (!conversation) {
      errorMessage.value = 'Cette conversation est introuvable.'
      return
    }
    const otherId = conversation.participantIds.find((id) => id !== uid.value) ?? ''
    other.value = await fetchUser(otherId)
    const list = await api.listMessages(conversationId.value, { limit: 100 })
    messages.value = [...list].sort((a, b) => a.sentAt.localeCompare(b.sentAt))
    scrollToEnd()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Impossible de charger la conversation.'
  } finally {
    loading.value = false
  }
}

async function send() {
  const text = draft.value.trim()
  if (!text || sending.value) return
  sending.value = true
  errorMessage.value = ''
  try {
    const message = await api.sendMessage({ conversationId: conversationId.value, text })
    messages.value = [...messages.value, message]
    draft.value = ''
    scrollToEnd()
  } catch (error) {
    errorMessage.value = error instanceof ApiError ? error.message : 'Message non envoyé, réessaie.'
  } finally {
    sending.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="chat">
    <header class="chat__head">
      <button type="button" class="icon-btn" aria-label="Retour" @click="router.back()">
        <ArrowLeft :size="18" aria-hidden="true" />
      </button>
      <RouterLink
        v-if="other"
        :to="{ name: 'athlete', params: { id: other.id } }"
        class="chat__title"
      >
        {{ other.firstName }} {{ other.lastName }}
      </RouterLink>
    </header>

    <div v-if="loading" class="chat__state">
      <span class="spinner spinner--muted" aria-hidden="true"></span>
    </div>

    <div v-else-if="errorMessage && messages.length === 0" class="chat__state">
      <div class="alert alert-error">{{ errorMessage }}</div>
    </div>

    <div v-else ref="listEl" class="chat__list">
      <p v-if="messages.length === 0" class="chat__empty">
        Dis bonjour à {{ other?.firstName ?? 'ton partenaire' }} !
      </p>
      <div
        v-for="m in messages"
        :key="m.id"
        class="bubble"
        :class="m.senderId === uid ? 'bubble--me' : 'bubble--them'"
      >
        <p>{{ m.text }}</p>
        <span class="bubble__time">{{ formatTime(m.sentAt) }}</span>
      </div>
    </div>

    <p v-if="errorMessage && messages.length > 0" class="chat__error">{{ errorMessage }}</p>

    <form class="chat__composer" @submit.prevent="send">
      <Input
        v-model="draft"
        type="text"
        maxlength="2000"
        placeholder="Écris un message"
        aria-label="Message" />
      <button type="submit" class="chat__send" :disabled="!draft.trim() || sending" aria-label="Envoyer">
        <Send :size="18" aria-hidden="true" />
      </button>
    </form>
  </div>
</template>

<style scoped>
.chat {
  min-height: 100svh;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
  max-width: 560px;
  width: 100%;
  margin: 0 auto;
}

.chat__head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
  position: sticky;
  top: 0;
  z-index: 5;
}

.chat__title {
  font-weight: 800;
  font-size: 16px;
  color: var(--color-text);
  text-decoration: none;
}

.chat__state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.chat__list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chat__empty {
  text-align: center;
  color: var(--color-text-muted);
  font-size: 14px;
  margin: auto;
}

.bubble {
  max-width: 78%;
  padding: 10px 14px;
  border-radius: 18px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  word-break: break-word;
}

.bubble p {
  font-size: 15px;
  line-height: 1.4;
  white-space: pre-line;
}

.bubble__time {
  font-size: 11px;
  opacity: 0.7;
  align-self: flex-end;
}

.bubble--me {
  align-self: flex-end;
  background: var(--color-lime);
  color: var(--primary-foreground);
  border-bottom-right-radius: 6px;
}

.bubble--them {
  align-self: flex-start;
  background: var(--color-surface-2);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-bottom-left-radius: 6px;
}

.chat__error {
  color: var(--color-danger);
  font-size: 13px;
  padding: 0 16px;
}

.chat__composer {
  display: flex;
  gap: 10px;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
}

.chat__composer input {
  flex: 1;
  border-radius: 999px;
  padding: 12px 16px;
}

.chat__send {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: none;
  background: var(--color-lime);
  color: var(--primary-foreground);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.chat__send:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
