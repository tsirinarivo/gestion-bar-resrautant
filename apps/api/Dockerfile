# ── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
# git nécessaire pour résoudre imprimantcloud (github:tsirinarivo/ImprimantCloud)
RUN apk add --no-cache libc6-compat openssl git
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

# Fix imprimantcloud: wrong XPyun region URLs (all three regions need the open. subdomain)
RUN sed -i \
    -e 's|platform.xpyun.net/api/openapi/xprinter|open.xpyun.net/api/openapi/xprinter|g' \
    -e 's|sg.xpyun.net/api/openapi/xprinter|sg.open.xpyun.net/api/openapi/xprinter|g' \
    -e 's|gm.xpyun.net/api/openapi/xprinter|gm.open.xpyun.net/api/openapi/xprinter|g' \
    node_modules/imprimantcloud/dist/lib/xprint.js && \
    grep -q "gm.open.xpyun.net" node_modules/imprimantcloud/dist/lib/xprint.js && \
    echo "✓ XPyun URLs correctes" || (echo "✗ sed n'a pas patché les URLs" && exit 1)

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

RUN node_modules/.bin/esbuild packages/database/prisma/import.ts \
  --bundle \
  --platform=node \
  --target=node20 \
  --outfile=apps/api/dist/import.js \
  --format=cjs \
  --external:@prisma/client \
  --external:bcryptjs \
  --external:bcrypt

RUN node_modules/.bin/esbuild packages/database/prisma/init-fresh.ts \
  --bundle \
  --platform=node \
  --target=node20 \
  --outfile=apps/api/dist/init-fresh.js \
  --format=cjs \
  --external:@prisma/client \
  --external:bcryptjs \
  --external:bcrypt

# ── Stage 3: runner ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl dumb-init
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/database/prisma ./prisma

# Create uploads directory writable by node user
RUN mkdir -p /app/public/uploads/products && chown -R node:node /app/public

EXPOSE 4000

USER node

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
