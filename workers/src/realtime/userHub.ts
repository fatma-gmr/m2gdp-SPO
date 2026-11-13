/**
 * BINOFIT API — Durable Object « UserHub » : une instance par utilisateur (nommée par son uid).
 *
 * Elle garde les connexions WebSocket ouvertes de cet utilisateur (appareils/onglets) et
 * relaie les événements envoyés par l'API (`POST /notify`) à chacune d'elles.
 * Les sockets sont « hibernables » : pas de facturation de CPU pendant l'inactivité.
 */
import { DurableObject } from 'cloudflare:workers'

export class UserHub extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/connect') {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Upgrade WebSocket attendu', { status: 426 })
      }
      const pair = new WebSocketPair()
      const client = pair[0]
      const server = pair[1]
      this.ctx.acceptWebSocket(server)
      return new Response(null, { status: 101, webSocket: client })
    }

    if (url.pathname === '/notify' && request.method === 'POST') {
      const payload = await request.text()
      for (const socket of this.ctx.getWebSockets()) {
        try {
          socket.send(payload)
        } catch {
          // Socket déjà fermée : elle sera retirée à sa fermeture.
        }
      }
      return new Response(null, { status: 204 })
    }

    return new Response('Introuvable', { status: 404 })
  }

  /** Les clients n'envoient rien d'utile : on ignore les messages entrants. */
  webSocketMessage(): void {}

  webSocketClose(socket: WebSocket, code: number, reason: string): void {
    socket.close(code, reason)
  }
}
