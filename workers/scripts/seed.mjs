#!/usr/bin/env node
/**
 * BINOFIT — Script de seed Supabase (Postgres, schéma /specs/schema.sql).
 *
 * Remplit des données fictives réalistes autour de Lyon : 35 users (avec user_sports
 * et user_availability), 90 activities, 12 conversations (2 participants chacune,
 * 5 à 10 messages) et 20 favorites. Les valeurs d'énumération suivent exactement
 * /specs/data-model.md (voir les constantes SPORTS/LEVELS/DAYS_OF_WEEK/ACTIVITY_STATUSES
 * ci-dessous, dupliquées depuis workers/src/types.ts — à garder synchronisées si le
 * modèle évolue, un script .mjs ne pouvant pas importer directement du TypeScript).
 *
 * Une activity est une proposition ponctuelle d'un utilisateur (createdBy) à un autre
 * (guestId) — jamais une annonce ouverte : pas de quota, pas de liste de participants.
 * guestId est toujours différent de createdBy, et la date startAt est cohérente avec
 * le statut (passée pour terminee, future pour en_attente/acceptee, mélange pour refusee).
 *
 * Relançable : toutes les lignes ont un id fixe (ex. "user-001", "activity-037",
 * "conversation-04", "conversation-04-message-03") ou une clé naturelle (user_sports,
 * participants) et sont écrites par upsert, dans l'ordre des clés étrangères. Seule
 * user_availability (id d'identité généré par Postgres) est supprimée puis réinsérée
 * pour les users du seed. Relancer le script ne crée donc jamais de doublons.
 *
 * Identifiants : SUPABASE_URL et SUPABASE_SECRET_KEY lus depuis l'environnement,
 * jamais codés en dur dans ce fichier.
 *
 * Usage (depuis workers/, la clé est lue dans .dev.vars sans être affichée) :
 *   SUPABASE_URL=https://<ref>.supabase.co node --env-file=.dev.vars scripts/seed.mjs
 */
// Client PostgREST seul (celui qu'embarque supabase-js) : pas de client Realtime, donc
// pas besoin de WebSocket natif (absent avant Node 22).
import { PostgrestClient } from '@supabase/postgrest-js'

// --- Configuration -----------------------------------------------------------

const SEED = 20261006 // graine fixe : rend la génération pseudo-aléatoire reproductible

const USERS_COUNT = 35
const ACTIVITIES_COUNT = 90
const CONVERSATIONS_COUNT = 12
const FAVORITES_COUNT = 20

// --- Enumérations (dupliquées depuis workers/src/types.ts / specs/data-model.md) --

const SPORTS = [
  'musculation',
  'course_a_pied',
  'football',
  'basketball',
  'natation',
  'cyclisme',
  'yoga',
  'boxe',
  'crossfit',
  'tennis',
  'autre',
]

const SPORT_LABELS = {
  musculation: 'musculation',
  course_a_pied: 'course à pied',
  football: 'football',
  basketball: 'basketball',
  natation: 'natation',
  cyclisme: 'cyclisme',
  yoga: 'yoga',
  boxe: 'boxe',
  crossfit: 'crossfit',
  tennis: 'tennis',
  autre: 'sport',
}

const LEVELS = ['debutant', 'intermediaire', 'avance', 'expert']

const DAYS_OF_WEEK = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']

const ACTIVITY_STATUSES_WEIGHTED = [
  ['en_attente', 3],
  ['acceptee', 3],
  ['refusee', 2],
  ['terminee', 4],
]

const TIME_SLOTS = [
  ['07:00', '08:30'],
  ['09:00', '11:00'],
  ['12:00', '13:30'],
  ['18:00', '20:00'],
  ['19:00', '21:00'],
  ['20:00', '22:00'],
]

// --- Géographie : Lyon et communes limitrophes --------------------------------

const CITIES = [
  { city: 'Lyon', lat: 45.764, lng: 4.8357 },
  { city: 'Villeurbanne', lat: 45.7667, lng: 4.8884 },
  { city: 'Bron', lat: 45.7289, lng: 4.9106 },
  { city: 'Vénissieux', lat: 45.6978, lng: 4.8869 },
  { city: 'Caluire-et-Cuire', lat: 45.8075, lng: 4.8494 },
]

