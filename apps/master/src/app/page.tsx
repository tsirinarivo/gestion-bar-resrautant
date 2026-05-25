import { redirect } from 'next/navigation'
import { readSession } from '@/lib/auth'

export default function Home() {
  const session = readSession()
  redirect(session ? '/dashboard' : '/login')
}
