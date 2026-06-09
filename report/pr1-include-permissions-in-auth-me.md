# PR1: `/auth/me` に permissions を統合（旧 PR1 + PR3 を統合）

> 親レポート: [performance-analysis.md](./performance-analysis.md)
> ブランチ: `perf/include-permissions-in-auth-me`
> 推定工数: 1〜1.5 日（実装）+ 計測込みで 2 日

---

## 1. 背景

`performance-analysis.md` で挙げた「もっさり感」の最も体感に効く原因は、**ネットワーク往復の削減**。

当初の PR1（権限プリロードの統合）と PR3（auth middleware の include 一括化）を別 PR としていたが、設計判断を再検討した結果、**両者をまとめて 1 PR にした方が合理的**と判断した。

理由:

- 現状の `/auth/me` レスポンスには `user` と `committeeMember` しか含まれず、**権限を知るには別途 `/me/permissions` を叩く必要がある**。これが「ルート遷移ごとに権限取得が 2 本飛ぶ」問題の構造的原因
- バックエンドの auth middleware を `include` で一括化（旧 PR3）すると、その成果物をそのまま `/auth/me` のレスポンスに乗せられる
- フロントの権限プリロード（旧 PR1）は、`/auth/me` が permissions まで返すならそもそも**不要**になる
- 2 PR に分けるとフロント側を 2 回触ることになり、レビュー・テストの労力も増える

→ 1 PR にまとめることで、**「権限取得 API を構造的に廃止する」** という一段上の効果が得られる。

---

## 2. 課題

### 2-1. `/auth/me` に permissions が含まれていない

- `apps/api/src/routes/auth.ts:262-270` の `GET /auth/me` レスポンス: `{ user, committeeMember: CommitteeMember | null }`
- 権限を知るには `GET /committee/members/me/permissions` を別途叩く必要がある
- フロント側はこのため preload 関数を 2 つ用意し、委員ルートに入るたびに権限を fetch する設計を強いられている

### 2-2. 委員ルート遷移ごとに `/me/permissions` が 2 回飛ぶ

`apps/web/src/routes/committee/route.tsx:19-20`:
```ts
await preloadMemberEditPermission();         // GET /me/permissions
await preloadProjectRegistrationPermission(); // GET /me/permissions （重複）
```
両関数は同じ API を呼び、得られた permissions 配列から別々のフラグを設定している。

### 2-3. 認証 middleware が同じ User を毎リクエストで再 fetch している

- `apps/api/src/middlewares/auth.ts:34-36` の `requireAuth` が `prisma.user.findFirst()` を毎リクエストで実行
- `apps/api/src/middlewares/auth.ts:113-115` の `requireCommitteeMember` が `prisma.committeeMember.findFirst()` を**さらに**実行
- 結果、認証付きエンドポイント 1 リクエストで User クエリ 1 本 + CommitteeMember クエリ 1 本（権限取得時はさらに +1 本）

### 2-4. 他の `getMyPermissions()` 利用箇所

- `apps/web/src/routes/committee/support/$inquiryId.tsx:52` でも独立して呼ばれている
- 案 D により、ログイン時に store に permissions が格納されるため**この箇所も store 参照に置き換え可能**（追加の API 呼び出し不要）

---

## 3. 改善案・実装方法

### 3-1. 設計

#### A. shared スキーマ拡張

`getMeResponseSchema` に `permissions: CommitteePermission[]` を追加。非委員ユーザーは空配列を返す。

#### B. バックエンド: auth middleware の include 一括化

- `requireAuth` で User を `include: { committeeMember: { include: { permissions: ... }}}` で取得
- 取得した値を context に格納: `c.set("user", ...)`, `c.set("committeeMember", ...)`, `c.set("permissions", ...)`
- `requireCommitteeMember` は context 参照のみで DB を叩かない
- `GET /auth/me` ハンドラは context の値をそのまま返すだけ（DB クエリ 0 本）

