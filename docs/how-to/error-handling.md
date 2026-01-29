# エラーハンドリングガイド

## 概要

本プロジェクトでは、バックエンド・フロントエンド間でエラーの扱いを統一しています。

## 基本方針

エラーは **3系統に分離** して扱います。

| 種類 | 例 | 処理する層 | 手段 |
|---|---|---|---|
| APIエラー | 400 / 401 / 404 / 500 / network | API Client | try-catch → ClientError |
| ユーザー起因 | 入力ミス / 未選択 | UI | フロントバリデーション |
| UIバグ | null参照 / runtime例外 | UI | Error Boundary |

**重要**: これらを混ぜないこと。

- APIエラーを例外扱いしない
- UIバグを状態分岐で処理しない

---

## shared パッケージ（共通契約）

### ErrorCode

```ts
import { ErrorCode } from "@sos26/shared";

// 利用可能なエラーコード
ErrorCode.UNAUTHORIZED     // 401 - 認証エラー
ErrorCode.FORBIDDEN        // 403 - 権限エラー
ErrorCode.NOT_FOUND        // 404 - リソース不在
ErrorCode.ALREADY_EXISTS   // 409 - 重複エラー
ErrorCode.VALIDATION_ERROR // 400 - バリデーションエラー
ErrorCode.INVALID_REQUEST  // 400 - 不正リクエスト
ErrorCode.INTERNAL         // 500 - 内部エラー
ErrorCode.TOKEN_INVALID    // 400 - トークン不正（認証系）
ErrorCode.RATE_LIMITED     // 429 - レート制限超過（将来対応予定）
```

### ApiErrorResponse

バックエンドからフロントエンドへ返されるエラーの統一形式です。

```ts
type ApiErrorResponse = {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
};
```

**ルール**:
- UI分岐は **必ず `code`** で行う
- `message` は表示用。ロジックに使わない

---

## バックエンド（API）での実装

### AppError を throw する

```ts
import { Errors } from "../lib/error";

// ユーザーが見つからない
throw Errors.notFound("ユーザーが見つかりません");

// 認証エラー
throw Errors.unauthorized("認証が必要です");

// 権限エラー
throw Errors.forbidden("アクセス権限がありません");

// 重複エラー
throw Errors.alreadyExists("このメールアドレスは既に使用されています");

// バリデーションエラー（詳細情報付き）
throw Errors.validationError("入力値が不正です", {
  fields: ["email", "name"],
});

// 内部エラー
throw Errors.internal("内部エラーが発生しました");

// トークン不正（認証系）
throw Errors.tokenInvalid("トークンが無効または期限切れです");
```

### 実装例

```ts
// apps/api/src/routes/user.ts
import { Errors } from "../lib/error";

userRoute.get("/users/:id", c => {
  const id = c.req.param("id");
  const user = db.users.find(u => u.id === id);

  if (!user) {
    throw Errors.notFound("ユーザーが見つかりません");
  }

  return c.json(user);
});

userRoute.post("/users", async c => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = userSchema.pick({ name: true, email: true }).parse(body);

  // 重複チェック
  if (db.users.find(u => u.email === parsed.email)) {
    throw Errors.alreadyExists("このメールアドレスは既に使用されています");
  }

  const newUser = { id: `u_${Date.now()}`, ...parsed };
  db.users.push(newUser);
  return c.json(newUser, 201);
});
```

### onError ハンドラ

`apps/api/src/lib/error-handler.ts` で全てのエラーを捕捉し、統一形式に変換します。

- `AppError`: そのまま `ApiErrorResponse` に変換
- `ZodError`: `VALIDATION_ERROR` として変換
- その他: `INTERNAL` として変換（詳細は隠蔽）

---

## フロントエンド（Web）での実装

### ClientErrorClass

API Client が throw する統一エラークラスです。

```ts
// 便利なgetterを提供
class ClientErrorClass extends Error {
  kind: "api" | "network" | "timeout" | "abort" | "unknown";
  code: ErrorCode | undefined;      // APIエラー時のみ有効
  apiError: ApiErrorResponse | undefined;  // APIエラー時のみ有効
  message: string;  // エラーメッセージ
}
```

### フロントエンドでの ZodError 処理

フロントエンド側で Zod による実行時検証を行う場合、`ZodError` は自動的に `ClientError` に変換されます。

```ts
// apps/web/src/lib/http/error.ts
if (error instanceof ZodError) {
  return { kind: "unknown", message: "入力値が不正です" };
}
```

これにより、生の `ZodError.issues` がユーザーに露出することを防ぎ、フレンドリーなメッセージに正規化されます。

### API 関数の使い方

API 関数は成功時にデータを返し、失敗時に `ClientError` を throw します。

```ts
import { getUser, createUser } from "@/lib/api/user";

// 成功: User を返す
// 失敗: ClientError を throw
const user = await getUser({ id: "123" });
```

### TanStack Query での使用

