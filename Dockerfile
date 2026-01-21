# syntax=docker/dockerfile:1

ARG GIT_SHA=unknown

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
COPY postcss.config.mjs components.json ./
# Copy source code last (most frequently changed)
COPY public ./public
COPY messages ./messages
COPY src ./src
COPY scripts ./scripts
RUN npm run build

# Web production image
FROM base AS web
ARG GIT_SHA
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV TEMAIL_GIT_SHA=$GIT_SHA
COPY --from=deps-prod /app/node_modules ./node_modules
COPY package.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh
COPY scripts/bootstrap-admin.js ./scripts/bootstrap-admin.js
RUN chmod +x ./scripts/docker-entrypoint.sh
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.ts ./next.config.ts
EXPOSE 3000
ENTRYPOINT ["./scripts/docker-entrypoint.sh"]
CMD ["npm", "run", "start"]

# Worker image (IMAP sync + background jobs)
FROM base AS worker
ARG GIT_SHA
ENV NEXT_TELEMETRY_DISABLED=1
ENV TEMAIL_GIT_SHA=$GIT_SHA
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
RUN chmod +x ./scripts/imap-entrypoint.sh
EXPOSE 3001
ENTRYPOINT ["./scripts/imap-entrypoint.sh"]
CMD ["node", "--conditions=react-server", "--import", "tsx", "scripts/imap-service.ts"]