→ 認証付きリクエスト全体で User 関連クエリが **1 本に集約**される。

#### C. フロント: 権限プリロード機構を廃止

- `useAuthStore` に `permissions: Set<CommitteePermission> | null` を追加
- `fetchAndSetUser()`（`store.ts:59-114`）で `/auth/me` のレスポンスから `permissions` を Set 化して store に格納
- 旧 `hasMemberEditPermission` / `hasProjectRegistrationPermission` は **削除**
- 旧 `preloadMemberEditPermission` / `preloadProjectRegistrationPermission` は **削除**
- Sidebar 等は `useAuthStore(s => s.permissions?.has("MEMBER_EDIT") ?? false)` のように selector で参照

> **dedupe レイヤは本 PR には含めない**。案 D では `/auth/me` 呼び出し元が `store.fetchAndSetUser()` 1 箇所に集約され、かつ `authReady()` の `readyPromise` 機構（`store.ts:120-141`）で既に重複起動が防がれているため、HTTP レイヤでの dedupe は不要。将来的に呼び出し元が増えた場合や TanStack Query 導入時（PR8）に検討する。

### 3-2. 変更ファイル一覧

| ファイル | 種別 | 内容 |
|---|---|---|
| `packages/shared/src/schemas/auth.ts` | 変更 | `getMeResponseSchema` に `permissions` を追加 |
| `apps/api/src/middlewares/auth.ts` | 変更 | `requireAuth` で `include`、`requireCommitteeMember` の DB 削除 |
| `apps/api/src/types/auth-env.ts` | 変更 | context に `permissions: Set<CommitteePermission>` を追加、`committeeMember` を nullable に |
| `apps/api/src/routes/auth.ts` | 変更 | `GET /auth/me` を context 参照のみに |
| `apps/api/src/middlewares/__tests__/auth.test.ts` 等 | 変更 | モック型と期待値を更新 |
| `apps/web/src/lib/auth/store.ts` | 変更 | `permissions` を保持、旧フラグ削除 |
| `apps/web/src/lib/auth/guard.ts` | 変更 | 旧 preload 2 関数を削除 |
| `apps/web/src/lib/auth/index.ts` | 変更 | export 整理 |
| `apps/web/src/routes/committee/route.tsx` | 変更 | preload 呼び出しを削除 |
| `apps/web/src/routes/settings/route.tsx` | 変更 | 同上 |
| `apps/web/src/components/layout/Sidebar/Sidebar.tsx` | 変更 | `hasMemberEditPermission` 等の参照を `permissions.has(...)` に |
| `apps/web/src/routes/committee/support/$inquiryId.tsx` | 変更 | `getMyPermissions()` 呼び出しを store 参照に置換 |

> **`GET /committee/members/me/permissions` 自体は残す**（他人の権限を見る `/:id/permissions` と内部実装を共有しているケースもあり、無理に削除しない）。フロントからは呼ばれなくなる。

### 3-3. 実装スケッチ

#### `packages/shared/src/schemas/auth.ts`

```ts
import { committeePermissionSchema } from "./committee-member";

export const getMeResponseSchema = z.object({
	user: userSchema,
	committeeMember: committeeMemberSchema.nullable(),
	permissions: z.array(committeePermissionSchema), // ← 追加（非委員は空配列）
});
export type GetMeResponse = z.infer<typeof getMeResponseSchema>;
```

#### `apps/api/src/types/auth-env.ts`

```ts
import type { CommitteeMember, Project, User } from "@prisma/client";
import type { CommitteePermission } from "@sos26/shared";

export type ProjectRole = "OWNER" | "SUB_OWNER" | "MEMBER";

export type AuthEnv = {
	Variables: {
		user: User;
		regTicketRaw: string;
		committeeMember: CommitteeMember | null; // ← nullable に変更
		permissions: Set<CommitteePermission>;   // ← 追加
		project: Project;
		projectRole: ProjectRole;
	};
};
```

#### `apps/api/src/middlewares/auth.ts`

