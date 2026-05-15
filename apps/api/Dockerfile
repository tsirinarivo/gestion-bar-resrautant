# ── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package.json package-lock.json turbo.json ./
COPY packages/database/package.json ./packages/database/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
COPY apps/api/package.json ./apps/api/

RUN npm ci --workspace=apps/api --workspace=packages/database --workspace=packages/types --workspace=packages/utils

# ── Stage 2: build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
COPY turbo.json package.json tsconfig.json ./

# Fix imprimantcloud: platform.xpyun.net → open.xpyun.net (wrong default URL)
RUN sed -i 's|platform.xpyun.net/api/openapi/xprinter|open.xpyun.net/api/openapi/xprinter|g' \
    node_modules/imprimantcloud/dist/lib/xprint.js

# Generate Prisma client
RUN cd packages/database && npx prisma generate

# Bundle API + seed (esbuild handles TS + workspace imports natively)
RUN node_modules/.bin/esbuild apps/api/src/index.ts \
  --bundle \
  --platform=node \
  --target=node20 \
  --outfile=apps/api/dist/index.js \
  --format=cjs \
  --external:@prisma/client \
  --external:bcryptjs \
  --external:bcrypt

RUN node_modules/.bin/esbuild packages/database/prisma/seed.ts \
  --bundle \
  --platform=node \
  --target=node20 \
  --outfile=apps/api/dist/seed.js \
  --format=cjs \
  --external:@prisma/client

# ── Stage 3: runner ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl dumb-init
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/database/prisma ./prisma

EXPOSE 4000

USER node

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
