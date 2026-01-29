# Prisma Client 設計・利用ドキュメント

本ドキュメントは、Hono バックエンドにおける Prisma Client の設計方針と利用方法をまとめたものです。

---

## 1. 設計方針

### 基本原則

- Prisma Client はシングルトンパターンで管理
- 開発時のホットリロードによる接続数増加を防止
- `@prisma/client` からの標準インポートを使用

---

## 2. ファイル構成

```
apps/api/src/
└─ lib/
   └─ prisma.ts    # Prisma Client シングルトン
```

---

## 3. Prisma Client の実装

### lib/prisma.ts

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

### ポイント

- `globalThis` を使用してグローバルにインスタンスを保持
- 開発環境ではホットリロード時にインスタンスを再利用
- 本番環境では通常通り新規インスタンスを作成

---

## 4. 利用方法

### 基本的な使い方

```ts
import { prisma } from "../lib/prisma";

// ユーザー一覧取得
const users = await prisma.user.findMany();

// ユーザー作成
const user = await prisma.user.create({
  data: {
    email: "test@example.com",
    firebaseUid: "xxx",
    firstName: "太郎",
    lastName: "山田",
  },
});

// ユーザー検索
const user = await prisma.user.findUnique({
  where: { email: "test@example.com" },
});
```

### Hono ハンドラでの使用例

```ts
import { Hono } from "hono";
import { prisma } from "../lib/prisma";

const app = new Hono();

app.get("/users", async (c) => {
  const users = await prisma.user.findMany();
  return c.json(users);
});

app.get("/users/:id", async (c) => {
  const { id } = c.req.param();
  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json(user);
});

export default app;
```

---

## 5. トランザクション

### 複数操作をアトミックに実行

```ts
const [user, ticket] = await prisma.$transaction([
  prisma.user.create({
    data: { ... },
  }),
  prisma.regTicket.delete({
    where: { id: ticketId },
  }),
]);
```

### インタラクティブトランザクション

```ts
await prisma.$transaction(async (tx) => {
  const user = await tx.user.create({
    data: { ... },
  });

  await tx.regTicket.delete({
    where: { id: ticketId },
  });

  return user;
});
```

---

## 6. スキーマ変更時の手順

### 1. スキーマを編集

```
apps/api/prisma/schema.prisma
```

### 2. マイグレーション作成・適用

```bash
bun run db:migrate:dev
# または apps/api ディレクトリで
bun run db:migrate:dev
```

### 3. クライアント再生成（自動実行される）

```bash
bun run db:generate
```

---

## 7. 注意事項

### 接続管理

- Prisma Client は内部で接続プールを管理
- 明示的な `$connect()` / `$disconnect()` は通常不要
- サーバーレス環境では接続数に注意

### 型安全性

- Prisma Client は完全な型推論を提供
- スキーマ変更後は `prisma generate` で型を更新

### エラーハンドリング

Prisma のエラーは `handlePrismaError()` を使って `AppError` に変換します（[エラーハンドリングガイド](/docs/how-to/error-handling.md) 参照）。

```ts
import { prisma, handlePrismaError } from "../lib/prisma";

try {
  await prisma.user.create({ data });
} catch (e) {
  handlePrismaError(e);
}
```

### カスタムメッセージが必要な場合

特定のエラーメッセージが必要な場合は、個別にハンドリングします。

```ts
import { Prisma } from "@prisma/client";
import { prisma, handlePrismaError } from "../lib/prisma";
import { Errors } from "../lib/error";

try {
  await prisma.user.create({ data });
} catch (e) {
  if (
    e instanceof Prisma.PrismaClientKnownRequestError &&
    e.code === "P2002"
  ) {
    throw Errors.alreadyExists("このメールアドレスは既に使用されています");
  }
  handlePrismaError(e);
}
```

### 対応している Prisma エラーコード

| コード | 意味 | 変換先 |
|--------|------|--------|
| P2002 | ユニーク制約違反 | `Errors.alreadyExists()` |
| P2025 | レコードが見つからない | `Errors.notFound()` |
| P2003 | 外部キー制約違反 | `Errors.invalidRequest()` |
| その他 | 予期しないエラー | `Errors.internal()` |

---

## 8. 参考リンク

- [Prisma Client API Reference](https://www.prisma.io/docs/orm/reference/prisma-client-reference)
- [Prisma Error Reference](https://www.prisma.io/docs/orm/reference/error-reference)
