# 認証実装ガイド（auth.md 準拠・再編）

このドキュメントは、auth.md の最終仕様に基づく実装手引きです。既存構成に依存せず、仕様から逆算した最小・堅牢な実装を示します。

---

## 目次

- [認証実装ガイド（auth.md 準拠・再編）](#認証実装ガイドauthmd-準拠再編)
	- [目次](#目次)
	- [概要](#概要)
	- [データモデル（Prisma）](#データモデルprisma)
	- [環境変数](#環境変数)
	- [バックエンド実装](#バックエンド実装)
		- [ユーティリティ（token）](#ユーティリティtoken)
		- [メール送信](#メール送信)
		- [ミドルウェア](#ミドルウェア)
		- [ルート実装](#ルート実装)
			- [POST /auth/email/start](#post-authemailstart)
			- [POST /auth/email/verify](#post-authemailverify)
			- [POST /auth/register](#post-authregister)
			- [GET /auth/me](#get-authme)
	- [フロントエンド要点](#フロントエンド要点)
	- [セキュリティ要点](#セキュリティ要点)
	- [テスト方針](#テスト方針)
	- [運用ノート](#運用ノート)

---

## 概要

- 新規登録フローは「メール検証 → reg_ticket（短命・使い捨て）→ 登録」。
- reg_ticket は Cookie に載せる Opaque token（ランダム値）で、DB が唯一の正。検証時に原子的に消費（DELETE）。
- verify 以降は同一ブラウザ（同一Cookieストア）が必須。
- ログイン以降は Firebase Authentication（email/password）に委譲。

---

## データモデル（Prisma）

`prisma/schema.prisma` の追加・変更（抜粋）:

```prisma
// 認証: メール検証チャレンジ（一時）
model EmailVerification {
  email     String   @id
  tokenHash String   @unique @map("token_hash")
  expiresAt DateTime @map("expires_at")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@index([expiresAt])
  @@map("email_verifications")
}

// 認証: 短命チケット（Cookie の Opaque token に対応）
model RegTicket {
  id        String   @id @default(cuid())
  tokenHash String   @unique @map("token_hash")
  email     String   @unique
  expiresAt DateTime @map("expires_at")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@index([expiresAt])
  @@map("reg_tickets")
}
```

マイグレーション（例）:

```bash
bun run db:migrate:dev --name add-auth-models
```

---

## 環境変数

apps/api で必要（抜粋）:

- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
- `SENDGRID_API_KEY`, `EMAIL_FROM`, `EMAIL_SANDBOX`
- `APP_URL`（検証メールのリンク生成）

reg_ticket は Opaque token のため、JWT 秘密鍵は不要。

---

## バックエンド実装

### ユーティリティ（token）

`apps/api/src/lib/token.ts`

```ts
import { randomBytes, createHash } from 'node:crypto'

export function generateToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
```

### メール送信

既存の SendGrid ユースケースを使用（`sendVerificationEmail({ email, verifyUrl })`）。
`verifyUrl = ${APP_URL}/auth/register/verify#<token>`。

### ミドルウェア

- `requireAuth`:
  - Firebase ID Token 検証 → `User` 取得 → 状態確認。
- `requireRegTicket`:
  - `reg_ticket` Cookie の存在のみ確認し、値を `c.set('regTicketRaw', value)` に格納。
  - 有効性の検証と消費は `/auth/register` 内で実施（DB が唯一の正）。

### ルート実装

Cookie 発行は `HttpOnly; Path=/auth; SameSite=Lax; Max-Age=900; Secure(本番)` を厳守。

#### POST /auth/email/start

- 入力: `{ email }`
- 処理:
  - email 正規化（trim + lowercase）
  - tsukuba メール形式検証（shared スキーマを使用）
  - 既存 `User` がいても 200（列挙耐性）
  - 検証トークン生成: `token`, `tokenHash`, `expiresAt=30分`
  - `EmailVerification.upsert({ where: { email }, create/update })`
  - 検証メール送信（`/auth/register/verify#<token>`）

#### POST /auth/email/verify

- 入力: `{ token }`
- 処理（原子的）:
  - `tokenHash` を計算
  - `EmailVerification` を期限条件付きで原子的に消費
    - 条件: `tokenHash = :hash AND expiresAt > NOW()`
    - 推奨: 生SQLの `DELETE ... RETURNING email`
      - Prisma の場合は `$queryRaw` を利用、もしくはトランザクション内で
        `findFirst({ where: { tokenHash, expiresAt: { gt: now } } })` → `delete({ where: { email } })`
  - reg_ticket 用 Opaque token を生成し、`RegTicket` を email で UPSERT
    - `where: { email }` / `create: { tokenHash, email, expiresAt=15分 }` / `update: { tokenHash, expiresAt }`
  - `reg_ticket` Cookie を発行
- 出力: `{ success: true, email }`

#### POST /auth/register

- 前提: `requireRegTicket` で Cookie 値を `regTicketRaw` に保持
- 処理（原子的）:
  - `hashToken(regTicketRaw)` を計算
  - `RegTicket` を期限条件付きで原子的に消費し、email を取得
    - 条件: `tokenHash = :hash AND expiresAt > NOW()`
    - 推奨: 生SQLの `DELETE ... RETURNING email`
  - 既存 `User` があれば冪等で成功（そのユーザーを返す）。この時点で RegTicket は消費済み。
  - Firebase Admin で `createUser({ email, password, emailVerified: true })`
  - `User` を作成（失敗時は Firebase ユーザーを補償削除）
  - `reg_ticket` Cookie を削除
- エラー: `TOKEN_INVALID`（不正・存在しない・期限切れ）ほか

#### GET /auth/me

- Firebase ID Token 検証 → `User` 取得 → `status == ACTIVE` を確認 → `{ user }`

---

## フロントエンド要点

- 画面構成は auth.md に準拠（register, verify, setup）。
- verify 以降は同一ブラウザ（同一Cookieストア）で続行する旨を UI で明示。
- API ラッパ: `/auth/email/start`, `/auth/email/verify`, `/auth/register`, `/auth/me`。

---

## セキュリティ要点

- メール検証の確定は POST のみ（GET では状態変更しない）。
- EmailVerification/RegTicket は「期限内のみ消費可」。DELETE に期限条件を含める。
- RegTicket は email 一意で常に 1 件。再送は上書き（直前性: 最後に発行したもののみ有効）。
- Cookie は HttpOnly + SameSite=Lax + Path=/auth + 短命（15分）。

---

## テスト方針

- ユニット: `token.ts`（32B base64url 生成、SHA-256 ハッシュ）
- 統合:
  - `/auth/email/start`: 正常・形式不正・既存Userでも200
  - `/auth/email/verify`: 正常・期限切れ・不正トークン・同一email再送で上書き（旧無効）
  - `/auth/register`: Cookieなし・不正・期限切れ・消費済み・既存Userで冪等成功
  - `/auth/me`: 正常・無効トークン・無効化ユーザー
- E2E: verify→register の同一Cookieストア前提の確認、メールはモック/ツールで確認

---

## 運用ノート

- 期限切れ行の掃除（EmailVerification/RegTicket）は任意（cron/バッチ）。
- `/auth/*` 系のレート制限は将来対応（IP・email 単位）。
- メール文面に「同一ブラウザ（同一Cookieストア）で続行」を明記。
