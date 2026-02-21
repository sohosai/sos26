# 実委人の初期登録（CLIスクリプト）

実委人（CommitteeMember）の登録は既存の実委人が行いますが、最初の1人はAPIの認可を通過できません。このCLIスクリプトを使って、登録済みユーザーを実委人に昇格させます。

## 前提条件

- 対象ユーザーがアプリで登録済み（Firebase Auth + User レコードが存在する）
- `DATABASE_URL` が設定されている（`apps/api/.env`）

## 使い方

```bash
# プロジェクトルートから実行
bun run make-committee-member --email user@example.com

# 局を指定する場合（デフォルト: INFO_SYSTEM）
bun run make-committee-member --email user@example.com --bureau FINANCE

# 権限も同時に付与する場合（カンマ区切り）
bun run make-committee-member --email user@example.com --permissions NOTICE_DELIVER,NOTICE_APPROVE
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

### 指定可能な権限

| 値 | 説明 |
|---|------|
| `MEMBER_EDIT` | メンバー編集 |
| `NOTICE_DELIVER` | お知らせ配信 |
| `NOTICE_APPROVE` | お知らせ承認 |
| `FORM_DELIVER` | フォーム配信 |

## 動作

- ユーザーが見つからない場合はエラーで終了
- 既にアクティブな実委人の場合は現在の情報を表示して終了（`--permissions` 指定時は権限のみ付与）
- ソフトデリート済みの場合は再有効化
- 新規の場合は作成
- `--permissions` 指定時は登録・再有効化後に権限を付与（既存の権限がある場合はスキップ）

## 本番環境での使用

本番DBに接続するには `DATABASE_URL` を本番の値に設定して実行します:

```bash
DATABASE_URL="postgresql://..." bun run make-committee-member --email admin@example.com
```

## 権限の付与

CLIの `--permissions` オプションで登録と同時に付与できます。登録後に変更する場合は、開発ページ（`/dev/committeeMember`）またはAPIから行えます。
