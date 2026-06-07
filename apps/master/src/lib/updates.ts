import { spawn } from 'child_process'
import path from 'path'
import { masterPrisma } from '@restaurant/master-database'

const ROOT_DIR = process.env.RESTAURANT_ROOT || '/opt/restaurant'
const SCRIPT_UPDATE = path.join(ROOT_DIR, 'deploy', 'update.sh')

/**
 * Lance `bash deploy/update.sh` en background. Pousse stdout/stderr dans
 * UpdateRun.log au fur et à mesure (batch toutes les 2s pour limiter les
 * writes DB). Marque SUCCESS/FAILED à la fin.
 */
export async function runUpdateAsync(userId: string): Promise<string> {
  // Crée le run en DB pour avoir l'id immédiatement
  const run = await masterPrisma.updateRun.create({
    data: { status: 'RUNNING', startedBy: userId },
  })

  const child = spawn('bash', [SCRIPT_UPDATE], {
    cwd: ROOT_DIR,
    env: process.env,
  })

  let pendingLog = ''
  let pendingFlush: NodeJS.Timeout | null = null

  const flush = async () => {
    if (!pendingLog) return
    const chunk = pendingLog
    pendingLog = ''
    // Prisma n'a pas d'append natif sur String : read-then-write.
    // Non bloquant : si la DB foire, on log côté serveur et on continue.
    try {
      const current = await masterPrisma.updateRun.findUnique({
        where: { id: run.id }, select: { log: true },
      })
      await masterPrisma.updateRun.update({
        where: { id: run.id },
        data: { log: (current?.log || '') + chunk },
      })
    } catch (err) {
      console.error('[updates] flush failed:', err)
    }
  }

  const scheduleFlush = () => {
    if (pendingFlush) return
    pendingFlush = setTimeout(async () => {
      pendingFlush = null
      await flush()
    }, 2000)
  }

  child.stdout.on('data', (b: Buffer) => {
    pendingLog += b.toString()
    scheduleFlush()
  })
  child.stderr.on('data', (b: Buffer) => {
    pendingLog += b.toString()
    scheduleFlush()
  })

  child.on('close', async (code) => {
    if (pendingFlush) { clearTimeout(pendingFlush); pendingFlush = null }
    await flush()
    await masterPrisma.updateRun.update({
      where: { id: run.id },
      data: {
        status: code === 0 ? 'SUCCESS' : 'FAILED',
        completedAt: new Date(),
        exitCode: code ?? -1,
      },
    }).catch(err => console.error('[updates] post-close update failed:', err))
  })

  child.on('error', async (err) => {
    await masterPrisma.updateRun.update({
      where: { id: run.id },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        log: (await masterPrisma.updateRun.findUnique({ where: { id: run.id }, select: { log: true } }))?.log + `\n\nSpawn error: ${err.message}`,
      },
    }).catch(() => {})
  })

  return run.id
}
