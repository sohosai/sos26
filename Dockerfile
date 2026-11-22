# syntax=docker/dockerfile:1.7

FROM oven/bun:1.2.10 AS builder
WORKDIR /app

RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

# Install dependencies first for better layer cache reuse.
COPY package.json bun.lock tsconfig.json turbo.json biome.json prisma.config.ts ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN bun install --frozen-lockfile --ignore-scripts

# Prisma Client is generated into node_modules, so generate it from the schema alone
# to keep the node_modules layer cached when only source code changes.
COPY apps/api/prisma/schema.prisma apps/api/prisma/schema.prisma
RUN bun run --cwd apps/api db:generate

# Copy source code and build API.
COPY apps/api ./apps/api
COPY packages/shared ./packages/shared
RUN bun run build --filter=@sos26/api

FROM oven/bun:1.2.10 AS runner
WORKDIR /app

RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3000

# Runtime files for API execution (Prisma client is under node_modules).
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/scripts ./apps/api/scripts

EXPOSE 3000

CMD ["bun", "apps/api/dist/index.js"]
