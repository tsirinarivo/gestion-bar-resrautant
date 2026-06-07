# ── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package.json package-lock.json turbo.json ./
COPY packages/master-database/package.json ./packages/master-database/
COPY packages/utils/package.json ./packages/utils/
COPY apps/master/package.json ./apps/master/

RUN npm ci --workspace=apps/master --workspace=packages/master-database --workspace=packages/utils

# ── Stage 2: build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY packages/master-database/ ./packages/master-database/
COPY packages/utils/ ./packages/utils/
COPY apps/master/ ./apps/master/
COPY turbo.json package.json tsconfig.json ./

# Generate Prisma client for master
RUN cd packages/master-database && npx prisma generate

ENV NEXT_TELEMETRY_DISABLED=1
RUN cd apps/master && npm run build

# ── Stage 3: runner ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
# Tous les outils nécessaires pour exécuter bash deploy/update.sh depuis l'UI :
# - git : git fetch/pull/reset/log au début du script
# - openssh-client : ssh-agent + ssh-add pour cloner imprimantcloud (repo privé)
# - docker-cli + compose : provisioning + recreate tenants
# - bash + gettext : envsubst dans new-tenant.sh
# - curl : debug + smoke tests
RUN apk add --no-cache libc6-compat openssl docker-cli docker-cli-compose bash gettext curl git openssh-client
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3010
ENV HOSTNAME=0.0.0.0

# Copy standalone output (Next.js)
COPY --from=builder /app/apps/master/.next/standalone ./
COPY --from=builder /app/apps/master/.next/static ./apps/master/.next/static
COPY --from=builder /app/apps/master/public ./apps/master/public
COPY --from=builder /app/apps/master/public ./public

# Prisma client generated dans node_modules
COPY --from=builder /app/packages/master-database/node_modules/.prisma ./packages/master-database/node_modules/.prisma

EXPOSE 3010

CMD ["node", "apps/master/server.js"]
