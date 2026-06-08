import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { masterPrisma } from '@restaurant/master-database'
import { readSession } from '@/lib/auth'

const execP = promisify(exec)

export const dynamic = 'force-dynamic'

// POST /api/updates/:id/cancel — kill le script update.sh + mark FAILED
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = readSession()
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (session.role !== 'OWNER') {
    return NextResponse.json({ error: 'Seul un OWNER peut annuler' }, { status: 403 })
  }

  const run = await masterPrisma.updateRun.findUnique({ where: { id: params.id } })
  if (!run) return NextResponse.json({ error: 'Run introuvable' }, { status: 404 })
  if (run.status !== 'RUNNING') {
    return NextResponse.json({ error: `Run déjà ${run.status}, rien à annuler` }, { status: 400 })
  }

  // Kill le process bash update.sh dans le container (on tourne déjà dedans).
  try {
    await execP("pkill -9 -f 'deploy/update.sh'")
  } catch {
    // pkill renvoie 1 si aucun process à tuer — pas grave
  }

  await masterPrisma.updateRun.update({
    where: { id: params.id },
    data: {
      status: 'FAILED',
      completedAt: new Date(),
      exitCode: -2,
      log: run.log + '\n\n[ANNULÉ MANUELLEMENT par ' + (session.email || session.uid) + ']',
    },
  })

  return NextResponse.json({ ok: true })
}
