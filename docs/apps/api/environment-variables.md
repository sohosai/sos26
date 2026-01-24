# 環境変数

apps/apiで使用する環境変数の設定方法とリファレンスです。

## 目次

- [環境変数一覧](#環境変数一覧)
- [設定方法](#設定方法)
- [バリデーション](#バリデーション)
- [コード例](#コード例)
- [実装詳細](#実装詳細)
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
- 真偽値（厳密）。文字列 `"true"` / `"false"` のみ受け付けます
- 既定は `false`
- `"1"`/`"0"`、`"yes"`/`"no"` などの値は無効です（起動時にバリデーションエラー）

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

### 型定義

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

### スキーマの追加

新しい環境変数を追加する場合は `src/lib/env.ts` を編集します。

```typescript
const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  CORS_ORIGIN: z
    .string()
    .default("")
    .transform((val) => val.split(",").map((o) => o.trim()).filter(Boolean))
    .refine(
      (origins) => origins.every((o) => /^https?:\/\/.+/.test(o)),
      "各オリジンは有効なURL（http://またはhttps://で始まる）である必要があります"
    ),

  // SendGrid
  SENDGRID_API_KEY: z.string().min(1),
  EMAIL_FROM: z.email(),
  EMAIL_SANDBOX: z.coerce.boolean().default(false),
});
```

## 参考リンク

- [Bun環境変数ドキュメント](https://bun.sh/docs/runtime/env)
- [Zod公式ドキュメント](https://zod.dev/)
