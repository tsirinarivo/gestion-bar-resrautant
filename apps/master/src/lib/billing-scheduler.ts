import { runBillingCycle } from './billing'

declare global {
  // eslint-disable-next-line no-var
  var __billingTimer: NodeJS.Timeout | undefined
}

const INTERVAL_MS = 6 * 60 * 60 * 1000 // 6h

export function startBillingScheduler() {
  if (global.__billingTimer) return
  const tick = async () => {
    try {
      const res = await runBillingCycle()
      if (res.generated || res.markedOverdue || res.suspended) {
        console.log(
          `[billing] cycle: ${res.generated} générées, ${res.markedOverdue} en retard, ${res.suspended} suspendues`
        )
      }
    } catch (err) {
      console.error('[billing] cycle failed:', err)
    }
  }
  global.__billingTimer = setInterval(tick, INTERVAL_MS)
  setTimeout(tick, 30_000)
}
