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
  title: 'RestaurantOS — Gestion Restaurant',
  description: 'Système de gestion complet pour restaurants et fast-foods',
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
