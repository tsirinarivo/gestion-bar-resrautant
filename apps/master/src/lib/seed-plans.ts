import { masterPrisma } from '@restaurant/master-database'

/**
 * Plans publics affichés sur sakafio.mg/#tarifs. Seedés au boot via
 * createMany skipDuplicates → ne sont JAMAIS ré-écrits si l'admin les a
 * modifiés depuis la console master. Pour resynchroniser, supprime la
 * row dans la table Plan et redémarre le container master.
 *
 * Garder cette liste alignée avec apps/landing/src/components/sections/Pricing.tsx
 */
const DEFAULT_PLANS = [
  { key: 'trial', name: 'Essai 3 jours', amountMga: 0, sortOrder: 0 },
  { key: 'starter', name: 'Starter', amountMga: 49_000, sortOrder: 10 },
  { key: 'pro', name: 'Pro', amountMga: 99_000, sortOrder: 20 },
  { key: 'pro-plus', name: 'Pro+', amountMga: 149_000, sortOrder: 30 },
]

export async function ensureDefaultPlans(): Promise<void> {
  try {
    const result = await masterPrisma.plan.createMany({
      data: DEFAULT_PLANS,
      skipDuplicates: true,
    })
    if (result.count > 0) {
      console.log(`[seed-plans] ${result.count} plan(s) public(s) seedé(s)`)
    }
  } catch (err) {
    console.error('[seed-plans] failed:', err)
  }
}
