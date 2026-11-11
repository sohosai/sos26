# Docker での開発環境構築

`compose.yml` を使って、アプリ（Web + API）と依存サービスをまとめてローカルで起動する手順です。
ホストに Bun や PostgreSQL を入れなくても開発できます。

## 起動するサービス

| サービス | 内容 | ホストのポート |
|---|---|---|
| `app` | Web（Vite）と API（Hono）。`bun install` → マイグレーション → `bun run dev` を実行 | 5173（Web）, 3000（API） |
| `db` | PostgreSQL | 5432 |
| `object-storage` | S3 互換ストレージ（RustFS） | 9000（API）, 9001（管理コンソール） |
| `firebase-auth` | Firebase Auth Emulator | 9099（Auth）, 4000（Emulator UI） |
| `create-bucket` | バケット作成用の使い捨てコンテナ（`setup` プロファイル） | — |

外部サービスのうち、**SendGrid（メール送信）だけは本物を使います**。ローカルの代替はありません。

## 前提条件

- Docker / Docker Compose
- SendGrid の API キー（認証メール等を実際に送信するため）

## 1. 環境変数ファイルを作成する

`app` コンテナは `apps/api/.env` と `apps/web/.env` を `env_file` として読み込みます。
まず `.env.example` をコピーします。

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

`.env.example` は Docker 環境向けの値（`db`・`object-storage`・`firebase-auth` などのサービス名）がデフォルトになっているので、
以下だけ埋めれば起動できます。

### `apps/api/.env`

| 変数 | 設定内容 |
|---|---|
| `SENDGRID_API_KEY` | SendGrid の API キー |
| `EMAIL_FROM` | SendGrid で認証済みの送信元アドレス |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | 後述の手順で生成した鍵 |
| `FILE_TOKEN_SECRET` | 32 文字以上のランダムな文字列 |
| `NOTIFICATION_SYNC_PASSWORD` | 任意の文字列 |

### `apps/web/.env`

| 変数 | 設定内容 |
|---|---|
| `VITE_VAPID_PUBLIC_KEY` | API の `VAPID_PUBLIC_KEY` と同じ値 |

### VAPID 鍵の生成

Web Push 用の鍵ペアです。外部サービスへの登録は不要で、手元で生成するだけです。

```bash
bunx web-push generate-vapid-keys
# または、Bun が手元にない場合
docker run --rm node:24-alpine npx -y web-push generate-vapid-keys
```

### ランダム文字列の生成例

```bash
openssl rand -hex 32
```

## 2. 起動する

```bash
docker compose up -d
```

初回は `app` コンテナでの `bun install` と、`firebase-auth` コンテナでの Java・firebase-tools のダウンロードがあるため数分かかります。
進み具合はログで確認できます。

```bash
docker compose logs -f app firebase-auth
```

## 3. バケットを作成する（初回のみ）

ストレージのデータは volume に保存されるので、初回に一度だけ実行すれば十分です。

```bash
docker compose --profile setup run --rm create-bucket
```

## 4. アクセスする

| URL | 内容 |
|---|---|
| http://localhost:5173 | Web アプリ |
| http://localhost:3000 | API |
| http://localhost:4000 | Firebase Emulator UI（ユーザーの確認・作成・削除） |
| http://localhost:9001 | オブジェクトストレージの管理コンソール（`dev_access_key` / `dev_secret_access_key`） |

## Firebase Auth Emulator について

- プロジェクト ID は `demo-sos26` です。`demo-` で始まる ID のため、実際の Firebase プロジェクトには接続しません。
- 登録したユーザーは `firebase-data` volume に保存され、`docker compose stop` / `down` で終了したときに書き出されます。
  `docker compose kill` などで強制終了すると、その回の変更は保存されません。
- パスワードリセットのメールは送信されません。リセット用のリンクは Emulator UI と `firebase-auth` のログに出力されます。
- 新規登録時の認証メールは API が SendGrid から送信するため、**受信できるメールアドレスで登録してください**。
- API 側は `FIREBASE_AUTH_EMULATOR_HOST`、Web 側は `VITE_FIREBASE_AUTH_EMULATOR_URL` でエミュレータに接続しています。
  これらを消して本物の認証情報を設定すれば、実際の Firebase プロジェクトを使うこともできます（`.env.example` のコメント参照）。

## よく使うコマンド

コンテナ内でスクリプトを実行するときは `docker compose exec app` を付けます。

```bash
# 実委人の初期登録（docs/how-to/make-committee-member.md）
docker compose exec app bun run make-committee-member --email user@example.com

# シードデータ投入（docs/how-to/seed.md）
# SEED_FIREBASE_UIDS には Emulator UI で確認できる UID を設定する
docker compose exec app bun run db:seed

# マイグレーション（起動時にも自動で実行される）
docker compose exec app bun run db:migrate:dev
```

`.env` を変更した場合は、もう一度 `docker compose up -d` を実行してください。変更が検出され、`app` コンテナが作り直されます。

## 停止・リセット

```bash
# 停止（データは残る）
docker compose down

# データも含めて削除（DB・ストレージ・Firebase ユーザー・依存パッケージのキャッシュ）
docker compose down -v
```
