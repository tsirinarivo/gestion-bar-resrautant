import { redirect } from 'next/navigation'
import { readSession } from '@/lib/auth'
import { Shell } from './Shell'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = readSession()
  if (!session) redirect('/login')

  return <Shell session={{ email: session.email, role: session.role }}>{children}</Shell>
}
