# @sos26/api (Hono + Bun)

軽量な Hono サーバー。`@sos26/shared` に定義したスキーマ/エンドポイントを参照し、実装とクライアントの仕様を同期させる構成です。

## 起動

```bash
# リポジトリルートで実行
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# 開発環境（API: http://localhost:3000）
docker compose --profile setup up
```

`compose.yml` の `app` コンテナが `bun install`、`bun run db:migrate:dev`、`bun run dev` を実行します。`db` と `object-storage` も同時に起動するため、`apps/api/.env` の `DATABASE_URL` は `postgres://app:password@db:5432/app`、`S3_ENDPOINT` は `http://object-storage:9000` を使います。

API だけをローカルで直接起動する場合は、Postgres と S3 互換オブジェクトストレージを別途用意してから `bun run dev` を実行してください。

## エンドポイント設計

- 仕様（メソッド/パス/入力/出力）は `@sos26/shared` に集約します（SSOT）。
- サーバー実装では shared の Zod スキーマを用いて入力を検証し、出力も同スキーマに揃えます。
- ルーティングは Hono を用い、ファイル単位で `src/routes/*` に切り出します。

### ルーティングの例（一般形）

```ts
// src/routes/example.ts
import { Hono } from 'hono'
import { z } from 'zod'
// import { someSchema } from '@sos26/shared'

const route = new Hono()

// GET /items
route.get('/items', c => {
  return c.json([])
})

// POST /items（入力検証の例）
const createItemSchema = z.object({ name: z.string().min(1) })
route.post('/items', async c => {
  const body = await c.req.json().catch(() => ({}))
  const parsed = createItemSchema.parse(body)
  return c.json({ id: 'generated_id', name: parsed.name }, 201)
})

export { route as exampleRoute }
```

`src/index.ts` でマウントします。

```ts
import { Hono } from 'hono'
import { env } from './lib/env'
import { exampleRoute } from './routes/example'

const app = new Hono()
app.route('/', exampleRoute)

export default { port: env.PORT, fetch: app.fetch }
```

## CORS とポート

- 開発用に簡易 CORS 設定を追加しています（`src/index.ts`）。必要に応じて適切な制限に変更してください。
- ポートは `PORT` 環境変数で上書き可能です（既定は `3000`）。

## スクリプト

```bash
bun run dev         # 開発（ホットリロード）
bun run build       # 型チェック + ビルド（Bun bundler）
bun run typecheck   # 型チェック
bun run clean       # dist, .turbo を削除
bun run test:run    # テスト（単発実行）
bun run test:watch  # テスト（ウォッチモード）
```

## クライアント連携

- Web クライアント（`apps/web`）は `@sos26/shared` のエンドポイント定義を参照し、ky ベースの共通クライアントから呼び出します。
- サーバー側は shared のスキーマで入出力を整合させることで、実装・型・実行時の整合性を確保します。
