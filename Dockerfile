# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Full dependencies (dev + prod)
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

# Production dependencies only
FROM base AS deps-prod
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci --omit=dev

# Builder stage
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
# Copy config files first (less frequently changed)
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY next.config.ts tsconfig.json ./
COPY postcss.config.mjs tailwind.config.ts components.json ./
# Copy source code last (most frequently changed)
COPY public ./public
COPY src ./src
COPY scripts ./scripts
RUN npm run build

# Web production image
FROM base AS web
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps-prod /app/node_modules ./node_modules
COPY package.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY scripts/bootstrap-admin.js ./scripts/bootstrap-admin.js
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.ts ./next.config.ts
EXPOSE 3000
CMD ["npm", "run", "start"]

# IMAP service image
FROM base AS imap-service
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
EXPOSE 3001
CMD ["node", "--conditions=react-server", "--import", "tsx", "scripts/imap-service.ts"]