```ts
export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
	// ... 既存の Firebase 検証部分は変更なし
	const decodedToken = await auth.verifyIdToken(idToken);
	firebaseUid = decodedToken.uid;

	const user = await prisma.user.findFirst({
		where: { firebaseUid: decodedToken.uid, deletedAt: null },
		include: {
			committeeMember: {
				where: { deletedAt: null },
				include: {
					permissions: { select: { permission: true } },
				},
			},
		},
	});

	if (!user) {
		// ... 既存のロギング
		throw Errors.notFound("ユーザーが見つかりません");
	}

	const { committeeMember, ...userBase } = user;

	c.set("user", userBase);
	c.set("committeeMember", committeeMember ?? null);
	c.set(
		"permissions",
		new Set(committeeMember?.permissions.map(p => p.permission) ?? [])
	);

	// ... 既存のエラーハンドリング
	await next();
});

// DB を叩かない軽量チェックに
export const requireCommitteeMember = createMiddleware<AuthEnv>(
	async (c, next) => {
		if (!c.get("committeeMember")) {
			throw Errors.forbidden("実委メンバーではありません");
		}
		await next();
	}
);
```

> `requireProjectMember` は本 PR の対象外。プロジェクト数が多いユーザーで N+1 のリスクがあるため別 PR で扱う（performance-analysis.md E-1 の注記参照）。

#### `apps/api/src/routes/auth.ts`

```ts
authRoute.get("/me", requireAuth, async c => {
	return c.json({
		user: c.get("user"),
		committeeMember: c.get("committeeMember"),
		permissions: Array.from(c.get("permissions")),
	});
});
```

→ 既存の `prisma.committeeMember.findFirst()` を削除。**ハンドラ内 DB クエリ 0 本**。

#### `apps/web/src/lib/auth/store.ts`（差分のみ）

```ts
type AuthStore = {
	user: User | null;
	committeeMember: CommitteeMember | null;
	permissions: Set<CommitteePermission> | null;   // ← 追加
	// hasMemberEditPermission / hasProjectRegistrationPermission は削除
	activePortal: "project" | "committee" | null;
	firebaseUser: FirebaseUser | null;
	isLoading: boolean;
	isLoggedIn: boolean;
	isCommitteeMember: boolean;
	isFirebaseAuthenticated: boolean;
	setActivePortal: (portal: "project" | "committee") => void;
	signOut: () => Promise<void>;
	refreshUser: () => Promise<void>;
};

const UNAUTHENTICATED_STATE = {
	user: null,
	committeeMember: null,
	permissions: null,                              // ← 追加
	activePortal: null,
	isLoggedIn: false,
	isCommitteeMember: false,
} as const;

// fetchAndSetUser 内
const response = await getMe();
useAuthStore.setState({
	user: response.user,
	committeeMember: response.committeeMember,
	permissions: new Set(response.permissions),     // ← 追加
	isLoggedIn: true,
	isCommitteeMember: !!response.committeeMember,
});
```

#### `apps/web/src/lib/auth/guard.ts`

```ts
// preloadMemberEditPermission, preloadProjectRegistrationPermission は丸ごと削除

// requireAuth, requireCommitteeMember, ForbiddenError, sanitizeReturnTo はそのまま
```

#### `apps/web/src/lib/auth/index.ts`

```ts
export { ForbiddenError, requireAuth, requireCommitteeMember, sanitizeReturnTo } from "./guard";
export { authReady, useAuthStore } from "./store";
```

#### `apps/web/src/routes/committee/route.tsx`

```ts
beforeLoad: async ({ location }) => {
	await requireAuth(location.pathname);
	await requireCommitteeMember();
	useAuthStore.getState().setActivePortal("committee");
	// preload 2 関数の呼び出しは削除
},
```

#### `apps/web/src/routes/settings/route.tsx`

```ts
beforeLoad: async ({ location }) => {
	await requireAuth(location.pathname);
	// preloadMemberEditPermission の呼び出しは削除
},
```

