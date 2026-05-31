import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';

export const viewport: Viewport = {
  themeColor: '#f97316',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export const metadata: Metadata = {
  title: 'Le Bistrot Moderne - Commandez en ligne',
  description: 'Commandez vos plats préférés en ligne ou sur place',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Restaurant',
  },
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text x="50" y="70" font-size="80" text-anchor="middle">🍽️</text></svg>',
    apple: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%23f97316"/><text x="50" y="68" font-size="60" text-anchor="middle">🍽️</text></svg>',
  },
  openGraph: {
    title: 'Le Bistrot Moderne',
    description: 'Un bistrot parisien moderne — cuisine française revisitée',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans bg-white text-gray-900">
        <Providers>
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
