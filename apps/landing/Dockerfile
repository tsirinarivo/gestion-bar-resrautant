# ── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json turbo.json ./
COPY packages/utils/package.json ./packages/utils/
COPY apps/landing/package.json ./apps/landing/

RUN npm ci --workspace=apps/landing --workspace=packages/utils

# ── Stage 2: build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY packages/utils/ ./packages/utils/
COPY apps/landing/ ./apps/landing/
COPY turbo.json package.json tsconfig.json ./

ENV NEXT_TELEMETRY_DISABLED=1
RUN cd apps/landing && npm run build

# ── Stage 3: runner ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat dumb-init
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=4006
ENV HOSTNAME=0.0.0.0

# Copy standalone output (Next.js)
COPY --from=builder /app/apps/landing/.next/standalone ./
COPY --from=builder /app/apps/landing/.next/static ./apps/landing/.next/static
COPY --from=builder /app/apps/landing/public ./apps/landing/public
COPY --from=builder /app/apps/landing/public ./public

EXPOSE 4006

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/landing/server.js"]
