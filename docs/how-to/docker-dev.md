# Docker での開発環境構築

Docker Compose を用いて SOS26 の開発環境をローカルで起動する手順です。

## 前提条件

- Docker / Docker Compose
- SendGrid の API キー（認証メール等を実際に送信するため）

## 環境変数を設定する

`compose.yml` の `env_file` は、API の `.env.example`、API の `.env`、Web の `.env.example`、Web の `.env` の順に読み込みます。
DB、ストレージ、Firebase Auth Emulator の接続先など、開発用の既定値は各 `.env.example` にあります。
各 `.env` に書いた値で既定値を上書きできるため、`.env.example` をコピーする必要はありません。

`apps/api/.env` を作成し、SendGrid の設定と VAPID 鍵を記入してください。

```env
# apps/api/.env
SENDGRID_API_KEY=<SendGrid の API キー>
EMAIL_FROM=<SendGrid で認証済みの送信元アドレス>
VAPID_PUBLIC_KEY=<生成した公開鍵>
VAPID_PRIVATE_KEY=<生成した秘密鍵>
```

`apps/web/.env` を作成し、API の `VAPID_PUBLIC_KEY` と同じ公開鍵を記入してください。

```env
# apps/web/.env
VITE_VAPID_PUBLIC_KEY=<API と同じ公開鍵>
```

既定値を使う項目は `.env` に書かず、空文字で上書きする場合だけ `変数名=` と書いてください。

VAPID 鍵（Web Push 用の鍵ペア）は外部サービスへの登録不要で、手元で生成できます。

```bash
bunx web-push generate-vapid-keys
# Bun が手元にない場合
docker run --rm node:24-alpine npx -y web-push generate-vapid-keys
```

## 起動する

```bash
docker compose up -d
```

## アクセスする

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
  本物の Firebase プロジェクトを使う場合は、下の「本物の Firebase プロジェクトを使う」を参照してください。

### 本物の Firebase プロジェクトを使う

エミュレータを無効化するため、`apps/api/.env` と `apps/web/.env` で接続先を空文字で上書きし、本物の Firebase プロジェクトの値を設定します。
接続先の行を削除すると `.env.example` の既定値が使われ、エミュレータに接続します。

```env
# apps/api/.env
# エミュレータを無効化するため、接続先を空文字で上書きする
FIREBASE_AUTH_EMULATOR_HOST=
FIREBASE_PROJECT_ID=<プロジェクト ID>
FIREBASE_CLIENT_EMAIL=<サービスアカウントのメールアドレス>
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

```env
# apps/web/.env
# エミュレータを無効化するため、接続先を空文字で上書きする
VITE_FIREBASE_AUTH_EMULATOR_URL=
VITE_FIREBASE_API_KEY=<API キー>
VITE_FIREBASE_AUTH_DOMAIN=<プロジェクト ID>.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=<プロジェクト ID>
```

この場合も `firebase-auth` コンテナは起動しますが、使われません。

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

`apps/api/.env` / `apps/web/.env` を変更した場合は、もう一度 `docker compose up -d` を実行してください。変更が検出され、`app` コンテナが作り直されます。

## 停止・リセット

```bash
# 停止（データは残る）
docker compose down

# データも含めて削除（DB・ストレージ・Firebase ユーザー・依存パッケージのキャッシュ）
docker compose down -v
```
