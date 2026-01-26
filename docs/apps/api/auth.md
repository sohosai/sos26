# API 認証

このドキュメントでは、API サーバーの認証システムについて説明します。

## 目次

- [API 認証](#api-認証)
  - [目次](#目次)
  - [概要](#概要)
  - [ミドルウェア](#ミドルウェア)
    - [requireAuth](#requireauth)
    - [requireRegTicket](#requireregticket)
  - [認証ルート](#認証ルート)
    - [POST /auth/email/start](#post-authemailstart)
    - [POST /auth/email/verify](#post-authemailverify)
    - [POST /auth/register](#post-authregister)
    - [GET /auth/me](#get-authme)
  - [エラーコード](#エラーコード)
  - [トークン管理](#トークン管理)
    - [検証トークン](#検証トークン)
    - [reg\_ticket](#reg_ticket)
  - [ファイル構成](#ファイル構成)

---

## 概要

API サーバーは Firebase Authentication と連携し、以下の機能を提供します:

1. **メール検証**: 筑波大学メールアドレスの所有確認
2. **ユーザー登録**: Firebase と DB の両方にユーザーを作成
3. **認証検証**: Firebase ID Token の検証と DB ユーザーの取得

認証の全体設計については [`docs/auth.md`](../../auth.md) を参照してください。

---

## ミドルウェア

### requireAuth

Firebase ID Token を検証し、ユーザー情報を Context に格納するミドルウェアです。

**ファイル**: `src/middlewares/auth.ts`

**処理フロー**:
1. `Authorization: Bearer <token>` ヘッダーから ID Token を取得
2. Firebase Admin SDK で検証
3. `firebaseUid` から `User` テーブルを検索
4. `status == ACTIVE` を確認
5. ユーザー情報を `c.set("user", user)` に格納

**使用例**:

```ts
import { requireAuth } from "../middlewares/auth";

route.get("/protected", requireAuth, async c => {
  const user = c.get("user");
  return c.json({ user });
});
```

**エラー**:
| 条件 | エラーコード |
|------|-------------|
| Authorization ヘッダーがない | `UNAUTHORIZED` |
| トークンが無効 | `UNAUTHORIZED` |
| ユーザーが存在しない | `NOT_FOUND` |
| ユーザーが無効化されている | `FORBIDDEN` |

### requireRegTicket

`reg_ticket` Cookie の存在を確認するミドルウェアです。

**ファイル**: `src/middlewares/auth.ts`

**処理フロー**:
1. Cookie から `reg_ticket` を取得
2. 値を `c.set("regTicketRaw", value)` に格納
3. 有効性の検証と消費は `/auth/register` 内で実施

**使用例**:

```ts
import { requireRegTicket } from "../middlewares/auth";

route.post("/register", requireRegTicket, async c => {
  const regTicketRaw = c.get("regTicketRaw");
  // ...
});
```

**エラー**:
| 条件 | エラーコード |
|------|-------------|
| Cookie がない | `TOKEN_INVALID` |

---

## 認証ルート

### POST /auth/email/start

メール検証を開始します。

**リクエスト**:
```json
{
  "email": "s1234567@u.tsukuba.ac.jp"
}
```

**レスポンス**:
```json
{
  "success": true
}
```

**処理**:
1. メールアドレスを正規化（trim + lowercase）
2. 筑波大学メールアドレス形式を検証（エイリアス `+xxx` も許可）
3. 既存ユーザーの場合: 案内メールを送信（列挙対策でレスポンスは同一）
4. 新規の場合: 検証トークンを生成し、`EmailVerification` に保存
5. 検証メールを送信

**エラー**:
| 条件 | エラーコード |
|------|-------------|
| メールアドレス形式不正 | `VALIDATION_ERROR` |

### POST /auth/email/verify

メール検証を確定します。

**リクエスト**:
```json
{
  "token": "<検証トークン>"
}
```

**レスポンス**:
```json
{
  "success": true,
  "email": "s1234567@u.tsukuba.ac.jp"
}
```

**Cookie**:
```
Set-Cookie: reg_ticket=<opaque>; HttpOnly; Path=/auth; SameSite=Lax; Max-Age=900
```

**処理**:
1. トークンをハッシュ化
2. `EmailVerification` を原子的に消費（トランザクション内で検索・削除）
3. `RegTicket` を生成し保存
4. `reg_ticket` Cookie を発行

**エラー**:
| 条件 | エラーコード |
|------|-------------|
| トークンが不正または期限切れ | `TOKEN_INVALID` |

### POST /auth/register

本登録を行います。Firebase と DB にユーザーを作成します。

**リクエスト**:
```json
{
  "firstName": "太郎",
  "lastName": "筑波",
  "password": "password123"
}
```

**Cookie**: `reg_ticket` が必要

**レスポンス**:
```json
{
  "user": {
    "id": "...",
    "email": "s1234567@u.tsukuba.ac.jp",
    "firstName": "太郎",
    "lastName": "筑波",
    "role": "PLANNER",
    "status": "ACTIVE",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

**処理**:
1. `reg_ticket` Cookie を取得・ハッシュ化
2. `RegTicket` を原子的に消費
3. Cookie を削除
4. 既存 User があれば冪等で成功
5. Firebase Admin SDK でユーザー作成
6. `User` テーブルにレコード作成
7. DB 失敗時は Firebase ユーザーを補償削除

**エラー**:
| 条件 | エラーコード |
|------|-------------|
| reg_ticket がない | `TOKEN_INVALID` |
| reg_ticket が不正または期限切れ | `TOKEN_INVALID` |
| Firebase に同一メールが既存 | `ALREADY_EXISTS` |
| パスワード要件不足 | `VALIDATION_ERROR` |

### GET /auth/me

現在のログインユーザーを取得します。

**リクエスト**:
```
Authorization: Bearer <Firebase ID Token>
```

**レスポンス**:
```json
{
  "user": {
    "id": "...",
    "email": "s1234567@u.tsukuba.ac.jp",
    "firstName": "太郎",
    "lastName": "筑波",
    "role": "PLANNER",
    "status": "ACTIVE",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

**エラー**:
| 条件 | エラーコード |
|------|-------------|
| ID Token が不正 | `UNAUTHORIZED` |
| ユーザーが存在しない | `NOT_FOUND` |
| ユーザーが無効化されている | `FORBIDDEN` |

---

## エラーコード

認証系で使用するエラーコード:

| コード | ステータス | 用途 |
|--------|-----------|------|
| `UNAUTHORIZED` | 401 | 認証が必要、ID Token が無効 |
| `FORBIDDEN` | 403 | アカウントが無効化されている |
| `NOT_FOUND` | 404 | ユーザーが存在しない |
| `ALREADY_EXISTS` | 409 | Firebase に同一メールのアカウントが既存 |
| `VALIDATION_ERROR` | 400 | 入力値が不正 |
| `TOKEN_INVALID` | 400 | 検証トークン / reg_ticket が不正または期限切れ |

エラーハンドリングの詳細は [`docs/how-to/error-handling.md`](../../how-to/error-handling.md) を参照。

---

## トークン管理

### 検証トークン

メール検証に使用するトークンです。

| 項目 | 値 |
|------|-----|
| 生成 | `crypto.randomBytes(32)` を base64url エンコード |
| 保存 | SHA-256 ハッシュを `EmailVerification.tokenHash` に保存 |
| 有効期限 | 30分 |
| 消費 | `POST /auth/email/verify` で原子的に削除 |

### reg_ticket

メール検証後〜本登録までの引き継ぎに使用する Cookie です。

| 項目 | 値 |
|------|-----|
| 生成 | `crypto.randomBytes(32)` を base64url エンコード |
| 保存 | SHA-256 ハッシュを `RegTicket.tokenHash` に保存 |
| Cookie 設定 | HttpOnly, Path=/auth, SameSite=Lax, Max-Age=900 |
| 有効期限 | 15分 |
| 消費 | `POST /auth/register` で原子的に削除 |

**トークン生成・ハッシュ化**: `src/lib/token.ts`

```ts
import { generateVerificationToken, hashToken } from "../lib/token";

const token = generateVerificationToken();  // base64url 文字列
const hash = hashToken(token);              // SHA-256 ハッシュ
```

---

## ファイル構成

```
apps/api/src/
├── routes/
│   └── auth.ts           # 認証ルート
├── middlewares/
│   └── auth.ts           # requireAuth, requireRegTicket
├── lib/
│   ├── error.ts          # AppError, Errors ヘルパー
│   ├── firebase.ts       # Firebase Admin SDK 初期化
│   ├── token.ts          # トークン生成・ハッシュ化
│   └── emails/
│       └── usecases/
│           ├── sendVerificationEmail.ts    # 検証メール送信
│           └── sendAlreadyRegisteredEmail.ts # 既存ユーザー案内メール
└── types/
    └── auth-env.ts       # AuthEnv 型定義
```
