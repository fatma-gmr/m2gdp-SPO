import type { Sport } from '../types/api'

/** Images du pack BINOFIT. « Autre » n'a pas d'image (affiché avec un Plus). */
export const SPORT_IMAGES: Partial<Record<Sport, string>> = {
  musculation: '/assets/sports/musculation.png',
  course_a_pied: '/assets/sports/course_a_pied.png',
  football: '/assets/sports/football.png',
  basketball: '/assets/sports/basketball.png',
  natation: '/assets/sports/natation.png',
  cyclisme: '/assets/sports/cyclisme.png',
  yoga: '/assets/sports/yoga.png',
  boxe: '/assets/sports/boxe.png',
  crossfit: '/assets/sports/crossfit.png',
  tennis: '/assets/sports/tennis.png',
}
