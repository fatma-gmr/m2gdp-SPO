import { reactive } from 'vue'
import { DEFAULT_FILTERS, type SearchFilters } from '../services/searchFilters'

/**
 * État unique des filtres : partagé entre Recherche, Découvrir et la Carte
 * (module au niveau de l'application, donc conservé quand on change de page).
 */
const filters = reactive<SearchFilters>({ ...DEFAULT_FILTERS })

export function useSearchFilters() {
  function resetFilters() {
    Object.assign(filters, DEFAULT_FILTERS)
  }
  return { filters, resetFilters }
}