const FIRST_NAMES = [
  'Lucas', 'Emma', 'Hugo', 'Léa', 'Louis', 'Chloé', 'Jules', 'Manon', 'Nathan', 'Camille',
  'Enzo', 'Sarah', 'Tom', 'Inès', 'Mattéo', 'Jade', 'Noah', 'Lina', 'Gabriel', 'Zoé',
  'Adam', 'Louise', 'Raphaël', 'Alice', 'Liam', 'Juliette', 'Ethan', 'Margot', 'Arthur', 'Anna',
  'Sacha', 'Rose', 'Nolan', 'Eva', 'Maël',
]

const LAST_NAMES = [
  'Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand', 'Leroy', 'Moreau',
  'Simon', 'Laurent', 'Lefebvre', 'Michel', 'Garcia', 'David', 'Bertrand', 'Roux', 'Vincent', 'Fournier',
  'Morel', 'Girard', 'André', 'Lefèvre', 'Mercier', 'Dupont', 'Lambert', 'Bonnet', 'François', 'Martinez',
  'Legrand', 'Garnier', 'Faure', 'Rousseau', 'Blanc',
]

const BIO_TEMPLATES = [
  (sportLabel, city) => `Passionné(e) de ${sportLabel}, je cherche des partenaires motivés sur ${city}.`,
  (sportLabel, city) => `Niveau sérieux recherché pour progresser ensemble en ${sportLabel} à ${city}.`,
  (sportLabel) => `Dispo plusieurs soirs par semaine pour une bonne session de ${sportLabel}.`,
  (sportLabel, city) => `${sportLabel}, bonne humeur et régularité : basé(e) à ${city}.`,
  (sportLabel) => `Toujours motivé(e) pour une séance de ${sportLabel}, n'hésitez pas à me contacter !`,
]

const VENUE_TEMPLATES = [
  (sportLabel, city) => `Gymnase municipal de ${city}`,
  (sportLabel, city) => `Stade de ${city}`,
  (sportLabel, city) => `Parc de ${city}`,
  (sportLabel, city) => `Salle de sport de ${city}`,
  (sportLabel, city) => `Terrain de ${sportLabel} - ${city}`,
]

const INVITATION_TEMPLATES = [
  (sportLabel) => `Salut ! Ça te dit une session de ${sportLabel} ?`,
  (sportLabel) => `Je cherche un partenaire pour du ${sportLabel}, intéressé(e) ?`,
  (sportLabel) => `On se motive pour une séance de ${sportLabel} ensemble ?`,
  (sportLabel) => `Dispo pour une session ${sportLabel}, ça te branche ?`,
]

const CHAT_TEMPLATES = [
  (sportLabel) => `Salut ! Toujours motivé pour la session de ${sportLabel} ?`,
  () => `Oui carrément, on se retrouve à quelle heure ?`,
  () => `Je proposais plutôt en fin d'après-midi, ça te va ?`,
  () => `Parfait pour moi, je prends mes affaires.`,
  (sportLabel) => `Tu as déjà pratiqué le ${sportLabel} en club ?`,
  () => `Un peu, mais je suis plutôt niveau débutant/intermédiaire.`,
  () => `Pas de souci, on adaptera le rythme.`,
  () => `On se dit à tout à l'heure alors !`,
  () => `À plus tard, hâte d'y être 💪`,
  () => `N'oublie pas ta gourde, il va faire chaud.`,
]

// --- Générateur pseudo-aléatoire déterministe (mulberry32) --------------------

function mulberry32(seed) {
  let state = seed | 0
  return function rng() {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick(rng, array) {
  return array[Math.floor(rng() * array.length)]
}

function pickMany(rng, array, count) {
  const pool = [...array]
  const result = []
  const n = Math.min(count, pool.length)
  for (let i = 0; i < n; i++) {
    const index = Math.floor(rng() * pool.length)
    result.push(pool.splice(index, 1)[0])
  }
  return result
}

function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1))
}

function weightedPick(rng, weighted) {
  const total = weighted.reduce((sum, [, weight]) => sum + weight, 0)
  let threshold = rng() * total
  for (const [value, weight] of weighted) {
    if (threshold < weight) return value
    threshold -= weight
  }
  return weighted[weighted.length - 1][0]
}

