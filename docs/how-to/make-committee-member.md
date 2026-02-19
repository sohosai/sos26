# 実委人の初期登録（CLIスクリプト）

実委人（CommitteeMember）の登録は既存の実委人が行いますが、最初の1人はAPIの認可を通過できません。このCLIスクリプトを使って、登録済みユーザーを実委人に昇格させます。

## 前提条件

- 対象ユーザーがアプリで登録済み（Firebase Auth + User レコードが存在する）
- `DATABASE_URL` が設定されている（`apps/api/.env`）

## 使い方

```bash
# プロジェクトルートから実行
bun run make-committee-member -- --email user@example.com

# 局を指定する場合（デフォルト: INFO_SYSTEM）
bun run make-committee-member -- --email user@example.com --bureau FINANCE
```

### 指定可能な局

| 値 | 名称 |
|---|------|
| `FINANCE` | 財務局 |
| `GENERAL_AFFAIRS` | 総務局 |
| `PUBLIC_RELATIONS` | 広報宣伝局 |
| `EXTERNAL` | 渉外局 |
| `PROMOTION` | 推進局 |
| `PLANNING` | 総合計画局 |
| `STAGE_MANAGEMENT` | ステージ管理局 |
| `HQ_PLANNING` | 本部企画局 |
| `INFO_SYSTEM` | 情報メディアシステム局 |
| `INFORMATION` | 案内所運営部会 |

## 動作

- ユーザーが見つからない場合はエラーで終了
- 既にアクティブな実委人の場合は現在の情報を表示して終了
- ソフトデリート済みの場合は再有効化
- 新規の場合は作成

## 本番環境での使用

本番DBに接続するには `DATABASE_URL` を本番の値に設定して実行します:

```bash
DATABASE_URL="postgresql://..." bun run make-committee-member -- --email admin@example.com
```

## 権限の付与

実委人の登録後、権限（NOTICE_DELIVER 等）の付与は開発ページ（`/dev/committeeMember`）またはAPIから行えます。
