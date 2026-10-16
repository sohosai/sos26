# コントリビュートガイド

このリポジトリへの貢献方法をまとめます。内部開発でも外部コントリビュートでも同様です。

## 開発のはじめかた

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
docker compose --profile setup up
```

開発環境は Docker Compose で起動します。Web は http://localhost:5173、API は http://localhost:3000 で利用できます。

## タスク実行

- ビルド: `bun run build`
- 型チェック: `bun run typecheck`
- テスト（全体）: `bun run test:run` / `bun run test:watch`
- Lint/Format: `bun run lint` / `bun run format` / `bun run check`

ワークスペース個別のタスクは各 `apps/*` / `packages/*` の `package.json` を参照してください。
Bun コマンドを直接実行する場合は、必要に応じて `docker compose exec app bun run ...` のように `app` コンテナ内で実行してください。

## コーディング規約

- 型安全性を最優先（Zod による実行時検証 + TypeScript）
- AAA（Arrange-Act-Assert）パターンでテスト記述
- 仕様の単一真実源は `@sos26/shared`

## Git Hooks / CI

- コミット前に Lefthook で Biome を実行（自動整形/修正）
- CI 用チェックは `bun run ci` を使用

## ドキュメント

-エントリ: `docs/README.md`
- 変更した仕様や外部公開の影響がある場合は該当ドキュメントも更新してください

