import './globals.css'
import { Toaster } from 'sonner'
import { Providers } from './providers'

export const metadata = {
  title: 'Sakafio — Master',
  description: 'Gestion centralisée des clients Sakafio',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <Providers>
          {children}
          <Toaster position="top-right" richColors />
        </Providers>
      </body>
    </html>
  )
}
