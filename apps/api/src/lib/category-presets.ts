/**
 * Catalogue de catégories préréglées par type d'établissement.
 * L'admin peut les importer en masse via POST /api/categories/import-presets.
 * Slug-clé unique par restaurant : un import 2x ne crée pas de doublon.
 */

export type CategoryPreset = {
  name: string
  slug: string
  icon: string
  color: string
}

export type PresetGroup = {
  key: string
  label: string
  description: string
  categories: CategoryPreset[]
}

export const CATEGORY_PRESETS: PresetGroup[] = [
  {
    key: 'bar',
    label: 'Bar',
    description: 'Boissons, cocktails, vins, bières, spiritueux',
    categories: [
      { name: 'Bières pression', slug: 'bieres-pression', icon: '🍺', color: '#F59E0B' },
      { name: 'Bières bouteille', slug: 'bieres-bouteille', icon: '🍻', color: '#D97706' },
      { name: 'Vins rouges', slug: 'vins-rouges', icon: '🍷', color: '#7C2D12' },
      { name: 'Vins blancs', slug: 'vins-blancs', icon: '🥂', color: '#FCD34D' },
      { name: 'Vins rosés', slug: 'vins-roses', icon: '🍾', color: '#FB7185' },
      { name: 'Cocktails classiques', slug: 'cocktails-classiques', icon: '🍸', color: '#EC4899' },
      { name: 'Cocktails signature', slug: 'cocktails-signature', icon: '🍹', color: '#A855F7' },
      { name: 'Mocktails', slug: 'mocktails', icon: '🧃', color: '#10B981' },
      { name: 'Whiskies', slug: 'whiskies', icon: '🥃', color: '#92400E' },
      { name: 'Rhums', slug: 'rhums', icon: '🏴‍☠️', color: '#451A03' },
      { name: 'Spiritueux', slug: 'spiritueux', icon: '🍶', color: '#854D0E' },
      { name: 'Apéritifs', slug: 'aperitifs', icon: '🥂', color: '#F97316' },
      { name: 'Digestifs', slug: 'digestifs', icon: '🥃', color: '#78350F' },
      { name: 'Sodas & Softs', slug: 'sodas-softs', icon: '🥤', color: '#3B82F6' },
      { name: 'Jus de fruits', slug: 'jus-fruits', icon: '🍊', color: '#EAB308' },
      { name: 'Eaux', slug: 'eaux', icon: '💧', color: '#0EA5E9' },
      { name: 'Cafés & Thés', slug: 'cafes-thes', icon: '☕', color: '#78716C' },
      { name: 'Shots', slug: 'shots', icon: '🥃', color: '#DC2626' },
    ],
  },
  {
    key: 'restaurant',
    label: 'Restaurant',
    description: 'Entrées, plats, desserts internationaux',
    categories: [
      { name: 'Entrées', slug: 'entrees', icon: '🥗', color: '#10B981' },
      { name: 'Salades', slug: 'salades', icon: '🥬', color: '#22C55E' },
      { name: 'Soupes', slug: 'soupes', icon: '🍜', color: '#F97316' },
      { name: 'Plats du jour', slug: 'plats-du-jour', icon: '⭐', color: '#EAB308' },
      { name: 'Viandes', slug: 'viandes', icon: '🥩', color: '#991B1B' },
      { name: 'Volailles', slug: 'volailles', icon: '🍗', color: '#F59E0B' },
      { name: 'Poissons & Fruits de mer', slug: 'poissons', icon: '🐟', color: '#0EA5E9' },
      { name: 'Brochettes & Grillades', slug: 'brochettes-grillades', icon: '🍢', color: '#B91C1C' },
      { name: 'Pizzas', slug: 'pizzas', icon: '🍕', color: '#EF4444' },
      { name: 'Pâtes', slug: 'pates', icon: '🍝', color: '#FFB800' },
      { name: 'Burgers', slug: 'burgers', icon: '🍔', color: '#F59E0B' },
      { name: 'Sandwichs', slug: 'sandwichs', icon: '🥪', color: '#8B5CF6' },
      { name: 'Plats végétariens', slug: 'vegetariens', icon: '🥬', color: '#16A34A' },
      { name: 'Accompagnements', slug: 'accompagnements', icon: '🍟', color: '#CA8A04' },
      { name: 'Sauces', slug: 'sauces', icon: '🥫', color: '#9F1239' },
      { name: 'Petit-déjeuner', slug: 'petit-dejeuner', icon: '☕', color: '#78716C' },
      { name: 'Menu enfant', slug: 'menu-enfant', icon: '🧒', color: '#F472B6' },
      { name: 'Formules midi', slug: 'formules-midi', icon: '🍽️', color: '#0891B2' },
      { name: 'Desserts', slug: 'desserts', icon: '🍰', color: '#A78BFA' },
      { name: 'Glaces & Sorbets', slug: 'glaces-sorbets', icon: '🍨', color: '#F0ABFC' },
      { name: 'Crêpes & Gaufres', slug: 'crepes-gaufres', icon: '🥞', color: '#FB923C' },
    ],
  },
  {
    key: 'malagache',
    label: 'Spécialités malgaches',
    description: 'Plats traditionnels et boissons locales',
    categories: [
      { name: 'Plats malgaches', slug: 'plats-malgaches', icon: '🍲', color: '#DC2626' },
      { name: 'Romazava & Ravitoto', slug: 'romazava-ravitoto', icon: '🍛', color: '#7F1D1D' },
      { name: 'Akoho gasy', slug: 'akoho-gasy', icon: '🍗', color: '#B45309' },
      { name: 'Henakisoa', slug: 'henakisoa', icon: '🥓', color: '#9A3412' },
      { name: 'Trondro', slug: 'trondro', icon: '🐟', color: '#1E40AF' },
      { name: 'Vary amin\'anana', slug: 'vary-amin-anana', icon: '🍚', color: '#15803D' },
      { name: 'Mofo gasy', slug: 'mofo-gasy', icon: '🥯', color: '#92400E' },
      { name: 'Koba & Sambos', slug: 'koba-sambos', icon: '🥟', color: '#A16207' },
      { name: 'Achards & Pickles', slug: 'achards', icon: '🌶️', color: '#DC2626' },
      { name: 'Desserts malgaches', slug: 'desserts-malgaches', icon: '🍮', color: '#A21CAF' },
      { name: 'THB & Bières locales', slug: 'thb-bieres', icon: '🍺', color: '#CA8A04' },
      { name: 'Ranovola & Boissons traditionnelles', slug: 'ranovola', icon: '🍵', color: '#65A30D' },
    ],
  },
]
