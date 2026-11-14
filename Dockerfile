# syntax=docker/dockerfile:1.7

FROM oven/bun:1.2.10 AS base
WORKDIR /app

RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

# ソース変更時にも依存関係のインストール結果を再利用できるようにする。
COPY package.json bun.lock tsconfig.json turbo.json biome.json prisma.config.ts ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

FROM base AS builder
RUN bun install --frozen-lockfile --ignore-scripts
COPY apps/api ./apps/api
COPY packages/shared ./packages/shared
RUN bun run --cwd apps/api db:generate
RUN bun run build --filter=@sos26/api

FROM base AS prod-deps
RUN bun install --frozen-lockfile --production --ignore-scripts --filter @sos26/api
COPY apps/api/prisma ./apps/api/prisma
# 実行用の依存関係には ER 図生成ツールを含めないため、クライアントだけを生成する。
RUN cd apps/api && bun ../../node_modules/prisma/build/index.js generate --generator client
# distroless では OpenSSL の自動検出ができないため、各 CPU 向けのエンジンを固定パスで指定する。
RUN cd node_modules/.prisma/client && ln -s libquery_engine-*.so.node libquery_engine.so.node \
	&& cd /app/node_modules/@prisma/engines && ln -s schema-engine-* schema-engine

# Prisma と sharp が必要とする共有ライブラリを含む Debian 12 ベースを使う。
FROM gcr.io/distroless/cc-debian12:nonroot AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV PRISMA_QUERY_ENGINE_LIBRARY=/app/node_modules/.prisma/client/libquery_engine.so.node
ENV PRISMA_SCHEMA_ENGINE_BINARY=/app/node_modules/@prisma/engines/schema-engine

COPY --from=builder /usr/local/bin/bun /usr/local/bin/bun

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/scripts ./apps/api/scripts

EXPOSE 3000

CMD ["bun", "apps/api/dist/index.js"]
