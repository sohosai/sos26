# 環境変数

apps/webで使用する環境変数の設定方法とリファレンスです。

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
| `VITE_API_BASE_URL` | APIのベースURL | `http://localhost:3000` | ❌ |
| `VITE_FIREBASE_API_KEY` | Firebase API キー | なし | ✅ |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth ドメイン | なし | ✅ |
| `VITE_FIREBASE_PROJECT_ID` | Firebase プロジェクトID | なし | ✅ |

## 設定方法

### 開発環境

`apps/web` ディレクトリ直下に `.env`（または `.env.local`）を作成します。

```bash
# apps/web/.env
VITE_API_BASE_URL=http://localhost:3000

# Firebase（認証機能で必要）
VITE_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id

# ローカル専用にしたい場合は .env.local を使用
# apps/web/.env.local が存在すればこちらが優先されます
```

## バリデーション

環境変数は起動時に自動的にバリデーションされます。

### バリデーションルール

**VITE_API_BASE_URL:**
- `http://` または `https://` で始まる必要があります
- 空文字列の場合はデフォルト値が使用されます
- 不正な値の場合は起動時にエラーが発生します

**VITE_FIREBASE_API_KEY:**
- 空であってはならない必須文字列
- Firebase Console から取得

**VITE_FIREBASE_AUTH_DOMAIN:**
- 空であってはならない必須文字列
- 通常は `{project-id}.firebaseapp.com` 形式

**VITE_FIREBASE_PROJECT_ID:**
- 空であってはならない必須文字列
- Firebase プロジェクトの識別子

### エラー例

```
ZodError: [
  {
    "code": "invalid_format",
    "path": ["VITE_API_BASE_URL"],
    "message": "有効なURLである必要があります"
  }
]
```

## コード例

### 環境変数の読み込み

```typescript
import { env } from "@/lib/env";

// 型安全にアクセス
console.log(env.VITE_API_BASE_URL); // string型

// Firebase（認証機能）
console.log(env.VITE_FIREBASE_API_KEY);     // string型
console.log(env.VITE_FIREBASE_AUTH_DOMAIN); // string型
console.log(env.VITE_FIREBASE_PROJECT_ID);  // string型
```

### 型定義

```typescript
import type { Env } from "@/lib/env";

function useApi(config: Env) {
  // ...
}
```

## 実装詳細

環境変数の管理は `apps/web/src/lib/env.ts` で行われています。

### 仕組み

1. **スキーマ定義**: Zodで環境変数のスキーマを定義
2. **バリデーション**: `envSchema.parse()` で起動時にバリデーション
3. **型推論**: TypeScriptの型推論により型安全にアクセス可能

### スキーマの追加

新しい環境変数を追加する場合は `src/lib/env.ts` を編集します。

```typescript
const envSchema = z.object({
  VITE_API_BASE_URL: z
    .string()
    .regex(/^https?:\/\/.+/, "有効なURLである必要があります")
    .default("http://localhost:3000"),

  // 新しい環境変数を追加
  VITE_ANALYTICS_ID: z
    .string()
    .optional(),
});
```

## 参考リンク

- [Vite環境変数ドキュメント](https://vitejs.dev/guide/env-and-mode.html)
- [Zod公式ドキュメント](https://zod.dev/)
