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
	- [認証状態の管理](#認証状態の管理)
		- [アーキテクチャ](#アーキテクチャ)
		- [コンポーネントでの使用](#コンポーネントでの使用)
		- [beforeLoad での使用](#beforeload-での使用)
	- [ディレクトリ単位のアクセス制御](#ディレクトリ単位のアクセス制御)
		- [分類](#分類)
	- [ルートガードの判定フロー](#ルートガードの判定フロー)
	- [拒否時の挙動](#拒否時の挙動)
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

- 各ページで個別に認証チェックを書かず、**ディレクトリ（親ルート）単位でアクセス制御**を行う
- 認証の実装漏れを**構造的に防止**する
- ページ内の一部表示制御にも対応できるよう、**ガード用コンポーネント**を用意する

---

## 前提

- ルーティング: TanStack Router（[ルーティングドキュメント](./routing.md)）
- 認証状態管理: Zustand ストア（`useAuthStore`）
- `beforeLoad` では `authReady()` で初期化待機後、`useAuthStore.getState()` から認証状態を取得（React Hook 不要）
- User モデルにはロール（role）やステータス（status）フィールドは存在しない。委員会メンバーの役割管理は `CommitteeMember` テーブルで行う

---

## 認証・認可状態の管理

認証・認可状態は **Zustand ストア**で管理する。React コンポーネントからも `beforeLoad` からも同じストアにアクセスできる。

### アーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│  Zustand Store (useAuthStore)                           │
│    - user, isLoggedIn, isLoading                        │
│    - committeeMember, isCommitteeMember                 │
│    - signOut(), refreshUser()                           │
└───────────────┬─────────────────────┬───────────────────┘
                │                     │
                ▼                     ▼
        React コンポーネント      beforeLoad
          useAuthStore()              await authReady()
```

`GET /auth/me` のレスポンスに `committeeMember` が含まれるため、追加の API 呼び出しなしで認可判定が可能。

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
// 認証のみ
import { requireAuth } from "@/lib/auth";

export const Route = createFileRoute("/project")({
  beforeLoad: async ({ location }) => {
    await requireAuth(location.pathname);
  },
});
```

```tsx
// 認証 + 委員メンバー限定
import { requireAuth, requireCommitteeMember } from "@/lib/auth";

export const Route = createFileRoute("/committee")({
  beforeLoad: async ({ location }) => {
    await requireAuth(location.pathname);
    await requireCommitteeMember();
  },
});
```

---

## ディレクトリ単位のアクセス制御

| ディレクトリ | 認証 | 認可 | 備考 |
|-------------|------|------|------|
| `/auth/*` | 不要 | — | ログイン済みは `/` へリダイレクト |
| `/project/*` | 必須 | — | |
| `/committee/*` | 必須 | 委員メンバーのみ | 非委員は `/forbidden` へリダイレクト |
| `/dev/*` | 不要 | — | |
| `/forbidden` | 不要 | — | |

### 分類

- **guest ディレクトリ**: `/auth` — 認証不要、ログイン済みユーザーはリダイレクト
- **public ディレクトリ**: `/dev`, `/forbidden` — 認証不要
- **認証のみ保護**: `/project` — ログイン済みであればアクセス可
- **認証＋認可保護**: `/committee` — ログイン済み、かつ委員メンバーのみアクセス可
- 各ディレクトリ配下では、子ページに個別の認証・認可処理を書かない

---

## ルートガードの判定フロー

各保護ディレクトリの親ルート（layout route）の `beforeLoad` でガード関数を呼び出す。

### 認証のみ（`/project` など）

```
1. 認証初期化待ち
   └─ authReady() で待機（__root.tsx で実行済み）

2. 未ログイン判定
   └─ isLoggedIn === false → /auth/login にリダイレクト
      └─ returnTo クエリに元のパスを付与

3. すべて通過 → 子ルートを表示
```

### 認証＋認可（`/committee`）

```
1. requireAuth() — 上記と同じ認証チェック

2. requireCommitteeMember()
   └─ isCommitteeMember === false → /forbidden にリダイレクト

3. すべて通過 → 子ルートを表示
```

> **Note**: `isCommitteeMember` は `GET /auth/me` のレスポンスから設定される。
> `committeeMember` が `null` でなければ `true`。

---

## 拒否時の挙動

| 条件 | リダイレクト先 |
|------|---------------|
| 未ログイン | `/auth/login?returnTo=<元のパス>` |
| ログイン済みだが委員メンバーでない | `/forbidden` |

```tsx
// 未ログイン
throw redirect({
  to: "/auth/login",
  search: { returnTo: location.pathname },
});

// 非委員メンバー
throw redirect({
  to: "/forbidden",
});
```

---

## ルート構成

```
src/routes/
├── __root.tsx          # ルートレイアウト（authReady() で認証初期化）
├── auth/               # 未認証向けページ群（login, register 等）
│   └── route.tsx       # guest: ログイン済みは "/" へリダイレクト
├── project/            # 企画者向けページ群
│   └── route.tsx       # protected: 認証必須
├── committee/          # 委員会向けページ群
│   └── route.tsx       # protected: 認証必須 + 委員メンバー限定
├── forbidden/          # 403 エラーページ
│   └── index.tsx
└── dev/                # 開発・検証用ページ群
```

> **Note**: 認証ロジックは **layout route の `beforeLoad` のみ**に置く。
> 末端ページには認証処理を書かない。

---

## ガード用コンポーネント

### 目的

- ルートガードでは制御できない「ページ内 UI の表示可否」を制御する
- **アクセス可否そのものはルートで決定**し、コンポーネントは表示制御のみ担当

### RoleGuard

**ファイル**: `src/components/auth/RoleGuard/RoleGuard.tsx`

認証済みユーザーにのみ UI を表示する。

```tsx
import { RoleGuard } from "@/components/auth";

// 認証済みユーザーのみに表示
<RoleGuard>
  <UserActions />
</RoleGuard>

// 未認証時にメッセージを表示
<RoleGuard fallback={<p>ログインが必要です</p>}>
  <SystemSettings />
</RoleGuard>
```

### Props

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| `fallback` | `ReactNode` | 条件を満たさない場合の代替表示（省略時は `null`） |
| `children` | `ReactNode` | 認証済みの場合に表示する内容 |

### 注意事項

- `RoleGuard` はクライアントサイドの**表示制御のみ**
- 実際の操作権限は **API 側でも必ず検証**する
- セキュリティ上重要な操作は、フロントの表示制御に依存しない

---

## ヘルパー関数

### requireAuth

保護ルートの `beforeLoad` で使用する認証チェック関数。`authReady()` で初期化を待機し、store から認証状態を取得する。

```tsx
import { requireAuth } from "@/lib/auth";

export const Route = createFileRoute("/project")({
  beforeLoad: async ({ location }) => {
    await requireAuth(location.pathname);
  },
});
```

### requireCommitteeMember

委員メンバー限定ルートの `beforeLoad` で使用する認可チェック関数。`requireAuth` の**後に**呼び出すこと。

store の `isCommitteeMember` が `false` の場合、`/forbidden` にリダイレクトする。

```tsx
import { requireAuth, requireCommitteeMember } from "@/lib/auth";

export const Route = createFileRoute("/committee")({
  beforeLoad: async ({ location }) => {
    await requireAuth(location.pathname);
    await requireCommitteeMember();
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
| `src/lib/auth/store.ts` | Zustand ストア（認証・認可状態管理）、`authReady()` |
| `src/lib/auth/guard.ts` | `requireAuth`, `requireCommitteeMember`, `sanitizeReturnTo` 関数 |
| `src/lib/auth/index.ts` | エクスポート |
| `src/routes/__root.tsx` | `authReady()` で認証初期化を待機 |
| `src/routes/auth/route.tsx` | `/auth/*` のゲストガード（ログイン済みリダイレクト） |
| `src/routes/project/route.tsx` | `/project/*` のルートガード（認証のみ） |
| `src/routes/committee/route.tsx` | `/committee/*` のルートガード（認証＋委員メンバー限定） |
| `src/routes/forbidden/index.tsx` | 403 Forbidden ページ |
| `src/components/auth/RoleGuard/RoleGuard.tsx` | RoleGuard コンポーネント |
| `src/routes/auth/login/index.tsx` | `returnTo` クエリパラメータ対応 |
