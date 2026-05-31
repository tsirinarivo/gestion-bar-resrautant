import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sakafio KDS — Cuisine',
  description: 'Kitchen Display System — Logiciel pour votre restaurant et bar',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans bg-gray-950 text-white">{children}</body>
    </html>
  );
}
