# 認証

このドキュメントでは、Web アプリケーションの認証システムについて説明します。

> **関連ドキュメント**: ディレクトリ単位のアクセス制御（認可）については [`authorization.md`](./authorization.md) を参照。

## 目次

- [認証](#認証)
	- [目次](#目次)
	- [アーキテクチャ](#アーキテクチャ)
		- [二層構造の理由](#二層構造の理由)
		- [認証状態の定義](#認証状態の定義)
	- [認証ストア](#認証ストア)
		- [提供する値](#提供する値)
		- [末端ページでの使い方](#末端ページでの使い方)
		- [初期化](#初期化)
	- [認証フロー](#認証フロー)
		- [新規登録フロー](#新規登録フロー)
		- [ログインフロー](#ログインフロー)
		- [ログアウトフロー](#ログアウトフロー)
	- [認証 API](#認証-api)
	- [UI バリデーション](#ui-バリデーション)
		- [使用するバリデーション](#使用するバリデーション)
		- [実装例](#実装例)
	- [ページ実装パターン](#ページ実装パターン)
		- [認証必須ページ](#認証必須ページ)
		- [未認証専用ページ（ログインページなど）](#未認証専用ページログインページなど)

## アーキテクチャ

本システムは **Firebase Authentication** と **自前 DB（Prisma）** の二層構造を採用しています。
認証状態は **Zustand ストア**で管理し、React コンポーネントからも `beforeLoad` からも同じストアにアクセスできます。

```
┌─────────────────────────────────────────────────────────┐
│                      クライアント                        │
│  ┌─────────────────────────────────────────────────┐   │
│  │           Zustand Store (useAuthStore)          │   │
│  │  ┌─────────────────┐  ┌─────────────────────┐  │   │
│  │  │  firebaseUser   │  │       user          │  │   │
│  │  │  (Firebase認証) │  │   (DBユーザー)      │  │   │
│  │  └────────┬────────┘  └──────────┬──────────┘  │   │
│  └───────────┼──────────────────────┼─────────────┘   │
│              │                      │                  │
│      ┌───────┴───────┐      ┌───────┴───────┐         │
│      │   useAuthStore()   │      │  authReady()  │         │
│      │ (React Hook)  │      │ (beforeLoad)  │         │
│      └───────────────┘      └───────────────┘         │
└──────────────┼──────────────────────┼─────────────────┘
               │                      │
               ▼                      ▼
┌──────────────────────┐  ┌──────────────────────┐
│ Firebase Auth        │  │ API Server           │
│ (認証基盤)           │  │ GET /auth/me         │
└──────────────────────┘  └──────────┬───────────┘
                                     │
                                     ▼
                          ┌──────────────────────┐
                          │ PostgreSQL (Prisma)  │
                          │ User テーブル        │
                          └──────────────────────┘
```

### 二層構造の理由

| 層 | 役割 | 管理する情報 |
|----|------|-------------|
| Firebase Authentication | 認証基盤 | メールアドレス、パスワード、ID トークン |
| 自前 DB（User テーブル） | アプリ固有情報 | 氏名、役割（role）、ステータス、作成日時 |

Firebase はユーザー認証のみを担当し、アプリケーション固有のユーザー情報（氏名、権限など）は自前の DB で管理します。

### 認証状態の定義

| 状態 | Firebase | DB User | 説明 |
|------|----------|---------|------|
| 未認証 | なし | なし | ログインしていない |
| Firebase認証済み・未登録 | あり | なし | 基本存在しない |
| ログイン完了 | あり | あり | 通常の認証済み状態 |

## 認証ストア

認証状態は Zustand ストアで管理され、`useAuthStore()` フックで取得できます。

**ファイル**: `src/lib/auth/store.ts`

### 提供する値

**末端ページ用（通常はこれだけ使う）:**

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| `user` | `User \| null` | ログイン中のユーザー（本登録完了済み） |
| `isLoggedIn` | `boolean` | ログイン中か（`user` が存在するか） |
| `isLoading` | `boolean` | 認証状態の読み込み中か |
| `signOut` | `() => Promise<void>` | ログアウト |
| `refreshUser` | `() => Promise<void>` | ユーザー情報を再取得 |

**Firebaseの情報(基本使わない):**

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| `firebaseUser` | `FirebaseUser \| null` | Firebase ユーザー |
| `isFirebaseAuthenticated` | `boolean` | Firebase 認証済みか |

### 末端ページでの使い方

通常のページでは `user` と `isLoggedIn` だけを使えば十分です。

```tsx
import { useAuthStore } from "@/lib/auth";

function DashboardPage() {
  const { user, isLoggedIn } = useAuthStore();

  if (!isLoggedIn) {
    return <p>ログインしてください</p>;
  }

  return (
    <div>
      <h1>ようこそ、{user.lastName} {user.firstName} さん</h1>
      <p>メール: {user.email}</p>
      <p>役割: {user.role}</p>
    </div>
  );
}
```

### 初期化

`__root.tsx` の `beforeLoad` で `authReady()` を呼び出すことで、Firebase 認証状態の監視を遅延起動します。初回呼び出し時にリスナーが開始され、認証状態が確定するまで待機します。

```tsx
// __root.tsx
import { authReady } from "@/lib/auth";

export const Route = createRootRoute({
  beforeLoad: () => authReady(),
});
```

## 認証フロー

### 新規登録フロー

```
1. メールアドレス入力
   └─→ POST /auth/email/start（常に200）
       └─→ 未登録: 確認メール送信（/auth/register/verify#token）
       └─→ 既存: 「既に登録済み」案内メール送信（/auth/login への導線）

2. メール内リンクをクリック
   └─→ /auth/register/verify ページ
       └─→ POST /auth/email/verify
           └─→ reg_ticket Cookie 発行

3. パスワード・氏名入力
   └─→ POST /auth/register (Cookie: reg_ticket)
       └─→ Firebase ユーザー作成
       └─→ DB ユーザー作成

4. 自動ログイン
   └─→ signInWithEmailAndPassword()
   └─→ refreshUser()
   └─→ ホームへリダイレクト
```

### ログインフロー

```
1. メールアドレス・パスワード入力
   └─→ signInWithEmailAndPassword() [Firebase]

2. Zustand ストアが自動で更新
   └─→ onAuthStateChanged() 発火
       └─→ GET /auth/me で DB ユーザー取得
           └─→ user にセット、isLoggedIn = true
```

### ログアウトフロー

```
1. signOut() 呼び出し
   └─→ firebaseSignOut() [Firebase]
   └─→ user = null, isLoggedIn = false
```

## 認証 API

`@/lib/api/auth` で提供される関数:

| 関数 | エンドポイント | 説明 |
|------|---------------|------|
| `startEmailVerification({ email })` | POST /auth/email/start | メール検証を開始 |
| `verifyEmail({ token })` | POST /auth/email/verify | メール検証を確定、reg_ticket 発行 |
| `register({ firstName, lastName, password })` | POST /auth/register | 本登録（要 reg_ticket Cookie） |
| `getMe()` | GET /auth/me | 現在のユーザーを取得（要認証） |

## UI バリデーション

認証ページでは、API 呼び出し前に UI 側でバリデーションを行います。
これにより、ユーザーは即座にわかりやすいエラーメッセージを確認できます。

### 使用するバリデーション

`@sos26/shared` パッケージからインポートして使用します。

| 関数/スキーマ | 用途 | 使用箇所 |
|--------------|------|---------|
| `isTsukubaEmail(email)` | 筑波大学メールアドレス形式チェック | `/auth/register` |
| `firstNameSchema` | 名のバリデーション | `/auth/register/setup` |
| `lastNameSchema` | 姓のバリデーション | `/auth/register/setup` |
| `passwordSchema` | パスワード要件チェック（8文字以上） | `/auth/register/setup` |

### 実装例

```tsx
import { isTsukubaEmail } from "@sos26/shared";

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError(null);

  // UI側バリデーション
  if (!isTsukubaEmail(email)) {
    setError("筑波大学のメールアドレス（s0000000@u.tsukuba.ac.jp）を入力してください");
    return;
  }

  setLoading(true);
  try {
    await startEmailVerification({ email });
    // ...
  } catch (err) {
    // APIエラーの処理
  }
};
```

バリデーションの詳細は [`docs/how-to/error-handling.md`](../../how-to/error-handling.md) を参照。

## ページ実装パターン

### 認証必須ページ

> **Note**: 保護ディレクトリ（`/project/*`, `/committee/*`）配下のページでは、layout route の `beforeLoad` で認可チェックが行われるため、個別のチェックは不要です。詳細は [`authorization.md`](./authorization.md) を参照。

`__root.tsx` の `beforeLoad` で `authReady()` が完了するため、コンポーネント描画時には認証状態が常に確定しています。`initialized` のような初期化チェックは不要です。

```tsx
import { useAuthStore } from "@/lib/auth";

function DashboardPage() {
  const { user, isLoggedIn } = useAuthStore();

  // beforeLoad で認証状態は確定済み
  return (
    <div>
      <h1>ようこそ、{user?.lastName} {user?.firstName} さん</h1>
    </div>
  );
}
```

### 未認証専用ページ（ログインページなど）

```tsx
import { useAuthStore } from "@/lib/auth";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";

function LoginPage() {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuthStore();

  // 既にログイン済みならリダイレクト
  useEffect(() => {
    if (isLoggedIn) {
      navigate({ to: "/" });
    }
  }, [isLoggedIn, navigate]);

  return <LoginForm />;
}
```
