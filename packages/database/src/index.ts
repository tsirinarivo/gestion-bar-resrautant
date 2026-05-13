import { PrismaClient } from '@prisma/client';

// Prevent multiple Prisma client instances in development
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const createPrismaClient = () => {
  return new PrismaClient({
    log:
      process.env['NODE_ENV'] === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });
};

export const prisma = globalThis.__prisma ?? createPrismaClient();

if (process.env['NODE_ENV'] !== 'production') {
  globalThis.__prisma = prisma;
}

export { PrismaClient } from '@prisma/client';
export * from '@prisma/client';
