# データベース（Prisma）

このプロジェクトでは ORM として [Prisma](https://www.prisma.io/) を使用しています。

## セットアップ

### 環境変数

データベース接続には `DATABASE_URL` 環境変数が必要です。`apps/api/.env` に設定してください。

```bash
# apps/api/.env
DATABASE_URL="postgresql://user:password@localhost:5432/dbname?schema=public"
```

### Prisma Client の生成

スキーマ変更後は以下のコマンドで Prisma Client を再生成してください。

```bash
bun run db:generate
```

生成されたクライアントはデフォルトで `node_modules/@prisma/client` に出力されます。
アプリケーションからは `@prisma/client` をインポートして利用します。

## コマンド一覧

| コマンド | 説明 |
|---------|------|
| `bun run db:generate` | Prisma Client を生成 |
| `bun run db:migrate:dev` | 開発環境でマイグレーションを作成・適用 |
| `bun run db:migrate:deploy` | 本番環境でマイグレーションを適用 |
| `bun run db:migrate:reset` | データベースをリセット（全データ削除） |
| `bun run db:push` | スキーマを DB に直接反映（マイグレーションファイルなし） |
| `bun run db:pull` | 既存の DB からスキーマを生成 |
| `bun run db:studio` | Prisma Studio（GUI）を起動 |
| `bun run db:format` | Prisma スキーマをフォーマット |

## 開発フロー

### 1. スキーマの編集

`apps/api/prisma/schema.prisma` を編集してモデルを定義します。

```prisma
model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### 2. マイグレーションの作成・適用

```bash
bun run db:migrate:dev --name add_users_table
```

このコマンドは以下を実行します：
- マイグレーションファイルの生成（`apps/api/prisma/migrations/` 配下）
- データベースへの適用
- Prisma Client の再生成

### 3. Prisma Client の使用

```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// 例: ユーザーの作成
const user = await prisma.user.create({
  data: {
    email: 'test@example.com',
    name: 'Test User',
  },
})
```

API（Hono）では Prisma Client をシングルトンで管理しています。基本的には次のユーティリティから利用してください（詳細は `docs/apps/api/prisma.md` を参照）。

```typescript
// apps/api 内からの例
import { prisma } from '../lib/prisma'

const users = await prisma.user.findMany()
```

## 本番デプロイ

本番環境では `db:migrate:deploy` を使用してマイグレーションを適用します。

```bash
bun run db:migrate:deploy
```

`db:migrate:dev` と異なり、このコマンドは：
- 既存のマイグレーションファイルのみを適用
- 新しいマイグレーションは作成しない
- Prisma Client は再生成しない

## シーン別コマンドガイド

Prisma を初めて使う方向けに、よくあるシーン別に使うコマンドを解説します。

### プロジェクトに新しく参加したとき

```bash
# 1. 依存関係をインストール
bun install

# 2. apps/api/.env ファイルを作成し、DATABASE_URL を設定
cp apps/api/.env.example apps/api/.env
# .env を編集して DATABASE_URL を設定

# 3. マイグレーションを適用してDBを最新状態にする
bun run db:migrate:dev
```

### 新しいテーブルやカラムを追加したいとき

```bash
# 1. apps/api/prisma/schema.prisma を編集してモデルを追加・変更

# 2. マイグレーションを作成・適用
bun run db:migrate:dev --name 変更内容を表す名前
# 例: bun run db:migrate:dev --name add_posts_table

# これで Prisma Client も自動で再生成されます
```

**ポイント**: `--name` には英語で変更内容を簡潔に書きます（例: `add_users_table`, `add_email_to_profile`）

### 他の人がスキーマを変更したとき（git pull 後）

```bash
# マイグレーションを適用
bun run db:migrate:dev
```

新しいマイグレーションファイルがあれば自動で適用され、Prisma Client も再生成されます。

### データベースの中身を確認・編集したいとき

```bash
# Prisma Studio を起動（ブラウザで GUI が開きます）
bun run db:studio
```

Prisma Studio では：
- テーブルの中身を一覧表示
- データの追加・編集・削除
- リレーションの確認

が GUI で簡単にできます。開発中のデータ確認に便利です。

### 開発中に DB をリセットしたいとき

```bash
# 全データを削除してマイグレーションを再適用
bun run db:migrate:reset
```

**注意**: このコマンドは**全データが消えます**。開発環境でのみ使用してください。

## 参考リンク

- [Prisma 公式ドキュメント](https://www.prisma.io/docs)
- [Prisma Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
- [Prisma Client API](https://www.prisma.io/docs/reference/api-reference/prisma-client-reference)
