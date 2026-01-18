# エンドポイント追加手順

`@sos26/shared` を単一の真実源（SSOT）として、スキーマ/エンドポイント定義 → API 実装 → Web からの呼び出し → テストまでを一貫して追加する手順です。

## 1. スキーマを追加（packages/shared）

ファイル: `packages/shared/src/schemas/<name>.ts`

```ts
import { z } from 'zod'

export const itemSchema = z.object({
  id: z.string(),
  label: z.string(),
})

export type Item = z.infer<typeof itemSchema>
```

`packages/shared/src/index.ts` に必要ならエクスポートを追加します。

## 2. エンドポイント定義を追加（packages/shared）

ファイル: `packages/shared/src/endpoints/<name>.ts`

```ts
import { z } from 'zod'
import { itemSchema } from '../schemas/<name>'
import type { GetEndpoint, BodyEndpoint } from './types'

export const listItemsEndpoint: GetEndpoint<
  '/items',
  undefined,
  undefined,
  typeof itemSchema.array()
> = {
  method: 'GET',
  path: '/items',
  pathParams: undefined,
  query: undefined,
  request: undefined,
  response: itemSchema.array(),
} as const

const createItemRequest = z.object({ label: z.string().min(1) })

export const createItemEndpoint: BodyEndpoint<
  'POST',
  '/items',
  undefined,
  undefined,
  typeof createItemRequest,
  typeof itemSchema
> = {
  method: 'POST',
  path: '/items',
  pathParams: undefined,
  query: undefined,
  request: createItemRequest,
  response: itemSchema,
} as const
```

`packages/shared/src/index.ts` で再エクスポートします。

## 3. API 実装（apps/api）

ファイル: `apps/api/src/routes/<name>.ts`

```ts
import { Hono } from 'hono'
import { z } from 'zod'
import { itemSchema } from '@sos26/shared'

type Item = z.infer<typeof itemSchema>
const route = new Hono()

const db: { items: Item[] } = { items: [] }

route.get('/items', c => c.json(db.items))

const createItemRequest = z.object({ label: z.string().min(1) })
route.post('/items', async c => {
  const body = await c.req.json().catch(() => ({}))
  const parsed = createItemRequest.parse(body)
  const newItem: Item = { id: `i_${Date.now()}`, label: parsed.label }
  db.items.push(newItem)
  return c.json(newItem, 201)
})

export { route as itemRoute }
```

`apps/api/src/index.ts` でルートをマウントします。

```ts
import { Hono } from 'hono'
import { env } from './lib/env'
import { itemRoute } from './routes/<name>'

const app = new Hono()
app.route('/', itemRoute)
export default { port: env.PORT, fetch: app.fetch }
```

## 4. Web から呼び出し（apps/web）

```ts
import { listItemsEndpoint, createItemEndpoint } from '@sos26/shared'
import { callGetApi, callBodyApi } from '@/lib/api/core'
import { isClientError } from '@/lib/http/error'

// GET - 成功時: Item[] を返す / 失敗時: ClientError を throw
try {
  const items = await callGetApi(listItemsEndpoint)
  console.log(items)
} catch (error) {
  if (isClientError(error)) {
    console.error(error.kind, error.message)
  }
}

// POST
try {
  const created = await callBodyApi(createItemEndpoint, { label: 'hello' })
  console.log(created)
} catch (error) {
  if (isClientError(error)) {
    console.error(error.kind, error.message)
  }
}
```

## 5. テスト（Vitest）

- 共有スキーマ: `packages/shared/src/schemas/*.test.ts`
- Web クライアント層: `apps/web/src/lib/api/*.test.ts`（AAA + モック）
- API 層: `docs/apps/api/testing.md` を参照

テストの鉄則
- AAA（Arrange-Act-Assert）パターンで記述
- 正常系/異常系を分ける
- 実装詳細ではなく振る舞いを検証