```ts
import { useQuery, useMutation } from "@tanstack/react-query";
import { getUser, createUser } from "@/lib/api/user";
import { isClientError } from "@/lib/http/error";
import { ErrorCode } from "@sos26/shared";

// Query
const { data, error, isLoading } = useQuery({
  queryKey: ["user", id],
  queryFn: () => getUser({ id }),
});

// エラーハンドリング
if (error && isClientError(error)) {
  // code getter でAPIエラーコードに直接アクセス
  switch (error.code) {
    case ErrorCode.NOT_FOUND:
      return <div>ユーザーが見つかりません</div>;
    case ErrorCode.UNAUTHORIZED:
      return <div>ログインが必要です</div>;
    case ErrorCode.TOKEN_INVALID:
      return <div>セッションが切れました。再度お試しください</div>;
  }
  // 非APIエラーは kind で分岐
  if (error.kind === "network") {
    return <div>ネットワークエラーが発生しました</div>;
  }
}

// Mutation
const mutation = useMutation({
  mutationFn: createUser,
  onError: (error) => {
    if (isClientError(error) && error.code === ErrorCode.ALREADY_EXISTS) {
      alert("このメールアドレスは既に使用されています");
    }
  },
  onSuccess: (user) => {
    console.log("作成成功:", user.id);
  },
});
```

### try-catch を使う場合

UI 層で直接 API を呼ぶ場合は try-catch を使います。

```ts
import { listUsers } from "@/lib/api/user";
import { isClientError } from "@/lib/http/error";

async function handleFetchUsers() {
  try {
    const users = await listUsers();
    setOutput(JSON.stringify(users, null, 2));
  } catch (error) {
    if (isClientError(error)) {
      // APIエラーは code getter で分岐
      if (error.code) {
        setError(`${error.code}: ${error.apiError?.error.message}`);
      } else {
        // 非APIエラーは kind で分岐
        switch (error.kind) {
          case "network":
            setError("ネットワークエラーが発生しました");
            break;
          case "timeout":
            setError("リクエストがタイムアウトしました");
            break;
          default:
            setError("エラーが発生しました");
        }
      }
    }
  }
}
```

---

## UI バリデーション

ユーザー起因のエラーは、API 呼び出し前に UI 層でバリデーションを行います。
これにより、ユーザーは即座にわかりやすいエラーメッセージを確認できます。

### shared のスキーマを使用する

`@sos26/shared` で定義されたスキーマやヘルパー関数を使用します。

```ts
import { isTsukubaEmail, passwordSchema, firstNameSchema } from "@sos26/shared";

// ヘルパー関数を使用
if (!isTsukubaEmail(email)) {
  setError("筑波大学のメールアドレスを入力してください");
  return;
}

// スキーマを使用
const result = passwordSchema.safeParse(password);
if (!result.success) {
  setError(result.error.issues[0]?.message ?? "パスワードが不正です");
  return;
}
```

### バリデーションの実施タイミング

1. **フォーム送信時**: `handleSubmit` 内で API 呼び出し前にバリデーション
2. **API 呼び出し前**: `setLoading(true)` の前にチェック
3. **エラー時は早期リターン**: API を呼ばずにエラーメッセージを表示

```ts
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError(null);

  // UI側バリデーション（API呼び出し前）
  if (!isTsukubaEmail(email)) {
    setError("筑波大学のメールアドレスを入力してください");
    return;  // 早期リターン
  }

  setLoading(true);
  try {
    await apiCall();
  } catch (err) {
    // APIエラーの処理
  } finally {
    setLoading(false);
  }
};
```

---

## エラー分岐のベストプラクティス

### DO（推奨）

```ts
// code getter で分岐する（APIエラー時のみ有効）
if (error.code === ErrorCode.NOT_FOUND) {
  // ...
}

// kind で分岐する
if (error.kind === "network") {
  // ...
}
```

### DON'T（非推奨）

```ts
// message 文字列で分岐しない
if (error.message.includes("見つかりません")) {
  // NG
}

// status で分岐しない（code を使う）
if (error.status === 404) {
  // NG - code を使うこと
}
```

---

## ファイル構成

```
packages/shared/src/errors/
├── code.ts       # ErrorCode 定義
├── response.ts   # ApiErrorResponse スキーマ
└── index.ts      # エクスポート

apps/api/src/lib/
├── error.ts          # AppError クラス、Errors ヘルパー
└── error-handler.ts  # Hono onError ハンドラ

apps/web/src/lib/http/
└── error.ts      # ClientError 型、isClientError、throwClientError
```

---

## Error Boundary

> **TODO**: Error Boundaryの実装ガイドを追加する

---

## まとめ

1. **バックエンド**: `Errors.xxx()` を throw するだけ
2. **フロントエンド**: `isClientError()` で判定し、`kind` と `code` で分岐
3. **共通**: `ErrorCode` で UI 分岐、`message` は表示用のみ
