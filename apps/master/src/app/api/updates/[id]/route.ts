import { NextResponse } from 'next/server'
import { masterPrisma } from '@restaurant/master-database'
import { readSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/updates/:id?since=N — log offset pour polling efficient
// On renvoie seulement le chunk de log après l'offset 'since' (longueur),
// pour ne pas re-transférer tout à chaque poll.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = readSession()
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const url = new URL(req.url)
  const since = Number(url.searchParams.get('since') || 0)

  const run = await masterPrisma.updateRun.findUnique({
    where: { id: params.id },
    select: {
      id: true, status: true, startedAt: true, completedAt: true,
      startedBy: true, exitCode: true, log: true,
    },
  })
  if (!run) return NextResponse.json({ error: 'Run introuvable' }, { status: 404 })

  const fullLen = run.log.length
  const chunk = since < fullLen ? run.log.slice(since) : ''

  return NextResponse.json({
    id: run.id,
    status: run.status,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    startedBy: run.startedBy,
    exitCode: run.exitCode,
    logChunk: chunk,
    logLength: fullLen,
  })
}
