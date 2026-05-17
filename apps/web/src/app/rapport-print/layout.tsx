export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, padding: 0, background: '#fff', color: '#000', fontFamily: 'Georgia, serif' }}>
        {children}
      </body>
    </html>
  )
}
