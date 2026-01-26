# 認証仕様書

このドキュメントは、sos26 における **メールアドレス登録型認証**の仕様・設計・要件を定義する。
Outlook 等のメールクライアントによる **リンク自動踏破問題への対策**を必須とし、
Firebase Authentication を IdP として利用しつつ、**ユーザー作成はバックエンド主導**で行う。

> **Note**: 実装詳細は [`auth-implement.md`](./auth-implement.md) を参照。

---

## 目次

- [認証仕様書](#認証仕様書)
	- [目次](#目次)
	- [目的と背景](#目的と背景)
		- [目的](#目的)
		- [背景的制約](#背景的制約)
	- [設計原則](#設計原則)
	- [全体フロー](#全体フロー)
	- [画面構成](#画面構成)
	- [責務分担](#責務分担)
		- [フロントエンド](#フロントエンド)
		- [バックエンド](#バックエンド)
	- [データモデル](#データモデル)
		- [EmailVerification](#emailverification)
		- [User](#user)
		- [RegTicket](#regticket)
	- [Cookie仕様](#cookie仕様)
		- [reg\_ticket（登録許可トークン）](#reg_ticket登録許可トークン)
	- [API仕様](#api仕様)
		- [POST /auth/email/start](#post-authemailstart)
		- [POST /auth/email/verify](#post-authemailverify)
		- [POST /auth/register](#post-authregister)
		- [GET /auth/me](#get-authme)
	- [エラーコード](#エラーコード)
	- [登録後・通常利用フロー](#登録後通常利用フロー)
	- [セキュリティ要件](#セキュリティ要件)
	- [この設計で防げる脅威](#この設計で防げる脅威)
	- [環境変数](#環境変数)
	- [既知の脆弱性・制約](#既知の脆弱性制約)
		- [UX/仕様上の制約](#ux仕様上の制約)
		- [セキュリティ上の既知リスク](#セキュリティ上の既知リスク)

---

## 目的と背景

### 目的

- Firebase Authentication（email/password）を **IdP** として利用する
- Outlook 等の **メールリンク自動踏破**による誤検証を防止する
- Firebase 側の先行アカウント作成による登録妨害を **大幅に低減**する
- Firebase にユーザーが存在しても、**アプリ利用は `User` テーブルで制御**する

### 背景的制約

- 大学メールが Outlook 推奨であり、自動リンクアクセスは実環境で頻発する
- Firebase 標準のメール検証フローはこの制約と相性が悪い
- そのため「**リンクを踏んだだけでは検証完了しない**」設計が必須

---

## 設計原則

| 原則 | 内容 |
|----|----|
| 確定点の明示 | メール検証は **POST 操作のみ**で確定 |
| 直前性 | 検証直後のみ有効な **短命登録許可トークン** |
| 分離 | 認証（Firebase）とアプリ利用可否（users）を分離 |
| 冪等 | 再実行時に破綻しない |
| Firebase委譲 | ログイン後は Firebase に全面委譲 |

---

## 全体フロー

```
┌─────────────────────────────────────┐
│ 別端末でも可                         │
├─────────────────────────────────────┤
│ [1] /auth/register                  │
│     │ email入力                     │
│     ▼                               │
│ POST /auth/email/start              │
│     │ 検証メール送信                 │
└─────────────────────────────────────┘
     ↓ メールリンクを開く端末から同一ブラウザ（同一Cookieストア）必須
┌─────────────────────────────────────┐
│ verify 以降は同一ブラウザ（同一Cookieストア）必須│
├─────────────────────────────────────┤
│ /auth/register/verify#<token>       │
│     │（表示のみ・GETでは確定しない）   │
│     ▼                               │
│ POST /auth/email/verify             │
│     │ challenge消費                 │
│     │ reg_ticket Cookie 発行（短命） │
│     ▼                               │
│ /auth/register/setup                │
│     │ password入力                  │
│     ▼                               │
│ POST /auth/register                 │
│     │ Firebase Admin createUser     │
│     │ users 作成                    │
│     │ reg_ticket 破棄               │
│     ▼                               │
│ Client: signInWithEmailAndPassword  │
└─────────────────────────────────────┘
```

---

## 画面構成

| パス | 内容 | 端末制約 |
|----|----|----|
| `/auth/login` | ログイン | - |
| `/auth/register` | メールアドレス入力 | どの端末でも可 |
| `/auth/register/verify#token` | メール確認ページ（ボタン押下で確定） | **ここから同一ブラウザ（同一Cookieストア）** |
| `/auth/register/setup` | パスワード設定・本登録 | verify と同一ブラウザ（同一Cookieストア） |

※ メールリンクを開く端末から `reg_ticket` Cookie が発行されるため、**verify 以降は同一ブラウザ（同一Cookieストア）が必須**。

---

## 責務分担

### フロントエンド

| 操作 | 実装 |
|----|----|
| ログイン | Firebase Auth SDK |
| ログアウト | Firebase Auth SDK |
| ID Token取得 | Firebase Auth SDK |
| パスワードリセット | Firebase Auth SDK |
| 新規登録 | **API呼び出しのみ（createUserしない）** |

### バックエンド

| 責務 | 実装 |
|----|----|
| メール検証 | 独自実装（challenge） |
| ユーザー作成 | Firebase Admin SDK |
| ID Token検証 | Firebase Admin SDK |
| アプリ利用可否 | users テーブル |
| APIガード | 認証ミドルウェア |

---

## データモデル

### EmailVerification

メール検証用トークンの一時テーブル。
**検証成功時に DELETE で消費**し、状態を残さない。

```prisma
model EmailVerification {
  email     String   @id
  tokenHash String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([expiresAt])
  @@map("email_verifications")
}
```

### User

アプリケーション上のユーザー。Firebase UID と結合し、**利用可否はここで制御**する。

> **Note**: 既存の `User` モデルを拡張する形で実装する。

```prisma
enum UserStatus {
  ACTIVE
  DISABLED
}

enum UserRole {
  PLANNER           // 企画者
  COMMITTEE_MEMBER  // 委員会メンバー
  COMMITTEE_ADMIN   // 委員会管理者
  SYSTEM_ADMIN      // システム管理者
}

model User {
  id          String     @id @default(cuid())
  firebaseUid String     @unique
  email       String     @unique
  firstName   String
  lastName    String
  role        UserRole   @default(PLANNER)
  status      UserStatus @default(ACTIVE)
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  @@map("users")
}
```

### RegTicket

`reg_ticket` Cookie に対応する短命チケット。Cookie の値はランダムな Opaque token であり、
DB 側では `tokenHash` で一意化して email と有効期限を保持する。検証時に原子的に消費（DELETE）。
同一 email に対して RegTicket は常に 1 件で、最後に発行したもののみ有効（上書き）。

```prisma
model RegTicket {
  id        String   @id @default(cuid())
  tokenHash String   @unique
  email     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([expiresAt])
  @@map("reg_tickets")
}
```

---

## Cookie仕様

### reg_ticket（登録許可トークン）

| 項目 | 値 |
|----|----|
| 用途 | メール検証直後〜本登録までの引き継ぎ |
| 保存 | HttpOnly Cookie |
| Path | `/auth` |
| 有効期限 | 15分 |
| SameSite | Strict |
| Secure | 本番では true |

- Opaque token（ランダムな URL-safe 文字列）
- Cookie 自体は意味を持たず、サーバは DB に `tokenHash(SHA-256)`, `email`, `expiresAt` を保持
- 発行・失効・消費は DB を唯一の正として管理（検証時に原子的に消費）

---

## API仕様

### POST /auth/email/start

メール検証を開始する。

```
POST /auth/email/start
Content-Type: application/json

Request:
  { email: string }

Response:
  200: { success: true }
```

**処理**
1. email正規化（trim + lowercase）
2. 筑波大学メールアドレス形式を検証（`s{7桁数字}@u.tsukuba.ac.jp`）
3. `User` に存在しても常に成功レスポンス（列挙耐性）
   - 既存ユーザーの場合は「既に登録済みです。ログインしてください」という案内メールを送信（検証メールは送信しない）
4. 未登録メールの場合は token 生成（crypto.randomBytes）
5. challenge を UPSERT（tokenHash = SHA-256）
6. 確認メール送信（`/auth/register/verify#<token>`）

**エラー**
- `VALIDATION_ERROR`: メールアドレス形式不正

メールアドレスのバリデーションに関しては `docs/university-email.md` を参照。

> **Note**: レート制限は現状未実装。将来的に `RATE_LIMITED` を追加予定。

---

### POST /auth/email/verify

メール検証を **確定**する。

```
POST /auth/email/verify
Content-Type: application/json

Request:
  { token: string }

Response:
  200: { success: true, email: string }
  Set-Cookie: reg_ticket=<opaque>; HttpOnly; Path=/auth; SameSite=Lax; Max-Age=900
```

**処理（原子的）**
1. tokenHash を計算（SHA-256）
2. challenge を `DELETE ... RETURNING` で消費
   - 条件: `tokenHash = :hash AND expiresAt > NOW()`（期限内のみ有効）
3. 失敗時は `TOKEN_INVALID`
4. 成功時、ランダムな Opaque token を生成
5. `RegTicket` を email 一意で UPSERT（tokenHash, email, expiresAt=15分後）
   - 同一メールに既存のチケットがある場合は上書き（旧チケット無効化）
6. `reg_ticket` Cookie 発行

**エラー**
- `TOKEN_INVALID`: トークン不正または期限切れ

---

### POST /auth/register

本登録。**Firebase ユーザー作成は必ずサーバで行う。**

```
POST /auth/register
Content-Type: application/json
Cookie: reg_ticket=<opaque>

Request:
  { firstName: string; lastName: string; password: string }

Response:
  200: { user: User }
  Set-Cookie: reg_ticket=; Max-Age=0
```

**処理**
1. Cookie の `reg_ticket` を取得し、`tokenHash` を計算
2. `RegTicket` を `DELETE ... RETURNING` で原子的に消費（存在しない/期限切れはエラー）
   - 条件: `tokenHash = :hash AND expiresAt > NOW()`（期限内のみ有効）
3. 返却された `email` を使用
4. `User` が存在すれば冪等で成功（そのユーザーを返す）
5. Firebase Admin SDK `createUser`
   - Firebase に同一メールが既存の場合は `ALREADY_EXISTS`
6. `User` 作成
7. DB失敗時は `deleteUser(uid)` を試みる（補償）
8. `reg_ticket` Cookie を削除（RegTicket は成功・失敗に関わらずこのリクエストで消費済み。再実行には再検証が必要）

**エラー**
- `TOKEN_INVALID`: reg_ticket が不正・存在しない・または期限切れ
- `ALREADY_EXISTS`: Firebase に同一メールのアカウントが既存（先行作成妨害）
- `VALIDATION_ERROR`: パスワード要件不足

> **Note**: `User` テーブルに存在する場合は冪等で成功。`ALREADY_EXISTS` は Firebase 側に先行作成されたアカウントがある場合のみ発生。

---

### GET /auth/me

ログイン後のユーザー取得。

```
GET /auth/me
Authorization: Bearer <Firebase ID Token>

Response:
  200: { user: User }
```

**処理**
1. ID Token検証（Firebase Admin SDK）
2. `User` 取得（firebaseUid で検索）
3. `status == ACTIVE` を確認

**エラー**
- `UNAUTHORIZED`: ID Token が不正
- `FORBIDDEN`: ユーザーが無効化されている
- `NOT_FOUND`: ユーザーが存在しない

---

## エラーコード

認証系で追加するエラーコード:

| コード | ステータス | 用途 | 状態 |
|--------|-----------|------|------|
| `TOKEN_INVALID` | 400 | 検証トークン / reg_ticket が不正または期限切れ | 実装 |
| `RATE_LIMITED` | 429 | レート制限超過 | 将来対応予定 |

---

## 登録後・通常利用フロー

1. クライアントが `signInWithEmailAndPassword` でログイン
2. Firebase ID Token を `Authorization: Bearer` ヘッダーで API に送信
3. バックエンドは **`User` テーブルのみ**で利用可否判断
4. `status == ACTIVE` のユーザーのみ API アクセスを許可

```
[Client]                    [Backend]               [Firebase]
    |                           |                        |
    |-- signInWithEmailAndPassword ---------------------->|
    |<------------------- ID Token ----------------------|
    |                           |                        |
    |-- GET /auth/me ---------->|                        |
    |   Authorization: Bearer   |-- verifyIdToken ------>|
    |                           |<-- decoded token ------|
    |                           |                        |
    |                           |-- User.findUnique ---->|
    |<-- { user } -------------|                        |
```

---

## セキュリティ要件

| 要件 | 詳細 |
|------|------|
| POST確定 | メール検証は **POSTのみが確定点**（GETでは状態変更しない） |
| 短命トークン | token: 30分、reg_ticket: 15分 |
| HttpOnly | `reg_ticket` は HttpOnly Cookie で保存 |
| パスワード保護 | パスワードは永続化・ログ出力禁止 |
| レート制限 | `/auth/*` 系は IP・メールアドレス単位でレート制限 |
| 二重検証 | Firebase UID と `User` テーブルを必ず突合 |

---

## この設計で防げる脅威

| 脅威 | 対策 |
|------|------|
| Outlook自動踏破 | ボタンPOSTのみ確定 |
| 未確認メール登録 | メール検証必須 |
| Firebaseだけ通る侵入 | `User` テーブル必須 |
| 先行アカウント作成妨害 | サーバ `createUser` |
| セッション横取り | 同一ブラウザCookie + 短命トークン |
| メールアドレス列挙 | 常に成功レスポンス |

---

## 環境変数

認証機能に必要な環境変数:

| 変数名 | 用途 |
|--------|------|
| `FIREBASE_PROJECT_ID` | Firebase プロジェクトID |
| `FIREBASE_CLIENT_EMAIL` | サービスアカウントのメールアドレス |
| `FIREBASE_PRIVATE_KEY` | サービスアカウントの秘密鍵 |
| `APP_URL` | アプリケーションURL（メール内リンク用） |

> **Note**: メール送信は SendGrid 実装を使用する。
> - 未登録メール: `sendVerificationEmail({ email, verifyUrl })`
> - 既存メール: `sendAlreadyRegisteredEmail({ email, loginUrl })`
> SendGrid 関連の環境変数（`SENDGRID_API_KEY`, `EMAIL_FROM`, `EMAIL_SANDBOX`）は設定済み。

---

## 既知の脆弱性・制約

本設計では以下のリスク・制約を **許容** または **将来対応予定** として扱う。

### UX/仕様上の制約

| 制約 | 詳細 |
|------|------|
| verify 以降は同一ブラウザ | メールリンクを開く端末で `reg_ticket` Cookie が発行されるため、**verify → setup は同一ブラウザ（同一Cookieストア）が必須**。メール入力（register）は別端末でも可 |
| Cookie 依存 | Cookie がブロック/削除される環境（ITP等）では登録が失敗する可能性あり |

### セキュリティ上の既知リスク

| リスク | 状況 | 軽減策 |
|--------|------|--------|
| メールアドレス列挙（サイドチャネル） | `/auth/email/start` のレスポンス時間差分等による列挙は未考慮 | 常に成功レスポンスで軽減（完全ではない） |
| メール単位のレート制限不足 | `EmailVerification` に試行回数等を持たないため、精緻な不正検知が弱い | 後で拡張予定 |
