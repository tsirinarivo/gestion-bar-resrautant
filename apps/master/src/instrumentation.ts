// Hook Next.js au boot du serveur. Tourne UNE FOIS au démarrage de
// l'app, pas par requête. Cf. next.config.js: experimental.instrumentationHook
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { markZombieRuns } = await import('@/lib/zombie-runs')
    await markZombieRuns()
    const { ensureDefaultPlans } = await import('@/lib/seed-plans')
    await ensureDefaultPlans()
    const { startBillingScheduler } = await import('@/lib/billing-scheduler')
    startBillingScheduler()
  }
}
