# 認可（ディレクトリ単位のアクセス制御）

このドキュメントは、TanStack Router を使用した**ディレクトリ単位のアクセス制御（認可）**の設計・仕様を定義する。

> **Note**: 認証システムの全体設計は [`docs/auth.md`](../../auth.md) を、
> 認証状態管理の詳細は [`auth.md`](./auth.md) を参照。

---

## 目次
- [認可（ディレクトリ単位のアクセス制御）](#認可ディレクトリ単位のアクセス制御)
	- [目次](#目次)
	- [目的](#目的)
	- [前提](#前提)
	- [ユーザーモデル](#ユーザーモデル)
		- [UserRole](#userrole)
		- [UserStatus](#userstatus)
	- [認証状態の管理](#認証状態の管理)
		- [アーキテクチャ](#アーキテクチャ)
		- [コンポーネントでの使用](#コンポーネントでの使用)
		- [beforeLoad での使用](#beforeload-での使用)
	- [ディレクトリ単位のアクセス制御](#ディレクトリ単位のアクセス制御)
		- [分類](#分類)
	- [ルートガードの判定フロー](#ルートガードの判定フロー)
	- [拒否時の挙動](#拒否時の挙動)
		- [未ログイン](#未ログイン)
		- [権限不足 / DISABLED](#権限不足--disabled)
	- [ルート構成](#ルート構成)
	- [ガード用コンポーネント](#ガード用コンポーネント)
		- [目的](#目的-1)
		- [RoleGuard](#roleguard)
		- [Props](#props)
		- [注意事項](#注意事項)
	- [ヘルパー関数](#ヘルパー関数)
		- [requireAuth](#requireauth)
		- [sanitizeReturnTo](#sanitizereturnto)
	- [実装ファイル](#実装ファイル)

---

## 目的

- 各ページで個別に認可チェックを書かず、**ディレクトリ（親ルート）単位でアクセス制御**を行う
- 認証・認可の実装漏れを**構造的に防止**する
- 将来のロール追加・権限再編に耐えられる設計にする
- ページ内の一部表示制御にも対応できるよう、**ガード用コンポーネント**を用意する

---

## 前提

- ルーティング: TanStack Router（[ルーティングドキュメント](./routing.md)）
- 認証状態管理: Zustand ストア（`useAuthStore`）
- `beforeLoad` では `authReady()` で初期化待機後、`useAuthStore.getState()` から認証状態を取得（React Hook 不要）

---

## ユーザーモデル

### UserRole

ロール間の上下関係は **仕様として定義しない**。各機能・画面ごとに「許可されるロール集合」を明示する。

| ロール | 説明 |
|--------|------|
| `PLANNER` | 企画者 |
| `COMMITTEE_MEMBER` | 委員会メンバー |
| `COMMITTEE_ADMIN` | 委員会管理者 |
| `SYSTEM_ADMIN` | システム管理者 |

### UserStatus

| ステータス | 説明 |
|------------|------|
| `ACTIVE` | 利用可 |
| `DISABLED` | すべての保護対象リソースで拒否 |

> **Note**: `DISABLED` ユーザーはログイン済みであっても保護リソースへのアクセスを許可しない。

---

## 認証状態の管理

認証状態は **Zustand ストア**で管理する。React コンポーネントからも `beforeLoad` からも同じストアにアクセスできる。

### アーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│  Zustand Store (useAuthStore)                           │
│    - user, isLoggedIn, isLoading                        │
│    - signOut(), refreshUser()                           │
└───────────────┬─────────────────────┬───────────────────┘
                │                     │
                ▼                     ▼
        React コンポーネント      beforeLoad
          useAuthStore()              await authReady()
```

### コンポーネントでの使用

```tsx
import { useAuthStore } from "@/lib/auth";

function MyComponent() {
  const { user, isLoggedIn, signOut } = useAuthStore();
  // ...
}
```

### beforeLoad での使用

```tsx
import { requireAuth } from "@/lib/auth";

export const Route = createFileRoute("/project")({
  beforeLoad: async ({ location }) => {
    // authReady() で初期化を待機し、store から認証状態を取得
    await requireAuth(ALLOWED_ROLES, location.pathname);
  },
});
```

---

## ディレクトリ単位のアクセス制御

| ディレクトリ | 認証 | UserStatus | 許可ロール | 備考 |
|-------------|------|------------|------------|------|
| `/auth/*` | 不要 | - | - | ログイン済みは `/` へリダイレクト |
| `/project/*` | 必須 | ACTIVE のみ | `PLANNER`, `COMMITTEE_MEMBER`, `COMMITTEE_ADMIN`, `SYSTEM_ADMIN` | |
| `/committee/*` | 必須 | ACTIVE のみ | `COMMITTEE_MEMBER`, `COMMITTEE_ADMIN`, `SYSTEM_ADMIN` | |
| `/dev/*` | 不要 | - | - | |
| `/forbidden` | 不要 | - | - | |

### 分類

- **guest ディレクトリ**: `/auth` — 認証不要、ログイン済みユーザーはリダイレクト
- **public ディレクトリ**: `/dev`, `/forbidden` — 認証不要
- **保護ディレクトリ**: `/project`, `/committee` — 認証必須 + ロール制御
- 各ディレクトリ配下では、子ページに個別の認証処理を書かない

---

## ルートガードの判定フロー

各保護ディレクトリの親ルート（layout route）の `beforeLoad` で `requireAuth()` を呼び出す。

```
1. 認証初期化待ち
   └─ authReady() で待機（__root.tsx で実行済み）

2. 未ログイン判定
   └─ isLoggedIn === false → /auth/login にリダイレクト
      └─ returnTo クエリに元のパスを付与

3. UserStatus 判定
   └─ user.status !== "ACTIVE" → 拒否（403）

4. UserRole 判定
   └─ user.role が許可ロール集合に含まれない → 拒否（403）

5. すべて通過 → 子ルートを表示
```

---

## 拒否時の挙動

### 未ログイン

`/auth/login?returnTo=<元のパス>` へリダイレクト

```tsx
throw redirect({
  to: "/auth/login",
  search: { returnTo: location.pathname },
});
```

### 権限不足 / DISABLED

`/forbidden` ページへリダイレクト

```tsx
throw redirect({ to: "/forbidden" });
```

> **Note**: 権限不足時にログインページへ戻す挙動は行わない。

---

## ルート構成

```
src/routes/
├── __root.tsx          # ルートレイアウト（authReady() で認証初期化）
├── auth/               # 未認証向けページ群（login, register 等）
│   └── route.tsx       # guest: ログイン済みは "/" へリダイレクト
├── project/            # 企画者向けページ群
│   └── route.tsx       # protected: PLANNER, COMMITTEE_MEMBER, COMMITTEE_ADMIN, SYSTEM_ADMIN
├── committee/          # 委員会向けページ群
│   └── route.tsx       # protected: COMMITTEE_MEMBER, COMMITTEE_ADMIN, SYSTEM_ADMIN
├── forbidden/          # 403 エラーページ
│   └── index.tsx
└── dev/                # 開発・検証用ページ群
```

> **Note**: 認証・認可ロジックは **layout route の `beforeLoad` のみ**に置く。
> 末端ページには認証処理を書かない。

---

## ガード用コンポーネント

### 目的

- ルートガードでは制御できない「ページ内 UI の表示可否」を制御する
- **アクセス可否そのものはルートで決定**し、コンポーネントは表示制御のみ担当

### RoleGuard

**ファイル**: `src/components/auth/RoleGuard/RoleGuard.tsx`

特定のロールを持つユーザーにのみ UI を表示する。

```tsx
import { RoleGuard } from "@/components/auth";

// 管理者のみに表示
<RoleGuard allowedRoles={["COMMITTEE_ADMIN", "SYSTEM_ADMIN"]}>
  <AdminActions />
</RoleGuard>

// 権限がない場合にメッセージを表示
<RoleGuard
  allowedRoles={["SYSTEM_ADMIN"]}
  fallback={<p>この機能を利用する権限がありません</p>}
>
  <SystemSettings />
</RoleGuard>
```

### Props

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| `allowedRoles` | `UserRole[]` | 表示を許可するロール |
| `fallback` | `ReactNode` | 条件を満たさない場合の代替表示（省略時は `null`） |
| `children` | `ReactNode` | 条件を満たす場合に表示する内容 |

### 注意事項

- `RoleGuard` はクライアントサイドの**表示制御のみ**
- 実際の操作権限は **API 側でも必ず検証**する
- セキュリティ上重要な操作は、フロントの表示制御に依存しない

---

## ヘルパー関数

### requireAuth

保護ルートの `beforeLoad` で使用する認可チェック関数。`authReady()` で初期化を待機し、store から認証状態を取得する。

```tsx
import { requireAuth } from "@/lib/auth";

const ALLOWED_ROLES: UserRole[] = ["PLANNER", "COMMITTEE_ADMIN", "SYSTEM_ADMIN"];

export const Route = createFileRoute("/project")({
  beforeLoad: async ({ location }) => {
    await requireAuth(ALLOWED_ROLES, location.pathname);
  },
});
```

### sanitizeReturnTo

`returnTo` パラメータのバリデーション。オープンリダイレクト脆弱性を防ぐ。

```tsx
import { sanitizeReturnTo } from "@/lib/auth";

const redirectTo = sanitizeReturnTo(returnTo); // 不正なURLは "/" に変換
```

---

## 実装ファイル

| ファイル | 説明 |
|---------|------|
| `src/lib/auth/store.ts` | Zustand ストア（認証状態管理）、`authReady()` |
| `src/lib/auth/guard.ts` | `requireAuth`, `sanitizeReturnTo` 関数 |
| `src/lib/auth/index.ts` | エクスポート |
| `src/routes/__root.tsx` | `authReady()` で認証初期化を待機 |
| `src/routes/auth/route.tsx` | `/auth/*` のゲストガード（ログイン済みリダイレクト） |
| `src/routes/project/route.tsx` | `/project/*` のルートガード |
| `src/routes/committee/route.tsx` | `/committee/*` のルートガード |
| `src/routes/forbidden/index.tsx` | 403 Forbidden ページ |
| `src/components/auth/RoleGuard/RoleGuard.tsx` | RoleGuard コンポーネント |
| `src/routes/auth/login/index.tsx` | `returnTo` クエリパラメータ対応 |
