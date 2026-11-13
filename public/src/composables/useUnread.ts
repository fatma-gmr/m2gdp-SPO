import { computed, ref } from 'vue'
import { api } from '../services/api'
import { startRealtime, stopRealtime } from '../services/realtime'
import { useAuth } from './useAuth'
import type { Conversation } from '../types/api'

/**
 * Messages non lus : un message est non lu si le dernier message d'une conversation
 * vient de l'autre personne et est plus récent que la dernière ouverture locale de la
 * conversation. Le suivi est local à l'appareil (localStorage) : aucun changement d'API ni de base.
 */

const STORAGE_KEY = 'binofit:lastSeen'
const POLL_MS = 15000

const conversations = ref<Conversation[]>([])
/** Nombre de messages non lus par conversation (id de conversation → nombre). */
const unreadCounts = ref<Record<string, number>>({})
/** Propositions reçues en attente de réponse, pas encore vues dans « Mes activités ». */
const SEEN_ACTIVITIES_KEY = 'binofit:seenActivities'
const pendingIncomingIds = ref<string[]>([])
const seenActivityIds = ref<string[]>(readSeenActivities())
const newActivityCount = ref(0)

function readSeenActivities(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_ACTIVITIES_KEY) ?? '[]')
  } catch {
    return []
  }
}

/** Réponses (acceptée/refusée) à mes propositions : id → statut, et le dernier statut vu par cet appareil. */
const SEEN_STATUS_KEY = 'binofit:seenActivityStatus'
const answeredStatus = ref<Record<string, string>>({})
const seenStatus = ref<Record<string, string>>(readSeenStatus())

function readSeenStatus(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(SEEN_STATUS_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function recountNewActivities() {
  const seen = new Set(seenActivityIds.value)
  const incoming = pendingIncomingIds.value.filter((id) => !seen.has(id)).length
  const answers = Object.entries(answeredStatus.value).filter(([id, status]) => seenStatus.value[id] !== status).length
  newActivityCount.value = incoming + answers
}

/** Marque ces propositions reçues et ces réponses comme vues (à l'ouverture de « Mes activités »). */
function markActivitiesSeen(incomingIds: string[], answers: Record<string, string>) {
  seenActivityIds.value = [...new Set([...seenActivityIds.value, ...incomingIds])]
  localStorage.setItem(SEEN_ACTIVITIES_KEY, JSON.stringify(seenActivityIds.value))
  seenStatus.value = { ...seenStatus.value, ...answers }
  localStorage.setItem(SEEN_STATUS_KEY, JSON.stringify(seenStatus.value))
  answeredStatus.value = { ...answeredStatus.value, ...answers }
  recountNewActivities()
}
const lastSeen = ref<Record<string, string>>(readLastSeen())
let timer: number | undefined
let lastCount = 0

function readLastSeen(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function persistLastSeen() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lastSeen.value))
}

