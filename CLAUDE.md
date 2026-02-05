# CLAUDE.md - sos26

## プロジェクト概要

雙峰祭オンラインシステム（sos26）- 筑波大学学園祭のためのフルスタックWebアプリケーション

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| ランタイム/パッケージマネージャー | Bun |
| モノレポ | Turborepo |
| フロントエンド | React 19 + Vite + TanStack Router |
| バックエンド | Hono (Bun) |
| DB | PostgreSQL + Prisma |
| 認証 | Firebase |
| スキーマ検証 | Zod (shared package) |
| Lint/Format | Biome |
| テスト | Vitest |

## プロジェクト構造

```
apps/
├── web/          # フロントエンド (React + Vite)
└── api/          # バックエンド (Hono + Bun)
packages/
└── shared/       # 共有スキーマ・型定義 (SSOT)
docs/             # 詳細ドキュメント
```

## 開発コマンド

```bash
bun run dev          # 全アプリ同時起動 (web: 5173, api: 3000)
bun run build        # ビルド
bun run typecheck    # 型チェック
bun run test:run     # テスト実行
bun run lint         # Lint
bun run format       # フォーマット
bun run db:migrate   # DBマイグレーション
bun run db:studio    # Prisma Studio
```

## コーディング規約

- **Biome設定**: タブインデント、ダブルクォート、セミコロンあり
- **TypeScript**: strict mode、noUnusedLocals/Parameters、noUncheckedIndexedAccess
- **pre-commitフック**: Lefthookで自動format（Biome + Prisma）

## ドキュメント参照

詳細は `/docs` を参照:

- **[docs/README.md](docs/README.md)** - ドキュメント索引
- **[docs/auth.md](docs/auth.md)** - 認証フロー
- **[docs/database.md](docs/database.md)** - DB設計
- **[docs/testing.md](docs/testing.md)** - テスト方針
- **[docs/how-to/add-endpoint.md](docs/how-to/add-endpoint.md)** - エンドポイント追加手順
- **[docs/how-to/error-handling.md](docs/how-to/error-handling.md)** - エラーハンドリング

### アプリ固有

- **Web**: `docs/apps/web/` (routing, api-client, components, styling)
- **API**: `docs/apps/api/` (auth, prisma, send-mail, testing)
