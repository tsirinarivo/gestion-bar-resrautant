import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' });

export const metadata: Metadata = {
  title: 'Le Bistrot Moderne - Commandez en ligne',
  description: 'Commandez vos plats préférés en ligne ou sur place',
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text x="50" y="70" font-size="80" text-anchor="middle">🍽️</text></svg>',
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
      <body className={`${inter.variable} ${playfair.variable} font-sans bg-white text-gray-900`}>
        <Providers>
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
