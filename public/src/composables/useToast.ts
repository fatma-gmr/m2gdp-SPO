import { reactive } from 'vue'

export interface Toast {
  id: number
  message: string
  tone: 'info' | 'success' | 'warning'
}

const toasts = reactive<Toast[]>([])
/** Historique des alertes de la session (le plus récent en premier), pour la cloche. */
export interface NotificationEntry {
  message: string
  at: string
}
const history = reactive<NotificationEntry[]>([])
const HISTORY_MAX = 20
let nextId = 1
const DURATION_MS = 5000

/** Affiche une alerte temporaire en haut de l'écran (fermable) et la garde dans l'historique. */
export function pushToast(message: string, tone: Toast['tone'] = 'info') {
  const id = nextId++
  toasts.push({ id, message, tone })
  history.unshift({ message, at: new Date().toISOString() })
  if (history.length > HISTORY_MAX) history.length = HISTORY_MAX
  window.setTimeout(() => dismissToast(id), DURATION_MS)
}

export function dismissToast(id: number) {
  const index = toasts.findIndex((t) => t.id === id)
  if (index !== -1) toasts.splice(index, 1)
}

export function useToast() {
  return { toasts, history, pushToast, dismissToast }
}
