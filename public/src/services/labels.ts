import type { ActivityStatus, DayOfWeek, Level, Sexe, Sport } from '../types/api'

/** Libellés français des sports, indexés par la valeur de l'API. */
export const SPORT_LABELS: Record<Sport, string> = {
  musculation: 'Musculation',
  course_a_pied: 'Course à pied',
  football: 'Football',
  basketball: 'Basketball',
  natation: 'Natation',
  cyclisme: 'Cyclisme',
  yoga: 'Yoga',
  boxe: 'Boxe',
  crossfit: 'CrossFit',
  tennis: 'Tennis',
  autre: 'Autre',
}

/** Libellés français des niveaux, indexés par la valeur de l'API. */
export const LEVEL_LABELS: Record<Level, string> = {
  debutant: 'Débutant',
  intermediaire: 'Intermédiaire',
  avance: 'Avancé',
  expert: 'Expert',
}

/** Jours de la semaine dans l'ordre d'affichage. */
export const DAYS: DayOfWeek[] = [
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
  'dimanche',
]

export const DAY_LABELS: Record<DayOfWeek, string> = {
  lundi: 'Lundi',
  mardi: 'Mardi',
  mercredi: 'Mercredi',
  jeudi: 'Jeudi',
  vendredi: 'Vendredi',
  samedi: 'Samedi',
  dimanche: 'Dimanche',
}

export const ACTIVITY_STATUS_LABELS: Record<ActivityStatus, string> = {
  en_attente: 'En attente',
  acceptee: 'Acceptée',
  refusee: 'Refusée',
  terminee: 'Terminée',
}

/** Libellés français des sexes déclarés. */
export const SEXE_LABELS: Record<Sexe, string> = {
  femme: 'Femme',
  homme: 'Homme',
  autre: 'Autre',
}
