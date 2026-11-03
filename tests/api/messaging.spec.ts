/** Messagerie (conversations + messages) et favoris. */
import { expect, test } from '@playwright/test'
import { call } from '../lib/api'
import { USER_A, USER_B, USER_SANS_PROFIL } from '../lib/testData'

test.describe('Messagerie', () => {
  test.describe.configure({ mode: 'serial' })
  let conversationId = ''

  test('US23 ouvrir une conversation : 201, puis 200 avec la même conversation', async ({ request }) => {
    const created = await call(request, USER_A.uid, 'POST', '/conversations', { participantId: USER_B.uid })
    expect([200, 201]).toContain(created.status())
    const conversation = await created.json()
    expect(conversation.participantIds).toEqual(expect.arrayContaining([USER_A.uid, USER_B.uid]))
    conversationId = conversation.id

    const again = await call(request, USER_A.uid, 'POST', '/conversations', { participantId: USER_B.uid })
    expect(again.status()).toBe(200)
    expect((await again.json()).id).toBe(conversationId)
  })

  test('US23 pas de conversation avec soi-même (400)', async ({ request }) => {
    const response = await call(request, USER_A.uid, 'POST', '/conversations', { participantId: USER_A.uid })
    expect(response.status()).toBe(400)
  })

  test('US23 envoyer des messages : 201', async ({ request }) => {
    for (const [uid, text] of [
      [USER_A.uid, 'Bonjour ! Partante pour un match samedi ?'],
      [USER_B.uid, 'Avec plaisir, 18 h ?'],
      [USER_A.uid, 'Parfait, à samedi.'],
    ]) {
      const response = await call(request, uid, 'POST', '/messages', { conversationId, text })
      expect(response.status(), await response.text()).toBe(201)
      expect(await response.json()).toMatchObject({ conversationId, senderId: uid, text })
    }
  })

  test('US23 message vide refusé (400)', async ({ request }) => {
    const response = await call(request, USER_A.uid, 'POST', '/messages', { conversationId, text: '' })
    expect(response.status()).toBe(400)
  })

  test('US24 les messages reçus sont dans l’ordre chronologique', async ({ request }) => {
    const response = await call(request, USER_B.uid, 'GET', `/conversations/${conversationId}/messages`)
    expect(response.status()).toBe(200)
    const messages: { text: string; sentAt: string }[] = await response.json()
    expect(messages.map((m) => m.text)).toEqual([
      'Bonjour ! Partante pour un match samedi ?',
      'Avec plaisir, 18 h ?',
      'Parfait, à samedi.',
    ])
    const dates = messages.map((m) => m.sentAt)
    expect(dates).toEqual([...dates].sort())
  })

  test('US24 un non-participant ne lit pas les messages (403)', async ({ request }) => {
    const response = await call(request, USER_SANS_PROFIL.uid, 'GET', `/conversations/${conversationId}/messages`)
    expect(response.status()).toBe(403)
  })

  test('US22 la conversation apparaît dans la liste avec le dernier message', async ({ request }) => {
    const response = await call(request, USER_B.uid, 'GET', '/conversations')
    expect(response.status()).toBe(200)
    const conversation = (await response.json()).find((c: { id: string }) => c.id === conversationId)
    expect(conversation.participantIds).toEqual(expect.arrayContaining([USER_A.uid, USER_B.uid]))
    expect(conversation.lastMessage).toMatchObject({ text: 'Parfait, à samedi.', senderId: USER_A.uid })
  })
})

test.describe('Favoris', () => {
  test.describe.configure({ mode: 'serial' })

  test('US25 ajouter un sportif aux favoris : 201, puis 409 en double', async ({ request }) => {
    const created = await call(request, USER_A.uid, 'POST', '/favorites', { targetType: 'user', targetId: USER_B.uid })
    expect(created.status(), await created.text()).toBe(201)
    expect(await created.json()).toMatchObject({ userId: USER_A.uid, targetType: 'user', targetId: USER_B.uid })

    const duplicate = await call(request, USER_A.uid, 'POST', '/favorites', { targetType: 'user', targetId: USER_B.uid })
    expect(duplicate.status()).toBe(409)
  })

  test('US25 pas de favori sur soi-même (400) ni sur une cible inconnue (404)', async ({ request }) => {
    expect((await call(request, USER_A.uid, 'POST', '/favorites', { targetType: 'user', targetId: USER_A.uid })).status()).toBe(400)
    expect(
      (await call(request, USER_A.uid, 'POST', '/favorites', { targetType: 'user', targetId: 'utilisateur-inexistant' })).status(),
    ).toBe(404)
  })

  test('US25 consulter puis retirer un favori (204, puis 404)', async ({ request }) => {
    const list = await call(request, USER_A.uid, 'GET', '/favorites')
    expect(list.status()).toBe(200)
    expect((await list.json()).some((f: { targetId: string }) => f.targetId === USER_B.uid)).toBe(true)

    expect((await call(request, USER_A.uid, 'DELETE', `/favorites/${USER_B.uid}`)).status()).toBe(204)
    expect((await call(request, USER_A.uid, 'DELETE', `/favorites/${USER_B.uid}`)).status()).toBe(404)
    const after = await (await call(request, USER_A.uid, 'GET', '/favorites')).json()
    expect(after.some((f: { targetId: string }) => f.targetId === USER_B.uid)).toBe(false)
  })
})
