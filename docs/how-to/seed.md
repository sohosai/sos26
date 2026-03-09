# 開発用シードデータの投入（CLIスクリプト）

スキーマ変更後にデータが消えても、このスクリプトで開発用ユーザーを素早く復元できます。

Firebase Auth には事前に登録済みのユーザー UID を env で渡すだけで、DB レコードを作成します。何度実行しても重複しません（冪等）。

## 前提条件

- `DATABASE_URL` が設定されている（`apps/api/.env`）
- Firebase に開発用アカウントが作成済みで、UID を取得済みであること

## 使い方

`apps/api/.env` に UID をカンマ区切りで設定します。

```env
SEED_FIREBASE_UIDS=uid-aaa,uid-bbb,uid-ccc
```

```bash
# プロジェクトルートから実行
bun run db:seed
```

### 想定する使い方
- 一度、通常通りにユーザーを登録する。
- firebaseから、firebaseUIDをコピーし、envにカンマ区切りで貼り付ける。
- resetした時にseed

### 作成されるユーザー

`SEED_FIREBASE_UIDS=uid-aaa,uid-bbb,uid-ccc` の場合の例：

| email | name | namePhonetic |
|-------|------|-------------|
| `dev+1@example.com` | `開発 太郎+1` | `かいはつたろうぷらすいち` |
| `dev+2@example.com` | `開発 太郎+2` | `かいはつたろうぷらすに` |
| `dev+3@example.com` | `開発 太郎+3` | `かいはつたろうぷらすさん` |

- 電話番号は全員共通
- 作成人数は `SEED_FIREBASE_UIDS` の要素数で決まる

## 環境変数でのカスタマイズ

`apps/api/.env` に以下を設定することで、作成するユーザーの情報を変更できます。

| 環境変数 | デフォルト値 | 説明 |
|---------|------------|------|
| `SEED_FIREBASE_UIDS` | （必須） | Firebase UID のカンマ区切りリスト |
| `SEED_USER_EMAIL` | `dev@example.com` | メールアドレスのベース（`+n` が付加される） |
| `SEED_USER_NAME` | `開発 太郎` | 名前のベース（`+n` が付加される） |
| `SEED_USER_NAME_PHONETIC` | `かいはつたろう` | ふりがなのベース（末尾に `n` が付加される） |
| `SEED_USER_TELEPHONE` | `090-0000-0000` | 電話番号（全員共通） |

## 動作

- DB でメールアドレスが既存の場合はスキップ（既存レコードを維持）
- 実委人（CommitteeMember）権限は付与しない → 付与する場合は `make-committee-member` スクリプトを使用（`docs/how-to/make-committee-member.md` 参照）
