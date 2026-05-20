import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'RestaurantOS — Commander',
    short_name: 'Restaurant',
    description: 'Commandez en ligne ou sur place',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#f97316',
    orientation: 'portrait',
    categories: ['food', 'lifestyle'],
    icons: [
      {
        src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%23f97316"/><text x="50" y="68" font-size="60" text-anchor="middle">🍽️</text></svg>',
        sizes: '192x192',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%23f97316"/><text x="50" y="68" font-size="60" text-anchor="middle">🍽️</text></svg>',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Commander',
        url: '/menu',
        description: 'Voir le menu et commander',
      },
      {
        name: 'Mon compte',
        url: '/account',
        description: 'Mes informations et commandes',
      },
    ],
  }
}
