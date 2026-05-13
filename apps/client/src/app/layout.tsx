import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' });

export const metadata: Metadata = {
  title: 'Le Bistrot Moderne - Commandez en ligne',
  description: 'Commandez vos plats préférés en ligne ou sur place',
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
