/**
 * Envoie un événement temps réel à une liste d'utilisateurs (chacun via sa UserHub).
 * Best effort : un échec d'envoi ne doit jamais faire échouer la requête HTTP d'origine.
 */
import type { Env } from '../env'

export async function notifyUsers(env: Env, uids: string[], event: Record<string, unknown>): Promise<void> {
  const payload = JSON.stringify(event)
  await Promise.all(
    [...new Set(uids)].map(async (uid) => {
      try {
        const stub = env.USER_HUB.get(env.USER_HUB.idFromName(uid))
        await stub.fetch('https://user-hub/notify', { method: 'POST', body: payload })
      } catch {
        // Ignoré : le client rattrape par son interrogation de secours.
      }
    }),
  )
}
