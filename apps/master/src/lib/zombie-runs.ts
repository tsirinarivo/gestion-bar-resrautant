import { masterPrisma } from '@restaurant/master-database'

/**
 * Au démarrage du container master, on détecte les `UpdateRun` qui sont
 * encore en RUNNING mais probablement zombies — car si l'app Node redémarre
 * (recreate, crash, deploy), tous les child.on('close') jamais déclenchés
 * laissent des runs éternellement RUNNING.
 *
 * Tout run RUNNING depuis >5 min au démarrage est marqué FAILED.
 */
export async function markZombieRuns() {
  try {
    const cutoff = new Date(Date.now() - 5 * 60 * 1000) // 5 min
    const result = await masterPrisma.updateRun.updateMany({
      where: {
        status: 'RUNNING',
        startedAt: { lt: cutoff },
      },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        exitCode: -1,
      },
    })
    if (result.count > 0) {
      console.log(`[updates] Marked ${result.count} zombie update run(s) as FAILED at boot`)
    }
  } catch (err) {
    console.error('[updates] markZombieRuns failed:', err)
  }
}