/** Id de la conversation ouverte à l'écran, s'il y en a une. */
function openConversationId(): string | null {
  const match = window.location.pathname.match(/^\/messages\/([^/]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

function isUnread(c: Conversation, uid: string): boolean {
  const last = c.lastMessage
  if (!last || last.senderId === uid) return false
  const seen = lastSeen.value[c.id]
  return !seen || last.sentAt > seen
}

/** Nombre de messages non lus d'une conversation (0 si lue). */
export function unreadCountOf(c: Conversation): number {
  return unreadCounts.value[c.id] ?? 0
}

/** Vrai si la conversation a un message non lu pour l'utilisateur connecté. */
export function isConversationUnread(c: Conversation): boolean {
  const { user } = useAuth()
  const uid = user.value?.uid
  return uid ? isUnread(c, uid) : false
}

/** Marque une conversation comme lue jusqu'à son dernier message. */
function markSeen(conversation: Conversation) {
  const sentAt = conversation.lastMessage?.sentAt
  if (!sentAt) return
  if (lastSeen.value[conversation.id] === sentAt) return
  lastSeen.value = { ...lastSeen.value, [conversation.id]: sentAt }
  persistLastSeen()
}

function notify(count: number) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  if (!document.hidden) return
  new Notification('BINOFIT', {
    body: count === 1 ? 'Tu as reçu un nouveau message.' : `Tu as ${count} nouveaux messages.`,
    icon: '/favicon.png',
  })
}

/** Recharge les conversations et met à jour le compteur ; notifie si de nouveaux messages arrivent. */
async function refresh() {
  const { user } = useAuth()
  const uid = user.value?.uid
  if (!uid) return
  try {
    const list = await api.listConversations()
    conversations.value = list
    const openId = openConversationId()
    const open = list.find((c) => c.id === openId)
    if (open) markSeen(open)
    const unread = list.filter((c) => isUnread(c, uid))
    const counts: Record<string, number> = {}
    await Promise.all(
      unread.map(async (c) => {
        const seen = lastSeen.value[c.id]
        try {
          const messages = await api.listMessages(c.id, { limit: 100 })
          counts[c.id] = messages.filter((m) => m.senderId !== uid && (!seen || m.sentAt > seen)).length
        } catch {
          counts[c.id] = 1
        }
      }),
    )
    unreadCounts.value = counts
    try {
      const activities = await api.listActivities()
      pendingIncomingIds.value = activities
        .filter((a) => a.guestId === uid && a.status === 'en_attente')
        .map((a) => a.id)
      answeredStatus.value = Object.fromEntries(
        activities
          .filter((a) => a.createdBy === uid && (a.status === 'acceptee' || a.status === 'refusee'))
          .map((a) => [a.id, a.status]),
      )
      recountNewActivities()
    } catch {
      // Sans bruit : la prochaine interrogation réessaiera.
    }
    const count = unread.length
    if (count > lastCount) notify(count)
    lastCount = count
  } catch {
    // Pas de bruit en arrière-plan : la prochaine interrogation réessaiera.
  }
}

/** Nombre total de messages non lus, toutes conversations confondues (affiché sur l'onglet Messages). */
const unreadCount = computed(() => {
  const { user } = useAuth()
  const uid = user.value?.uid ?? ''
  if (!uid) return 0
  return conversations.value
    .filter((c) => isUnread(c, uid))
    .reduce((total, c) => total + (unreadCounts.value[c.id] ?? 1), 0)
})

/** Un événement temps réel rafraîchit tout de suite les compteurs (l'interrogation reste en secours). */
function onRealtime() {
  void refresh()
}

/** Démarre le temps réel et l'interrogation de secours (à appeler une fois connecté). */
function startUnreadPolling() {
  if (timer !== undefined) return
  void refresh()
  timer = window.setInterval(refresh, POLL_MS)
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('binofit:realtime', onRealtime)
  startRealtime()
}

function stopUnreadPolling() {
  if (timer !== undefined) window.clearInterval(timer)
  timer = undefined
  document.removeEventListener('visibilitychange', onVisibility)
  window.removeEventListener('binofit:realtime', onRealtime)
  stopRealtime()
  conversations.value = []
  unreadCounts.value = {}
  pendingIncomingIds.value = []
  answeredStatus.value = {}
  newActivityCount.value = 0
  lastCount = 0
}

function onVisibility() {
  if (!document.hidden) void refresh()
}

/** Demande l'autorisation des notifications navigateur, une seule fois, après une action de l'utilisateur. */
function requestNotificationPermission() {
  if (typeof Notification === 'undefined' || Notification.permission !== 'default') return
  void Notification.requestPermission()
}

export function useUnread() {
  return { unreadCount, newActivityCount, markActivitiesSeen, refresh, markSeen, isConversationUnread, unreadCountOf, startUnreadPolling, stopUnreadPolling, requestNotificationPermission }
}
