# @sos26/api (Hono + Bun)

軽量な Hono サーバー。`@sos26/shared` に定義したスキーマ/エンドポイントを参照し、実装とクライアントの仕様を同期させる構成です。

## 起動

```bash
# 依存関係のインストール（リポジトリルートで一度だけ）
bun install

# 開発サーバー（デフォルト: http://localhost:3000）
bun run dev
```

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
bun run dev         # 開発
bun run build       # ビルド（Bun bundler）
bun run typecheck   # 型チェック
bun run test:run    # テスト
```

## クライアント連携

- Web クライアント（`apps/web`）は `@sos26/shared` のエンドポイント定義を参照し、ky ベースの共通クライアントから呼び出します。
- サーバー側は shared のスキーマで入出力を整合させることで、実装・型・実行時の整合性を確保します。
