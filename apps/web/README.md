# @sos26/web (React + Vite)

React 19 + Vite アプリケーション。TanStack Router（ファイルベース）と `@sos26/shared` のスキーマ/エンドポイントを利用します。

## スクリプト

開発環境はリポジトリルートから Docker Compose で起動します。

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
docker compose --profile setup up
```

Web は http://localhost:5173 で起動します。API も同じ Compose 環境で http://localhost:3000 に公開されます。

アプリ単体をローカルで直接起動する場合は、次のスクリプトを使います。

```bash
# 開発サーバー（http://localhost:5173）
bun run dev

# ビルド
bun run build

# プレビュー
bun run preview

# テスト
bun run test:run
bun run test:watch
```

## 環境変数

- 設定場所: `apps/web/.env`（または `.env.local`）
- 例は `apps/web/.env.example` を参照
- 主要変数: `VITE_API_BASE_URL`（デフォルト: `http://localhost:3000`）
- 詳細: `docs/apps/web/environment-variables.md`

## ルーティング

- TanStack Router のファイルベースルーティング（`@tanstack/router-plugin`）
- ページは `src/routes` に配置
- 詳細: `docs/apps/web/routing.md`

## API クライアント

- `@sos26/shared` のエンドポイント定義を参照
- 実行時は Zod で入出力を検証
- ky ベースの HTTP クライアント + 統一エラー/Result 型
- 詳細: `docs/apps/web/api-client.md`

## コンポーネントとスタイル

- 共通コンポーネント: `src/components/*`
- スタイル: CSS Modules (SCSS) — `*.module.scss`
- 詳細: `docs/apps/web/components.md`, `docs/apps/web/styling.md`

## エイリアス

- `@/*` → `src/*`（`tsconfig.app.json` と `vite.config.ts` で設定）