#### `apps/web/src/components/layout/Sidebar/Sidebar.tsx`

```ts
const { isCommitteeMember, permissions, signOut } = useAuthStore();
const hasMemberEditPermission = permissions?.has("MEMBER_EDIT") ?? false;
const hasProjectRegistrationPermission =
	permissions?.has("PROJECT_REGISTRATION_FORM_CREATE") === true ||
	permissions?.has("PROJECT_REGISTRATION_FORM_DELIVER") === true;
// 以降の visibleMenuItems のフィルタ条件は !== true ではなく単純な false 判定に
```

→ `permissions === null` を「未確定」、空 Set / 該当 permission 無しを「権限なし」と扱う。**ログイン直後だけ `null` になるので、その間メニュー項目が一瞬出てしまうのを防ぐ**には Sidebar 側で `permissions === null` の場合は「（読込中＝表示しない）」扱いにする。

#### `apps/web/src/routes/committee/support/$inquiryId.tsx`

```ts
// loader 内
const { committeeMember, permissions } = useAuthStore.getState();
const isAdmin = permissions?.has("INQUIRY_ADMIN") ?? false;
// getMyPermissions() の呼び出しは削除
```

### 3-4. 実装手順

1. **shared パッケージ**: `getMeResponseSchema` に `permissions` 追加
2. **API**:
   - `types/auth-env.ts` を更新
   - `middlewares/auth.ts` の `requireAuth` を include 化、`requireCommitteeMember` を軽量化
   - `routes/auth.ts` の `/auth/me` ハンドラを context 参照に
   - 既存テストの型を直す
3. **フロント**:
   - `store.ts` の型と setState を更新
   - `guard.ts` の preload 関数 2 つを削除
   - `auth/index.ts` の export 整理
   - `committee/route.tsx`, `settings/route.tsx` の beforeLoad から preload 呼び出しを削除
   - `Sidebar.tsx` の参照を permissions Set ベースに変更
   - `support/$inquiryId.tsx` の `getMyPermissions()` 呼び出しを置換
4. `bun run typecheck && bun run lint && bun run test:run` を全パッケージで通過確認
5. ローカル動作確認（4. 求める結果 参照）
6. PR 作成

---

## 4. 求める結果

### 4-1. 直接の効果

| 操作 | before | after |
|---|---|---|
| ログイン直後（`/auth/me` 1 回） | `/auth/me` 1 本 + その後の委員ルート遷移で `/me/permissions` × 2 | `/auth/me` 1 本のみ。`/me/permissions` は**全く飛ばない** |
| 委員ルート遷移 | `/me/permissions` × 2 直列 | **0 本**（store にキャッシュ済み） |
| 委員ルート内のサブルート遷移 | `/me/permissions` × 2 ごとに | **0 本** |
| support 詳細ページオープン | `/me/permissions` × 1 追加 | **0 本** |

### 4-2. バックエンド側の効果

| エンドポイント | before のクエリ数 | after のクエリ数 |
|---|---|---|
| 認証付き全エンドポイント（middleware） | User findFirst（1） | User findFirst with include（1、permissions まで取得） |
| `GET /auth/me` ハンドラ | CommitteeMember findFirst（middleware と合わせて 2） | **0**（context 参照のみ） |
| `GET /committee/...`（requireCommitteeMember 経由） | CommitteeMember findFirst（middleware と合わせて 2） | **0**（context 参照のみ） |

→ 認証付きリクエスト全体で **User クエリ 1 本に集約**。

### 4-3. やらないこと

- `requireProjectMember` の include 化（別 PR）
- `GET /committee/members/me/permissions` の廃止（他人の権限を見るエンドポイントと内部共有しているため温存）
- 未読カウント API（PR5）
- TanStack Query 導入（PR8）

---

## 5. 計測方法

### 5-1. ローカル目視確認（最低限）

