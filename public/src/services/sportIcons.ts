import type { Component } from 'vue'
import {
  Bike,
  Circle,
  Dumbbell,
  Flower2,
  Hand,
  PersonStanding,
  Plus,
  Trophy,
  Target,
  Waves,
  Zap,
} from 'lucide-vue-next'
import type { Sport } from '../types/api'

/** Icône de chaque sport (grille de sélection du profil, cartes des sportifs). */
export const SPORT_ICONS: Record<Sport, Component> = {
  musculation: Dumbbell,
  course_a_pied: PersonStanding,
  football: Trophy,
  basketball: Circle,
  natation: Waves,
  cyclisme: Bike,
  yoga: Flower2,
  boxe: Hand,
  crossfit: Zap,
  tennis: Target,
  autre: Plus,
}
