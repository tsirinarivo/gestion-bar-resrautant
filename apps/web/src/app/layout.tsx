import type { Metadata } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { Toaster } from 'sonner'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Sakafio — Logiciel pour votre restaurant et bar',
  description: 'Logiciel de gestion complet pour restaurants et bars : commandes, caisse, stock, fidélité, KDS, réservations.',
  manifest: '/manifest.json',
  themeColor: '#EA580C',
  icons: {
    icon: '/favicon.svg',
    apple: '/logo.svg',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Sakafio',
  },
  openGraph: {
    title: 'Sakafio — Logiciel pour votre restaurant et bar',
    description: 'Gestion complète restaurant & bar : POS, KDS, stock, fidélité, réservations. Fait à Madagascar.',
    url: 'https://sakafio.mg',
    siteName: 'Sakafio',
    images: ['/logo-horizontal.svg'],
    locale: 'fr_FR',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} ${playfair.variable} font-sans bg-brand-dark text-white antialiased`}>
        <Providers>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#111118',
                border: '1px solid #1E1E2E',
                color: '#fff',
              },
            }}
          />
        </Providers>
      </body>
    </html>
  )
}