1. dev サーバ起動: `bun run dev`
2. Chrome DevTools の Network タブを開き、`Fetch/XHR` でフィルタ
3. **before（main ブランチ）**:
   - ログイン → 委員トップ表示で `/auth/me` × 1 + `/me/permissions` × 2 を確認
   - 委員配下を 5 回サブルート遷移で `/me/permissions` × 10 を確認
4. **after（このブランチ）**:
   - ログイン → 委員トップ表示で `/auth/me` × 1 のみ、`/me/permissions` は **0**
   - 委員配下を 5 回サブルート遷移で `/me/permissions` は **0**

### 5-2. 代表シナリオの計測

| シナリオ | 計測項目 |
|---|---|
| ログイン → 委員トップ表示 | `/auth/me` レスポンス時間、`/me/permissions` の本数 |
| 委員配下のサブルート 5 連続遷移 | `/me/permissions` 本数（期待: 0） |
| support 詳細ページを開く | 同タイミングで `/me/permissions` の本数（期待: 0） |
| API レイテンシ（任意の認証付きエンドポイント） | TTFB の中央値（n=10） |

### 5-3. バックエンド計測

`apps/api/src/lib/prisma.ts` で一時的にクエリログ ON にし、認証付きエンドポイントの「1 リクエストあたりの User/CommitteeMember クエリ数」を before/after で記録。

```ts
export const prisma = new PrismaClient({
	log: [{ emit: "event", level: "query" }],
});
prisma.$on("query", e => {
	if (/User|CommitteeMember/.test(e.query)) console.log(e.duration, e.query.slice(0, 80));
});
```

### 5-4. PR description 用テンプレ

```markdown
## Before / After

### ログイン → 委員トップ表示
- before: `/auth/me` × 1 + `/me/permissions` × 2
- after:  `/auth/me` × 1 のみ

### 委員配下 5 連続遷移
- before: `/me/permissions` × XX 本 / 合計 XX ms
- after:  `/me/permissions` × **0 本**

### support 詳細ページオープン
- before: 同タイミングで `/me/permissions` × XX
- after:  同タイミングで `/me/permissions` × 0

### バックエンド（認証付きエンドポイント）
- before: User クエリ XX 本 + CommitteeMember クエリ XX 本
- after:  User クエリ 1 本（include 込み）
```

---

## 6. テスト方針

### 6-1. 既存テスト

- `bun run test:run` 全パス
- `bun run typecheck` 全パス（`AuthStore` / `AuthEnv` の型変更が広く波及するので影響大）
- `bun run lint` 全パス
- `apps/api/src/routes/auth.test.ts` の `/auth/me` の期待値を更新

### 6-2. 追加テスト

#### auth middleware のテスト

- 委員ユーザーで `c.get("permissions")` に正しい Set が入ること
- 非委員ユーザーで `c.get("committeeMember")` が null、`c.get("permissions")` が空 Set
- `requireCommitteeMember` が context を見るだけで動作（DB モック呼び出し回数が 0 であること）

### 6-3. 手動 E2E 確認項目

- [ ] 委員ユーザーでログイン → サイドバーのメンバー編集 / 企画登録メニューが正しく表示される
- [ ] 非委員ユーザーでログイン → サイドバーのメンバー編集 / 企画登録メニューが非表示
- [ ] 委員ユーザーで権限剥奪後 → ログアウト/再ログインまたは refreshUser で反映
- [ ] support 詳細ページの INQUIRY_ADMIN フラグが正しく機能（権限あり/なしのユーザーで違いを確認）
- [ ] settings ページが正しく表示される（旧 preload に依存していないこと）
- [ ] DevTools Network で `/me/permissions` がフロントから呼ばれなくなっていること
- [ ] 認証エラー（無効トークン）時のフロー、未登録ユーザーのフローは変わらない

---

## 7. リスク評価

