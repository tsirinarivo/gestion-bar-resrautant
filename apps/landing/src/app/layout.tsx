import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { Toaster } from 'sonner'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fff7ed' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
}

export const metadata: Metadata = {
  title: 'Sakafio — Logiciel de gestion pour restaurant et bar',
  description:
    'POS, KDS, gestion de stock, fidélité, réservations, comptabilité. Tout-en-un, fait à Madagascar pour les restaurants et bars. Essayez 3 jours gratuitement.',
  metadataBase: new URL('https://sakafio.mg'),
  openGraph: {
    title: 'Sakafio — Logiciel pour restaurant et bar',
    description:
      'POS, KDS, stock, fidélité, comptabilité — tout en un. Essai gratuit 3 jours.',
    url: 'https://sakafio.mg',
    siteName: 'Sakafio',
    images: ['/og.png'],
    locale: 'fr_FR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sakafio — Logiciel restaurant & bar',
    description: 'Tout-en-un. Essai 3 jours gratuit.',
    images: ['/og.png'],
  },
  icons: { icon: '/favicon.svg', apple: '/logo.svg' },
  alternates: { canonical: 'https://sakafio.mg' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
        {/* Évite le flash blanc/noir au load : applique le thème AVANT le render */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <Header />
        <main>{children}</main>
        <Footer />
        <Toaster position="top-right" richColors />
      </body>
    </html>
  )
}