function round(value, decimals) {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function isoOffsetDays(date, days) {
  return new Date(date.getTime() + days * 86_400_000).toISOString()
}

function isoOffsetHours(date, hours) {
  return new Date(date.getTime() + hours * 3_600_000).toISOString()
}

/** Empêche une date calculée de tomber dans le futur par rapport à `now` (ex: createdAt). */
function clampToPast(date, now) {
  return date.getTime() > now.getTime() ? now : date
}

function normalizeForEmail(value) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '')
}

function jitterLocation(rng, city) {
  const jitter = () => (rng() - 0.5) * 0.04 // ± ~2 km autour du centre de la commune
  return {
    lat: round(city.lat + jitter(), 5),
    lng: round(city.lng + jitter(), 5),
    city: city.city,
  }
}

function chunk(array, size) {
  const chunks = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

// --- Génération des entités ----------------------------------------------------

function generateAvailability(rng) {
  const days = pickMany(rng, DAYS_OF_WEEK, randInt(rng, 1, 4))
  return days.map((dayOfWeek) => {
    const [startTime, endTime] = pick(rng, TIME_SLOTS)
    return { dayOfWeek, startTime, endTime }
  })
}

function generateUsers(rng, now) {
  const users = []
  for (let i = 0; i < USERS_COUNT; i++) {
    const firstName = FIRST_NAMES[i]
    const lastName = LAST_NAMES[i]
    const id = `user-${String(i + 1).padStart(3, '0')}`
    const email = `${normalizeForEmail(firstName)}.${normalizeForEmail(lastName)}@example.com`
    const city = pick(rng, CITIES)
    const location = jitterLocation(rng, city)
    const sports = pickMany(rng, SPORTS, randInt(rng, 1, 3)).map((sport) => ({
      sport,
      level: pick(rng, LEVELS),
    }))
    const availability = generateAvailability(rng)
    const bio = pick(rng, BIO_TEMPLATES)(SPORT_LABELS[sports[0].sport], city.city)
    const createdAt = isoOffsetDays(now, -randInt(rng, 30, 400))

    users.push({
      id,
      email,
      firstName,
      lastName,
      avatarUrl: null,
      bio,
      location,
      sports,
      availability,
      createdAt,
      updatedAt: createdAt,
    })
  }
  return users
}

/**
 * Choisit startAt en cohérence avec le statut : passé pour une proposition déjà
 * terminée, futur pour une proposition en attente ou acceptée (la session n'a pas
 * encore eu lieu), et un mélange des deux pour une proposition refusée (le refus
 * peut intervenir avant ou après la date initialement proposée).
 */
function pickStartAt(rng, now, status) {
  if (status === 'terminee') {
    return isoOffsetDays(now, -randInt(rng, 1, 60))
  }
  if (status === 'en_attente' || status === 'acceptee') {
    return isoOffsetDays(now, randInt(rng, 1, 45))
  }
  // refusee : mélange passé / futur
  return rng() < 0.5 ? isoOffsetDays(now, -randInt(rng, 1, 60)) : isoOffsetDays(now, randInt(rng, 1, 45))
}

function generateMedia(rng) {
  if (rng() < 0.2) {
    return {
      url: `https://picsum.photos/seed/binofit-${Math.floor(rng() * 100_000)}/640/480`,
      type: 'image',
    }
  }
  return null
}

function generateActivities(rng, users, now) {
  const activities = []
  for (let i = 0; i < ACTIVITIES_COUNT; i++) {
    const id = `activity-${String(i + 1).padStart(3, '0')}`
    const creator = users[i % users.length]
    const guestPool = users.filter((user) => user.id !== creator.id)
    const guest = pick(rng, guestPool)
    const sport = pick(rng, creator.sports).sport
    const sportLabel = SPORT_LABELS[sport]
    const status = weightedPick(rng, ACTIVITY_STATUSES_WEIGHTED)

    const startAt = pickStartAt(rng, now, status)
    const createdAt = clampToPast(new Date(isoOffsetDays(new Date(startAt), -randInt(rng, 1, 10))), now).toISOString()

    const city = CITIES.find((c) => c.city === creator.location.city) ?? CITIES[0]
    const { lat, lng } = jitterLocation(rng, city)
    const lieu = {
      nom: pick(rng, VENUE_TEMPLATES)(sportLabel, city.city),
      lat,
      lng,
    }

    activities.push({
      id,
      createdBy: creator.id,
      guestId: guest.id,
      sport,
      startAt,
      lieu,
      message: pick(rng, INVITATION_TEMPLATES)(sportLabel),
      status,
      createdAt,
      media: generateMedia(rng),
    })
  }
  return activities
}

function generateConversations(rng, users, activities, now) {
  const conversations = []
  const messagesByConversation = {}

  for (let i = 0; i < CONVERSATIONS_COUNT; i++) {
    const id = `conversation-${String(i + 1).padStart(2, '0')}`

    // Les 6 premières conversations découlent d'une activité existante (entre son
    // créateur et son invité), les autres sont des échanges directs sans activité liée.
    const linkedActivity = i < 6 ? activities[i * 15] : null
    const [userA, userB] = linkedActivity
      ? [
          users.find((user) => user.id === linkedActivity.createdBy),
          users.find((user) => user.id === linkedActivity.guestId),
        ]
      : pickMany(rng, users, 2)

    const sportLabel = SPORT_LABELS[linkedActivity?.sport ?? pick(rng, userA.sports).sport]
    const messageCount = randInt(rng, 5, 10)
    const conversationStart = isoOffsetDays(now, -randInt(rng, 1, 20))

    const messages = []
    let cursor = new Date(conversationStart)
    for (let m = 0; m < messageCount; m++) {
      const sender = m % 2 === 0 ? userA : userB
      const template = CHAT_TEMPLATES[m % CHAT_TEMPLATES.length]
      cursor = new Date(cursor.getTime() + randInt(rng, 5, 240) * 60_000)

      messages.push({
        id: `${id}-message-${String(m + 1).padStart(2, '0')}`,
        conversationId: id,
        senderId: sender.id,
        text: template(sportLabel),
        sentAt: cursor.toISOString(),
      })
    }

    messagesByConversation[id] = messages

    // conversationId de l'activité et lastMessage ne sont pas stockés : l'API les déduit
    // de conversations.activity_id et de la table messages.
    conversations.push({
      id,
      participantIds: [userA.id, userB.id],
      activityId: linkedActivity?.id ?? null,
      createdAt: messages[0].sentAt,
      updatedAt: messages[messages.length - 1].sentAt,
    })
  }

  return { conversations, messagesByConversation }
}

function generateFavorites(rng, users, activities, now) {
  const favorites = []
  const seen = new Set()
  let attempts = 0

  while (favorites.length < FAVORITES_COUNT && attempts < 1000) {
    attempts++
    const user = pick(rng, users)
    const targetType = rng() < 0.5 ? 'user' : 'activity'
    const target =
      targetType === 'user'
        ? pick(rng, users.filter((candidate) => candidate.id !== user.id))
        : pick(rng, activities)

    const key = `${user.id}:${targetType}:${target.id}`
    if (seen.has(key)) continue
    seen.add(key)

    favorites.push({
      id: `favorite-${String(favorites.length + 1).padStart(3, '0')}`,
      userId: user.id,
      targetType,
      targetId: target.id,
      createdAt: isoOffsetDays(now, -randInt(rng, 0, 90)),
    })
  }

  return favorites
}

// --- Conversion domaine (camelCase) → lignes Postgres (snake_case) -----------

function userToRows(user) {
  return {
    user: {
      id: user.id,
      email: user.email,
      first_name: user.firstName,
      last_name: user.lastName,
      bio: user.bio,
      avatar_url: user.avatarUrl,
      city: user.location.city,
      lat: user.location.lat,
      lng: user.location.lng,
      created_at: user.createdAt,
      updated_at: user.updatedAt,
    },
    sports: user.sports.map(({ sport, level }) => ({ user_id: user.id, sport, level })),
    availability: user.availability.map(({ dayOfWeek, startTime, endTime }) => ({
      user_id: user.id,
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
    })),
  }
}

function activityToRow(activity) {
  return {
    id: activity.id,
    created_by: activity.createdBy,
    guest_id: activity.guestId,
    sport: activity.sport,
    start_at: activity.startAt,
    lieu_nom: activity.lieu.nom,
    lieu_lat: activity.lieu.lat,
    lieu_lng: activity.lieu.lng,
    message: activity.message,
    status: activity.status,
    media_url: activity.media?.url ?? null,
    media_type: activity.media?.type ?? null,
    created_at: activity.createdAt,
  }
}

function conversationToRows(conversation) {
  return {
    conversation: {
      id: conversation.id,
      activity_id: conversation.activityId,
      created_at: conversation.createdAt,
      updated_at: conversation.updatedAt,
    },
    participants: conversation.participantIds.map((userId) => ({
      conversation_id: conversation.id,
      user_id: userId,
    })),
  }
}

function messageToRow(message) {
  return {
    id: message.id,
    conversation_id: message.conversationId,
    sender_id: message.senderId,
    text: message.text,
    sent_at: message.sentAt,
  }
}

function favoriteToRow(favorite) {
  return {
    id: favorite.id,
    user_id: favorite.userId,
    target_type: favorite.targetType,
    target_id: favorite.targetId,
    created_at: favorite.createdAt,
  }
}

// --- Écriture Supabase -----------------------------------------------------------

function failOn(error, table) {
  if (error) {
    throw new Error(`${table}: ${error.code ?? ''} ${error.message}${error.details ? ` (${error.details})` : ''}`)
  }
}

async function upsertRows(supabase, table, rows, onConflict) {
  for (const batch of chunk(rows, 500)) {
    const { error } = await supabase.from(table).upsert(batch, { onConflict })
    failOn(error, table)
  }
  console.log(`  ✓ ${table}: ${rows.length} ligne(s) écrites`)
}

/** user_availability n'a pas d'id fixe (identité générée) : on remplace les créneaux des users du seed. */
async function replaceAvailability(supabase, userIds, rows) {
  const { error } = await supabase.from('user_availability').delete().in('user_id', userIds)
  failOn(error, 'user_availability')
  for (const batch of chunk(rows, 500)) {
    const { error: insertError } = await supabase.from('user_availability').insert(batch)
    failOn(insertError, 'user_availability')
  }
  console.log(`  ✓ user_availability: ${rows.length} ligne(s) écrites`)
}

// --- Point d'entrée --------------------------------------------------------

async function main() {
  const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    console.error('SUPABASE_URL et SUPABASE_SECRET_KEY doivent être définies dans l\'environnement.')
    process.exit(1)
  }

  const supabase = new PostgrestClient(`${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1`, {
    headers: { apikey: SUPABASE_SECRET_KEY },
  })

  const now = new Date()
  const rng = mulberry32(SEED)

  const users = generateUsers(rng, now)
  const activities = generateActivities(rng, users, now)
  const { conversations, messagesByConversation } = generateConversations(rng, users, activities, now)
  const favorites = generateFavorites(rng, users, activities, now)

  const userRows = users.map(userToRows)
  const conversationRows = conversations.map(conversationToRows)
  const messages = Object.values(messagesByConversation).flat()

  console.log(`Seed BINOFIT → ${SUPABASE_URL}`)
  console.log(
    `  users: ${users.length}, activities: ${activities.length}, conversations: ${conversations.length}, messages: ${messages.length}, favorites: ${favorites.length}`,
  )
  console.log('Écriture en cours...')

  // Ordre imposé par les clés étrangères : users → (user_sports, user_availability,
  // activities) → conversations → (participants, messages) ; favorites en dernier.
  await upsertRows(supabase, 'users', userRows.map((rows) => rows.user), 'id')
  await upsertRows(supabase, 'user_sports', userRows.flatMap((rows) => rows.sports), 'user_id,sport')
  await replaceAvailability(
    supabase,
    users.map((user) => user.id),
    userRows.flatMap((rows) => rows.availability),
  )
  await upsertRows(supabase, 'activities', activities.map(activityToRow), 'id')
  await upsertRows(supabase, 'conversations', conversationRows.map((rows) => rows.conversation), 'id')
  await upsertRows(supabase, 'participants', conversationRows.flatMap((rows) => rows.participants), 'conversation_id,user_id')
  await upsertRows(supabase, 'messages', messages.map(messageToRow), 'id')
  await upsertRows(supabase, 'favorites', favorites.map(favoriteToRow), 'id')

  console.log('Seed terminé avec succès.')
}

main().catch((error) => {
  console.error('Échec du seed:', error.message ?? error)
  process.exit(1)
})