| 項目 | 評価 | 根拠 |
|---|---|---|
| データ破損 | なし | クエリは findFirst の include 化のみ |
| API 互換性 | 軽微 | `getMeResponseSchema` にフィールド追加のみ（破壊的でない） |
| 既存挙動の変更 | 軽微 | 権限フラグの判定タイミングが変わる（ログイン直後に確定するため、むしろ改善） |
| 型変更の波及 | **大** | `AuthEnv` の `committeeMember: CommitteeMember` → `CommitteeMember \| null`、フロント `AuthStore` の派生フラグ削除。typecheck で全件洗い直しが必要 |
| キャッシュ起因のバグ | 中 | 権限変更が即時反映されない（再ログインまたは `refreshUser()` が必要）。ただし運用上問題になる頻度は低い |
| ロールバック容易性 | 中 | revert 1 発で戻せるが、型変更を伴うため後続 PR との衝突に注意 |
| committeeMember 後ヌル化リスク | 軽微 | `c.get("committeeMember")` を non-null として扱っている既存ハンドラは `requireCommitteeMember` 経由のみ。同 middleware が forbidden を投げた後しか呼ばれないので、TypeScript の non-null 保証が必要なら `c.get("committeeMember")!` で対処 |

---

## 8. レビューチェックリスト

- [ ] `getMeResponseSchema` に `permissions` が追加されている
- [ ] `requireAuth` が `include` で committeeMember + permissions まで一括取得している
- [ ] `requireCommitteeMember` が DB を叩かない実装になっている
- [ ] `GET /auth/me` ハンドラに Prisma クエリが残っていない
- [ ] 旧 `preloadMemberEditPermission` / `preloadProjectRegistrationPermission` が完全に削除されている（互換シム残置なし）
- [ ] 旧 `hasMemberEditPermission` / `hasProjectRegistrationPermission` フィールドが store から削除されている
- [ ] `auth/index.ts` の export 整理済み
- [ ] `Sidebar.tsx` が `permissions` Set ベースで判定している
- [ ] `support/$inquiryId.tsx:52` の `getMyPermissions()` 呼び出しが削除されている
- [ ] 非委員ユーザでも `permissions` が空 Set として扱われ、null 参照エラーが起きない
- [ ] DevTools Network で before/after の差分が PR description に記録されている
- [ ] 既存テストパス
- [ ] auth.test.ts の `/auth/me` 期待値が更新されている

---

## 9. PR 作成テンプレ

```markdown
## Summary
- パフォーマンス改善（Phase 1 / PR1）
- `GET /auth/me` のレスポンスに `permissions` を含めることで、フロントの権限プリロード機構を構造的に廃止
  - shared: `getMeResponseSchema` に `permissions` を追加
  - api: `requireAuth` で User + committeeMember + permissions を 1 クエリで取得し context に格納、`requireCommitteeMember` / `/auth/me` ハンドラの DB クエリを削除
  - web: `preloadMemberEditPermission` / `preloadProjectRegistrationPermission` を削除、`useAuthStore` に `permissions: Set<CommitteePermission>` を保持、Sidebar 等は selector で参照
- 親レポート: report/performance-analysis.md / 設計: report/pr1-include-permissions-in-auth-me.md

## Why
- 「動きがもっさり」原因調査の Phase 1。
- 委員ルート遷移ごとに `/committee/members/me/permissions` が 2 本直列で飛ぶ構造的問題を、API 仕様を見直すことで根本的に解消。
- 認証付きリクエストの DB クエリも 1 本に集約（User include 化）。

## Before / After
（5-4 のテンプレに従って計測値を貼付）

## Test plan
- [ ] `bun run typecheck && bun run test:run && bun run lint` 通過
- [ ] auth.test.ts の `/auth/me` 期待値更新
- [ ] 委員 / 非委員ユーザでサイドバー権限表示が変わらないこと
- [ ] support 詳細ページの INQUIRY_ADMIN フラグが機能すること
- [ ] DevTools Network で `/me/permissions` がフロントから呼ばれていないこと

## Rollback
revert 1 発（型変更の波及に注意）。
```
