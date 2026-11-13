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
		- [すべてのアプリを同時に起動](#すべてのアプリを同時に起動)
		- [個別に起動](#個別に起動)
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

- Bun: >= 1.2.10

## セットアップ

```bash
bun install
cp .env.example .env  # 環境変数は API・Web ともにリポジトリ直下の .env にまとめる
```

Docker でアプリと依存サービス（PostgreSQL・ストレージ・Firebase Auth Emulator）をまとめて起動する場合は [docs/how-to/docker-dev.md](docs/how-to/docker-dev.md) を参照してください。

## 開発

### すべてのアプリを同時に起動

```bash
bun run dev
```

### 個別に起動

- API: `cd apps/api && bun run dev`  （http://localhost:3000）
- Web: `cd apps/web && bun run dev`  （http://localhost:5173）

環境変数は API・Web ともにリポジトリ直下の `.env` で設定します。Web の `VITE_API_BASE_URL` の既定は `http://localhost:3000` です。

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
| `bun run dev` | すべてのアプリを同時に起動 |
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
