# 認証

このドキュメントでは、Web アプリケーションの認証システムについて説明します。

## 目次

- [認証](#認証)
	- [目次](#目次)
	- [アーキテクチャ](#アーキテクチャ)
		- [二層構造の理由](#二層構造の理由)
		- [認証状態の定義](#認証状態の定義)
	- [AuthContext](#authcontext)
		- [提供する値](#提供する値)
		- [末端ページでの使い方](#末端ページでの使い方)
	- [認証フロー](#認証フロー)
		- [新規登録フロー](#新規登録フロー)
		- [ログインフロー](#ログインフロー)
		- [ログアウトフロー](#ログアウトフロー)
	- [認証 API](#認証-api)
	- [ページ実装パターン](#ページ実装パターン)
		- [認証必須ページ](#認証必須ページ)
		- [未認証専用ページ（ログインページなど）](#未認証専用ページログインページなど)
		- [初期化完了を待つ](#初期化完了を待つ)

## アーキテクチャ

本システムは **Firebase Authentication** と **自前 DB（Prisma）** の二層構造を採用しています。

```
┌─────────────────────────────────────────────────────────┐
│                      クライアント                        │
│  ┌─────────────────────────────────────────────────┐   │
│  │              AuthContext (useAuth)              │   │
│  │  ┌─────────────────┐  ┌─────────────────────┐  │   │
│  │  │  firebaseUser   │  │       user          │  │   │
│  │  │  (Firebase認証) │  │   (DBユーザー)      │  │   │
│  │  └────────┬────────┘  └──────────┬──────────┘  │   │
│  └───────────┼──────────────────────┼─────────────┘   │
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

## AuthContext

認証状態は `AuthContext` で一元管理され、`useAuth()` フックで取得できます。

### 提供する値

**末端ページ用（通常はこれだけ使う）:**

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| `user` | `User \| null` | ログイン中のユーザー（本登録完了済み） |
| `isLoggedIn` | `boolean` | ログイン中か（`user` が存在するか） |
| `initialized` | `boolean` | 認証状態の初期化が完了したか |
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
import { useAuth } from "@/lib/auth";

function DashboardPage() {
  const { user, isLoggedIn } = useAuth();

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

2. AuthContext が自動で反応
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

```tsx
import { useAuth } from "@/lib/auth";
import { Navigate } from "@tanstack/react-router";

function ProtectedPage() {
  const { isLoggedIn, initialized } = useAuth();

  // 初期化完了まで待つ
  if (!initialized) {
    return <LoadingSpinner />;
  }

  // 未認証ならリダイレクト
  if (!isLoggedIn) {
    return <Navigate to="/auth/login" />;
  }

  return <div>認証済みコンテンツ</div>;
}
```

### 未認証専用ページ（ログインページなど）

```tsx
import { useAuth } from "@/lib/auth";
import { useNavigate } from "@tanstack/react-router";

function LoginPage() {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();

  // 既にログイン済みならホームへ
  if (isLoggedIn) {
    navigate({ to: "/" });
    return null;
  }

  return <LoginForm />;
}
```

### 初期化完了を待つ

`initialized` が `false` の間は認証状態が不確定です。リダイレクト判定は `initialized` が `true` になってから行ってください。

```tsx
function App() {
  const { initialized } = useAuth();

  if (!initialized) {
    // 認証状態の初期化中
    return <FullScreenLoader />;
  }

  return <RouterOutlet />;
}
```
