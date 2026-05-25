import { PrismaClient } from '../node_modules/.prisma/master-client'

declare global {
  // eslint-disable-next-line no-var
  var masterPrisma: PrismaClient | undefined
}

export const masterPrisma =
  global.masterPrisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
  })

if (process.env.NODE_ENV !== 'production') {
  global.masterPrisma = masterPrisma
}

export * from '../node_modules/.prisma/master-client'
