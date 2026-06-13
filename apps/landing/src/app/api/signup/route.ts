import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MASTER_URL = process.env.MASTER_API_URL || 'https://master.sakafio.mg'

export async function POST(req: Request) {
  const body = await req.text()
  try {
    const res = await fetch(`${MASTER_URL}/api/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
    const json = await res.json().catch(() => ({ error: 'Réponse invalide du serveur' }))
    return NextResponse.json(json, { status: res.status })
  } catch (err) {
    console.error('signup proxy error', err)
    return NextResponse.json(
      { error: 'Service temporairement indisponible. Réessayez dans une minute.' },
      { status: 502 },
    )
  }
}
