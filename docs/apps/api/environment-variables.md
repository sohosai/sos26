# 環境変数

apps/apiで使用する環境変数の設定方法とリファレンスです。

## 目次

- [環境変数](#環境変数)
	- [目次](#目次)
	- [環境変数一覧](#環境変数一覧)
	- [設定方法](#設定方法)
		- [開発環境](#開発環境)
	- [バリデーション](#バリデーション)
		- [バリデーションルール](#バリデーションルール)
		- [エラー例](#エラー例)
	- [コード例](#コード例)
		- [環境変数の読み込み](#環境変数の読み込み)
		- [型定義（例）](#型定義例)
	- [実装詳細](#実装詳細)
		- [仕組み](#仕組み)
		- [スキーマの追加例](#スキーマの追加例)
	- [参考リンク](#参考リンク)

## 環境変数一覧

| 変数名 | 説明 | デフォルト値 | 必須 |
|--------|------|-------------|------|
| `PORT` | サーバーのポート番号 | `3000` | ❌ |
| `CORS_ORIGIN` | CORSで許可するオリジン（カンマ区切り） | `""` | ❌ |
| `SENDGRID_API_KEY` | SendGrid の API キー | なし | ✅ |
| `EMAIL_FROM` | 送信元メールアドレス | なし | ✅ |
| `EMAIL_SANDBOX` | SendGrid サンドボックスモード有効化 | `false` | ❌ |
| `FIREBASE_PROJECT_ID` | Firebase プロジェクトID | なし | ✅ |
| `FIREBASE_CLIENT_EMAIL` | Firebase サービスアカウントのメールアドレス | なし | ✅ |
| `FIREBASE_PRIVATE_KEY` | Firebase サービスアカウントの秘密鍵 | なし | ✅ |
| `APP_URL` | アプリケーションURL（メール内リンク用） | なし | ✅ |
| `ADMIN_MAIL` | 管理者メールアドレス（プッシュ通知用） | なし | ✅ |
| `VAPID_PUBLIC_KEY` | VAPID 公開鍵（Web Push 用） | なし | ✅ |
| `VAPID_PRIVATE_KEY` | VAPID 秘密鍵（Web Push 用） | なし | ✅ |
| `PUSH_SEND_BATCH_SIZE` | プッシュ通知の一括送信数 | `50` | ❌ |
| `S3_ENDPOINT` | S3互換ストレージのエンドポイント URL | なし | ✅ |
| `S3_REGION` | S3 リージョン | `jp-north-1` | ❌ |
| `S3_BUCKET` | S3 バケット名 | なし | ✅ |
| `S3_ACCESS_KEY_ID` | S3 アクセスキー | なし | ✅ |
| `S3_SECRET_ACCESS_KEY` | S3 シークレットキー | なし | ✅ |
| `S3_PRESIGNED_URL_EXPIRES` | Presigned URL の有効期限（秒） | `3600` | ❌ |
| `S3_MAX_FILE_SIZE` | 最大ファイルサイズ（バイト） | `10485760` | ❌ |
| `FILE_TOKEN_SECRET` | ファイルトークン署名用秘密鍵（32文字以上） | なし | ✅ |

## 設定方法

### 開発環境

`apps/api` ディレクトリ直下に `.env`（または `.env.local`）を作成します。

```bash
# apps/api/.env
PORT=3000
CORS_ORIGIN=http://localhost:5173,http://localhost:3001

# SendGrid
SENDGRID_API_KEY=your_sendgrid_api_key_here
EMAIL_FROM=you@example.com
EMAIL_SANDBOX=false

# Firebase Admin（認証機能で必要）
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# 認証
APP_URL=http://localhost:5173

# プッシュ通知
ADMIN_MAIL=admin@example.com
VAPID_PUBLIC_KEY=your_vapid_public_key_here
VAPID_PRIVATE_KEY=your_vapid_private_key_here
# PUSH_SEND_BATCH_SIZE=50  # デフォルト50

# S3互換オブジェクトストレージ
S3_ENDPOINT=https://s3.isk01.sakurastorage.jp
# S3_REGION=jp-north-1  # デフォルト
S3_BUCKET=your-bucket-name
S3_ACCESS_KEY_ID=your_access_key
S3_SECRET_ACCESS_KEY=your_secret_key
# S3_PRESIGNED_URL_EXPIRES=3600  # デフォルト1時間
# S3_MAX_FILE_SIZE=10485760  # デフォルト10MB

# ファイルトークン（openssl rand -base64 48 等で生成）
FILE_TOKEN_SECRET=your-file-token-secret-at-least-32-chars

# ローカル専用にしたい場合は .env.local を使用
# apps/api/.env.local が存在すればこちらが優先されます
```

## バリデーション

環境変数は起動時に自動的にバリデーションされます。

### バリデーションルール

**PORT:**
- 1〜65535の範囲の整数である必要があります
- 文字列から数値に自動変換されます
- 空または未設定の場合はデフォルト値（3000）が使用されます

**CORS_ORIGIN:**
- カンマ区切りで複数のオリジンを指定可能
- 各オリジンは `http://` または `https://` で始まる有効なURLである必要があります
- 各オリジンは自動的にトリミングされます
- 空文字列は除外されます
- 未設定の場合は空配列になります

**SENDGRID_API_KEY:**
- 空であってはならない必須文字列

**EMAIL_FROM:**
- メールアドレス形式である必要があります（`z.email()`）

**EMAIL_SANDBOX:**
- 文字列 `"true"` / `"false"` のみ受け付け、内部で boolean に変換します
- 既定は `false`
- `"1"`/`"0"`、`"yes"`/`"no"` 等は無効（起動時にバリデーションエラー）

**FIREBASE_PROJECT_ID:**
- 空であってはならない必須文字列

**FIREBASE_CLIENT_EMAIL:**
- 空であってはならない必須文字列

**FIREBASE_PRIVATE_KEY:**
- 空であってはならない必須文字列
- `\n` は実際の改行に変換されます

**APP_URL:**
- 有効なURL形式である必要があります
- メール内のリンク生成に使用

**ADMIN_MAIL:**
- メールアドレス形式である必要があります（`z.email()`）

**VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY:**
- 空であってはならない必須文字列
- Web Push の VAPID 認証に使用

**PUSH_SEND_BATCH_SIZE:**
- 1以上の整数
- 既定は `50`

**S3_ENDPOINT:**
- 空であってはならない必須文字列

**S3_REGION:**
- 既定は `jp-north-1`

**S3_BUCKET:**
- 空であってはならない必須文字列

**S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY:**
- 空であってはならない必須文字列

**S3_PRESIGNED_URL_EXPIRES:**
- 1以上の整数（秒）
- 既定は `3600`（1時間）

**S3_MAX_FILE_SIZE:**
- 1以上の整数（バイト）
- 既定は `10485760`（10MB）

**FILE_TOKEN_SECRET:**
- 32文字以上の文字列
- HMAC-SHA256 署名に使用。UTF-8 エンコードしてそのまま鍵として使われる
- `openssl rand -base64 48` 等でランダム生成を推奨

### エラー例

```
ZodError: [
  {
    "code": "invalid_type",
    "path": ["PORT"],
    "message": "Expected number, received nan"
  }
]
```

## コード例

### 環境変数の読み込み

```typescript
import { env } from "./lib/env";

// 型安全にアクセス
console.log(env.PORT);           // number型
console.log(env.CORS_ORIGIN);    // string[]型
console.log(env.SENDGRID_API_KEY); // string型
console.log(env.EMAIL_FROM);     // string型（email）
console.log(env.EMAIL_SANDBOX);  // boolean型

// Firebase Admin（認証機能）
console.log(env.FIREBASE_PROJECT_ID);    // string型
console.log(env.FIREBASE_CLIENT_EMAIL);  // string型
console.log(env.FIREBASE_PRIVATE_KEY);   // string型

// 認証
console.log(env.APP_URL);            // string型
```

### 型定義（例）

```typescript
import type { Env } from "./lib/env";

function configureServer(config: Env) {
  // ...
}
```

## 実装詳細

環境変数の管理は `apps/api/src/lib/env.ts` で行われています。

### 仕組み

1. **スキーマ定義**: Zodで環境変数のスキーマを定義
2. **バリデーション**: `envSchema.parse()` で起動時にバリデーション
3. **型推論**: TypeScriptの型推論により型安全にアクセス可能

### スキーマの追加例

新しい環境変数を追加する場合は `src/lib/env.ts` を編集します。

スキーマ全体は `apps/api/src/lib/env.ts` を参照してください。以下は追加例です:

```typescript
const envSchema = z.object({
  // ... 既存のフィールド

  // 新しい環境変数を追加
  MY_NEW_VAR: z.string().min(1),                      // 必須文字列
  MY_OPTIONAL_VAR: z.string().default("default"),      // デフォルトあり
  MY_NUMBER_VAR: z.coerce.number().min(1).default(10), // 数値（文字列から変換）
});
```

## 参考リンク

- [Bun環境変数ドキュメント](https://bun.sh/docs/runtime/env)
- [Zod公式ドキュメント](https://zod.dev/)
