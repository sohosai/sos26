# sos26
雙峰祭オンラインシステム ソースコード

## 目次

- [sos26](#sos26)
	- [目次](#目次)
	- [特徴](#特徴)
	- [プロジェクト構成](#プロジェクト構成)
	- [前提条件](#前提条件)
	- [セットアップ](#セットアップ)
	- [開発](#開発)
		- [Docker Compose で起動](#docker-compose-で起動)
		- [ローカルで個別に起動](#ローカルで個別に起動)
	- [ビルド](#ビルド)
	- [テスト](#テスト)
	- [コード品質](#コード品質)
	- [ドキュメント](#ドキュメント)
	- [スクリプト一覧](#スクリプト一覧)

## 特徴

- モノレポ管理に Turborepo、パッケージマネージャー/ランタイムに Bun
- `packages/shared` で API スキーマと型を一元管理（Zod + TypeScript）
- Web は React 19 + Vite、API は Hono + Bun
- TanStack Router によるファイルベースルーティング
- Biome による厳格な Lint/Format、Lefthook で自動実行
- Vitest によるユニットテスト（カバレッジ対応）

## プロジェクト構成

```
.
├── apps/
│   ├── api/         # Hono (Bun) API サーバー（デフォルト: http://localhost:3000）
│   └── web/         # React + Vite（デフォルト: http://localhost:5173）
└── packages/
    └── shared/      # API エンドポイント定義・Zod スキーマ（SSOT）
```

## 前提条件

- Docker / Docker Compose
- Bun: >= 1.2.10

## セットアップ

開発環境の起動は Docker Compose を前提にしています。最初に環境変数ファイルを作成してください。

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

`apps/api/.env` はコンテナ内から接続するため、ローカル開発では次の接続先を使います。

- `DATABASE_URL="postgres://app:password@db:5432/app"`
- `S3_ENDPOINT=http://object-storage:9000`
- `S3_BUCKET=local-bucket`
- `S3_ACCESS_KEY_ID=dev_access_key`
- `S3_SECRET_ACCESS_KEY=dev_secret_access_key`

## 開発

### Docker Compose で起動

```bash
docker compose --profile setup up
```

起動時に `app` コンテナ内で依存関係のインストール、Prisma マイグレーション、Web/API の開発サーバー起動が実行されます。

- Web: http://localhost:5173
- API: http://localhost:3000
- Postgres: `localhost:5432`
- RustFS API: http://localhost:9000
- RustFS Console: http://localhost:9001

2回目以降、バケット作成が不要な場合は次のコマンドでも起動できます。

```bash
docker compose up
```

停止する場合:

```bash
docker compose down
```

DB やオブジェクトストレージのデータも削除して初期化する場合:

```bash
docker compose down -v
```

### ローカルで個別に起動

- API: `cd apps/api && bun run dev`  （http://localhost:3000）
- Web: `cd apps/web && bun run dev`  （http://localhost:5173）

ローカルで直接起動する場合は、別途 Postgres と S3 互換オブジェクトストレージを用意し、`apps/api/.env` の接続先をローカル向けに変更してください。Web の `VITE_API_BASE_URL` は `apps/web/.env`（または `.env.local`）で設定できます（既定は `http://localhost:3000`）。

## ビルド

```bash
bun run build
```

型チェックのみを実行する場合は:

```bash
bun run typecheck
```

クリーンアップ:

```bash
# 成果物とキャッシュのみ
bun run clean

# 依存関係まで含めて全消し
bun run clean:all
```

## テスト

```bash
# ワークスペース全体のテスト（ワンショット）
bun run test:run

# ウォッチモード
bun run test:watch

# カバレッジ（任意）
bun run test:run --coverage
```

詳細は [docs/testing.md](./docs/testing.md) を参照してください。

## コード品質

```bash
# Lint + Format（自動修正）
bun run check

# Lint のみ / Format のみ
bun run lint
bun run format

# CI 用（自動修正なし）
bun run ci
```

- Lint/Format: Biome
- Git Hooks: Lefthook（コミット前に Biome を実行）

## ドキュメント

- Web 開発
  - ルーティング: `docs/apps/web/routing.md`
  - API クライアント: `docs/apps/web/api-client.md`
  - 設定: `docs/apps/web/configuration.md`
  - コンポーネント: `docs/apps/web/components.md`
  - スタイル: `docs/apps/web/styling.md`
  - 環境変数: `docs/apps/web/environment-variables.md`
- テスト: `docs/testing.md`

より詳しい索引は `docs/README.md` を参照してください。

## スクリプト一覧

| コマンド | 説明 |
|---------|------|
| `docker compose --profile setup up` | 開発環境を起動（Web/API/DB/オブジェクトストレージ） |
| `docker compose up` | バケット作成を除いて開発環境を起動 |
| `docker compose down` | 開発環境を停止 |
| `bun run dev` | ローカル環境で全アプリを同時に起動 |
| `bun run build` | すべてのパッケージをビルド |
| `bun run typecheck` | TypeScript の型チェック |
| `bun run test:run` | テスト（ワンショット） |
| `bun run test:watch` | テスト（ウォッチ） |
| `bun run lint` | Biome Lint 実行 |
| `bun run format` | Biome Format 実行 |
| `bun run check` | Lint + Format（自動修正） |
| `bun run ci` | CI 用 Biome チェック |
| `bun run clean` | 成果物とキャッシュを削除 |
| `bun run clean:all` | 上記 + 依存関係も削除 |
| `bun run db:generate` | Prisma Client 生成 |
| `bun run db:migrate:dev` | マイグレーション作成・適用（開発） |
| `bun run db:migrate:deploy` | マイグレーション適用（本番） |
| `bun run db:migrate:reset` | DB リセット + 全マイグレーション適用 |
| `bun run db:push` | スキーマを DB に直接反映 |
| `bun run db:pull` | DB スキーマを取得 |
| `bun run db:studio` | Prisma Studio 起動 |
