import { NextResponse } from 'next/server'
import { masterPrisma } from '@restaurant/master-database'
import { readSession } from '@/lib/auth'
import { runUpdateAsync } from '@/lib/updates'

export const dynamic = 'force-dynamic'

// POST /api/updates/run — lance bash deploy/update.sh en background
// Réservé aux OWNER (peut casser la prod si update.sh foire).
export async function POST() {
  const session = readSession()
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (session.role !== 'OWNER') {
    return NextResponse.json({ error: 'Seul un OWNER peut déclencher un déploiement' }, { status: 403 })
  }

  // Empêche de lancer un update si un autre est déjà en cours
  const running = await masterPrisma.updateRun.findFirst({
    where: { status: 'RUNNING' },
    select: { id: true, startedAt: true },
  })
  if (running) {
    return NextResponse.json(
      { error: 'Un déploiement est déjà en cours', runId: running.id },
      { status: 409 }
    )
  }

  const runId = await runUpdateAsync(session.uid)
  return NextResponse.json({ id: runId, status: 'RUNNING' }, { status: 202 })
}

// GET /api/updates/run — derniers runs (10 max)
export async function GET() {
  const session = readSession()
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const runs = await masterPrisma.updateRun.findMany({
    orderBy: { startedAt: 'desc' },
    take: 10,
    select: {
      id: true,
      status: true,
      startedAt: true,
      completedAt: true,
      startedBy: true,
      exitCode: true,
    },
  })
  return NextResponse.json({ runs })
}
