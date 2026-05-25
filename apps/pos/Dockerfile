# ── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json turbo.json ./
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
COPY packages/ui/package.json ./packages/ui/
COPY apps/pos/package.json ./apps/pos/

RUN npm ci --workspace=apps/pos --workspace=packages/types --workspace=packages/utils --workspace=packages/ui

# ── Stage 2: build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY packages/ ./packages/
COPY apps/pos/ ./apps/pos/
COPY turbo.json package.json tsconfig.json ./

WORKDIR /app/apps/pos

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SOCKET_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL
ENV NEXT_TELEMETRY_DISABLED=1

RUN mkdir -p public
RUN npm run build

# ── Stage 3: runner ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat dumb-init
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder /app/apps/pos/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/pos/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/pos/.next/static ./.next/static
COPY --chown=nextjs:nodejs deploy/runtime-env-rewrite.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

USER nextjs

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["dumb-init", "--", "node", "server.js"]
