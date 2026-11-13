import { auth } from '../firebase'

/**
 * Connexion temps réel à l'API (WebSocket /realtime). Chaque événement reçu est diffusé
 * dans la fenêtre : `window.addEventListener('binofit:realtime', (e) => e.detail)`.
 * Le jeton Firebase est passé dans le sous-protocole, jamais dans l'URL.
 * Reconnexion automatique avec attente croissante (1 s → 30 s).
 */

export interface RealtimeEvent {
  type: 'message' | 'activity'
  conversationId?: string
  senderId?: string
  activityId?: string
  status?: string
  /** Qui a fait l'action, et les deux personnes de la proposition. */
  actorId?: string
  creatorId?: string
  guestId?: string
}

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
const MAX_DELAY_MS = 30_000

let socket: WebSocket | null = null
let retryTimer: number | undefined
let attempts = 0
let running = false

async function connect(): Promise<void> {
  if (!running || socket) return
  const user = auth.currentUser
  if (!user || !BASE_URL) return
  const token = await user.getIdToken()
  if (!running) return

  const ws = new WebSocket(`${BASE_URL.replace(/^http/, 'ws')}/realtime`, ['binofit', token])
  socket = ws
  ws.onopen = () => {
    attempts = 0
  }
  ws.onmessage = (message) => {
    try {
      const event = JSON.parse(String(message.data)) as RealtimeEvent
      window.dispatchEvent(new CustomEvent<RealtimeEvent>('binofit:realtime', { detail: event }))
    } catch {
      // Message mal formé : ignoré.
    }
  }
  ws.onclose = () => {
    socket = null
    if (!running) return
    const delay = Math.min(MAX_DELAY_MS, 1000 * 2 ** attempts)
    attempts += 1
    retryTimer = window.setTimeout(() => void connect(), delay)
  }
}

export function startRealtime(): void {
  if (running) return
  running = true
  void connect()
}

export function stopRealtime(): void {
  running = false
  window.clearTimeout(retryTimer)
  attempts = 0
  socket?.close()
  socket = null
}
