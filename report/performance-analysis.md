# パフォーマンス分析レポート (sos26)

> 作成日: 2026-06-09
> 対象: `apps/web` (React + TanStack Router) / `apps/api` (Hono + Prisma)
> 目的: 「動きがもっさりしている」原因の特定と、改善ポイントの整理

---

## サマリー

体感パフォーマンス低下の主因は、以下の 4 つに集約される。

1. **認証情報・権限情報を毎リクエスト/毎ルート遷移で問い合わせている** （キャッシュ層が無い）
2. **`router.invalidate()` で全ローダーを丸ごと再取得する設計**（特に `/project` 配下の 60 秒ポーリング）
3. **マスターシート系で「全件 fetch → メモリで filter」する Over-fetching**（履歴 / 列定義）
4. **Prisma スキーマで主要 FK にインデックスが無い**（FormCollaborator, NoticeCollaborator, Form.ownerId など）

優先度の高い 3 つを潰すだけで、体感ラグは大きく改善する見込み。

---

## A. ページ全体で改善できる項目（横断的課題）

### A-1. 【最優先】認証 / 権限取得が多すぎる

#### 現状
- `apps/web/src/lib/auth/guard.ts:63` `preloadMemberEditPermission()` が `getMyPermissions()` を呼ぶ
- `apps/web/src/lib/auth/guard.ts:87` `preloadProjectRegistrationPermission()` が **同じ** `getMyPermissions()` を再度呼ぶ
- 上記 2 つは `apps/web/src/routes/committee/route.tsx:19-20` で連続実行されており、**毎回 /me/permissions を 2 回叩いている**
- `apps/web/src/lib/auth/store.ts:59-114` `fetchAndSetUser()` は、ルート遷移ごとに `authReady()` → `getMe()` が走る可能性がある（キャッシュ無し）
- バックエンド `apps/api/src/middlewares/auth.ts:34-36` `requireAuth` が**全リクエストで** `prisma.user.findFirst()` を実行
- さらに `apps/api/src/middlewares/auth.ts:142-143` `requireProjectMember` が**追加で** `prisma.project.findFirst()` を実行
- 同一ハンドラ内で project を再度 fetch するケースもあり、結果として 1 リクエストに 2〜3 回の認証関連クエリが走っている

#### 改善案
1. **フロント**: `getMyPermissions()` を 1 回で全権限を返すように API を集約し、Zustand store に TTL 付きキャッシュ（例: 30 秒）
2. **バックエンド**: `requireAuth` で取得した `user` を Hono の `c.set('user', user)` で context に格納し、後続ミドルウェア（`requireCommitteeMember` / `requireProjectMember`）はそれを参照する。`include: { permissions: true, projectMembers: { include: { project: true } } }` で1クエリにまとめる
3. **DB レベル**: User → CommitteeMemberPermission の lookup を 1 join に統合

**期待効果**: 全エンドポイントでクエリ数 -1〜-2 本、TTFB 約 30–50ms 短縮

---

### A-2. 【最優先】60 秒ポーリングが全ローダーを再取得

#### 現状
- `apps/web/src/routes/project/route.tsx:217-233` で `setInterval(60s)` → `router.invalidate()` を実行
- `router.invalidate()` は **そのルート以下の全ローダーを再実行** するため、`listProjectForms()` / `listProjectNotices()` / `listProjectInquiries()` を 60 秒ごとに丸ごと再取得
- 加えて window focus / visibility リスナー（同 221-226 行）でも同じ invalidate が走る
- 全プロジェクト参加者で同時に発火するため、API 側にも継続的な負荷

#### 改善案
1. **未読件数だけを軽量エンドポイントで返す** (`GET /project/:id/unread-counts` → `{ forms: 3, notices: 0, inquiries: 1 }`)。60 秒間隔のポーリングは未読カウントのみに絞る
2. リスト本体は「ユーザーがそのタブを開いた瞬間」だけ取得（または stale-while-revalidate）
3. focus / visibility での invalidate は重複しないようデバウンス
4. **委員会側 (`/committee/...`) には現状ポーリング機構が無い** ため、こちらは未読カウント用の軽量ポーリングを新設する余地あり

**期待効果**: idle 時の API 呼び出しを 3 本/60秒 → 1 本/60秒（payload 1KB 未満）に削減

---

### A-3. クライアント側キャッシュ層が存在しない

#### 現状
- `apps/web/src/lib/http/client.ts` は素の `ky` クライアントのみ
- TanStack Query / SWR 等の **デデュープ / staleTime / バックグラウンド更新** が無い
- 同じ画面で同じ API を呼ぶと毎回ネットワーク往復が発生

#### 改善案
- TanStack Query 導入（TanStack Router と相性が良い）。最低限以下を共通化
  - `me` / `permissions` → `staleTime: 60_000`
  - リスト系（forms / notices / inquiries）→ `staleTime: 10_000` + window focus refetch
  - master 系の重いデータは `staleTime: 5_000` + 明示 invalidate
- 段階導入が難しければ、まず Zustand に `cache: Map<key, { data, expiresAt }>` の薄いレイヤを置くだけでも効果大

---

### A-4. 「リスト全部再取得」して画面を更新する設計

複数箇所で「1 行追加/更新したら全件再取得」している。

| 場所 | 内容 |
|---|---|
| `apps/web/src/routes/committee/members/index.tsx:441` | メンバー追加後、`listCommitteeMembers()` で全件取り直し |
| `apps/web/src/routes/committee/notice/index.tsx:78` | 通知を既読にしたら `router.invalidate()` で全件再取得 |
| `apps/web/src/routes/project/notice/index.tsx:44-58` | 同上 |
| `apps/web/src/routes/committee/mastersheet/index.tsx:82` | 列追加成功で `router.invalidate()` → マスターシート全再取得 |

#### 改善案
- API レスポンスに**追加/更新された 1 件**を返し、ローカル state を楽観的更新
- 既読化のような副作用は API 成功時点でフロント state を直接書き換える

---

### A-5. Prisma スキーマのインデックス不足

| 場所 | 現状 | 推奨追加 |
|---|---|---|
| `apps/api/prisma/schema.prisma:692-709` `FormCollaborator` | FK インデックスなし | `@@index([formId])`, `@@index([userId])`, `@@index([formId, deletedAt])` |
| `apps/api/prisma/schema.prisma:426-440` `NoticeCollaborator` | 同上 | `@@index([noticeId])`, `@@index([userId])` |
| `apps/api/prisma/schema.prisma:544-578` `Form` | `ownerId` 未インデックス | `@@index([ownerId, deletedAt])` |

これらは「自分が関係するフォーム/通知一覧」表示で必ず使う where 句なので、テーブルが育つほど効いてくる。

---

## B. ページごとに改善できる項目

### B-1. マスターシート `/committee/mastersheet/`

#### 1) データ取得が 7 本のクエリ+過剰 include
- `apps/api/src/routes/committee-mastersheet/data.ts:31-247`
- `allColumns.include`（40 行目）で全列タイプの option / viewer まで毎回 join
- → **列タイプ別に分割して `select` で必要列のみ取得** すれば payload を 60–80% 削減可能

#### 2) 編集履歴の Over-fetching（最も効くポイント）
- `apps/api/src/routes/committee-mastersheet/helpers.ts:281-291` `fetchLatestHistoryByCell()`
- 全履歴を DESC で fetch → JS 側で `(formItemId, projectId)` 単位の最新だけ抽出
- 100 列 × 50 案件で**5000 件以上**を毎回引いている
- → PostgreSQL の `SELECT DISTINCT ON (formItemId, projectId) ... ORDER BY ..., createdAt DESC` または window function `ROW_NUMBER() OVER (PARTITION BY ...)` で**DB 側で最新のみ返す**
- フロント側 `apps/web/src/routes/committee/mastersheet/-components/HistoryPanel.tsx:171` の `batchMastersheetHistory()` + AbortController は良い実装。他箇所も同様にすべき

#### 3) 列追加後の全再取得
- `apps/web/src/routes/committee/mastersheet/index.tsx:82` で `router.invalidate()`
- 巨大データの再ダウンロードを毎回行うため、ボタン押下から再描画まで数秒待たされる
- → POST レスポンスから列定義の差分だけを受け取り、ローカル state にマージ

---

### B-2. 案件登録フォーム履歴 `/project/...`

- `apps/api/src/routes/project.ts:465-495` `projectRegistrationFormItemEditHistory.findMany()`
- 1 案件に対しても全 formItemId 分の履歴を fetch → 497 行目で JS ループ抽出
- B-1 と同じ最適化（`DISTINCT ON` または `ROW_NUMBER`）を適用

---

### B-3. 問い合わせ詳細 `/committee/support/$inquiryId`

- `apps/web/src/routes/committee/support/$inquiryId.tsx:42-59`
- 42 行: `Promise.all` で 3 本並列
- 52 行: その**後**に `getMyPermissions()` を直列で呼んでいる
- → `Promise.all` の中に含めるだけで 1 ラウンドトリップ削減

- 加えてバックエンド `apps/api/src/routes/committee-inquiry.ts:1202-1227` の担当者追加処理で、同一 inquiry に対し 4 本の `findFirst` を順次実行
  - `include` で関連を 1 クエリにまとめる

---

### B-4. フォーム詳細 `/committee/forms/$formId`

- `apps/web/src/routes/committee/forms/$formId/index.tsx:88-92`
- loader で `listFormResponses()` を**常に**実行
- 実際に使うのは `tab === "answers"` 時のみ（177 行目）
- → タブ切替時に lazy load する

---

### B-5. 通知 `/committee/notice` / `/project/notice`

- 既読化の度に `router.invalidate()` で全件再取得（A-4 参照）
- 既読カウントだけ別 API で取れる構造にすれば、未読バッジ更新が軽くなる

---

### B-6. メンバー一覧 `/committee/members`

- `apps/web/src/routes/committee/members/index.tsx:441` 追加後 `listCommitteeMembers()` 全件取り直し
- POST のレスポンスを使った楽観的更新で十分

---

## C. 優先度付き改善ロードマップ

### Phase 1（即効性 / 1〜2 日）
| # | 対応 | 期待効果 |
|---|---|---|
| 1 | `getMyPermissions()` の 2 重呼び出し解消（guard.ts） | 全ルート遷移で /me/permissions が 1 回減る |
| 2 | Prisma スキーマに index 追加（FormCollaborator, NoticeCollaborator, Form.ownerId） | リスト系クエリの p95 を大幅改善 |
| 3 | バックエンド auth middleware で `c.set('user', user)` し、後続ミドルウェアで再 fetch しない | 全 API のレイテンシ -30〜50ms |

### Phase 2（中規模 / 1〜2 週間）
| # | 対応 | 期待効果 |
|---|---|---|
| 4 | `/project` の 60 秒ポーリングを「未読カウント専用エンドポイント」に置換 | 定常 API 負荷を 1/3 以下に |
| 5 | マスターシート編集履歴を `DISTINCT ON` / window function 化 | payload 60–80% 減・初期表示 1–3 秒短縮 |
| 6 | 既読化 / 行追加系を全て楽観的更新に変更 | UI 反応速度の体感が大幅改善 |

### Phase 3（基盤 / 2 週間以上）
| # | 対応 | 期待効果 |
|---|---|---|
| 7 | TanStack Query を導入し、`staleTime` を持つキャッシュ層を構築 | 重複 fetch を自動排除 |
| 8 | マスターシート data.ts を列タイプ別 `select` に分割 | payload さらに削減、TTFB 改善 |
| 9 | 未読カウント API を全画面共通の hook に統一 | 委員会側にも未読バッジを乗せやすくなる |

---

## D. 参考: 主要ファイルマップ

- 認証ガード: `apps/web/src/lib/auth/guard.ts`, `apps/web/src/lib/auth/store.ts`
- HTTP クライアント: `apps/web/src/lib/http/client.ts`
- 認証ミドルウェア: `apps/api/src/middlewares/auth.ts`
- マスターシート: `apps/api/src/routes/committee-mastersheet/{data,helpers}.ts`
- 案件登録フォーム履歴: `apps/api/src/routes/project.ts:465-506`
- 問い合わせ: `apps/api/src/routes/committee-inquiry.ts:1202-1227`
- Prisma スキーマ: `apps/api/prisma/schema.prisma`

---

## 補足

- **計測ベースで判断したい場合**: フロントは Chrome DevTools の Network タブで「ページ遷移 1 回あたりのリクエスト数」、バックエンドは Prisma のクエリログ（`log: ['query']`）か `pg_stat_statements` を有効化して計測すると、改善前後の比較がしやすい
- 本レポートは静的解析ベースのため、ランタイム計測（特に DB の実行計画）と合わせて優先度の再評価を推奨

---

## E. 改善案（具体実装例）

ここからは、A / B 章で挙げた問題点に対する**実装レベルの改善案**をまとめる。コードはあくまでサンプル（型は実プロジェクトに合わせる必要あり）。

---

### E-1. 認証ミドルウェアを 1 クエリに統合する

#### 問題のおさらい
`requireAuth` → `requireCommitteeMember` / `requireProjectMember` がそれぞれ独立に Prisma を叩いており、1 リクエストで 2〜3 本の DB クエリが発生している。

#### 改善案: `requireAuth` で関連を一括ロード

`apps/api/src/middlewares/auth.ts`

```ts
export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  // ... Firebase 検証は同じ ...
  const decodedToken = await auth.verifyIdToken(idToken);

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

  if (!user) throw Errors.notFound("ユーザーが見つかりません");

  c.set("user", user);
  c.set("committeeMember", user.committeeMember ?? null);
  c.set(
    "permissions",
    new Set(user.committeeMember?.permissions.map(p => p.permission) ?? [])
  );

  await next();
});

// 後続は DB を叩かない
export const requireCommitteeMember = createMiddleware<AuthEnv>(async (c, next) => {
  if (!c.get("committeeMember")) throw Errors.forbidden("実委メンバーではありません");
  await next();
});

// 権限チェック専用（汎用化）
export const requirePermission = (permission: CommitteeMemberPermissionType) =>
  createMiddleware<AuthEnv>(async (c, next) => {
    if (!c.get("permissions").has(permission)) throw Errors.forbidden();
    await next();
  });
```

`requireProjectMember` も同様に、`include: { ownerProjects, subOwnerProjects, projectMembers }` を `requireAuth` 段階でロードしておけば、project ロード + メンバーシップ確認を**追加クエリ 0 本**で済ませられる（プロジェクト数が多いユーザーには `where` でフィルタする必要あり）。

**効果**: 全認証ありエンドポイントで -1〜-2 クエリ。Firebase verify (~30ms) と DB クエリは並列化できないが、DB 内の往復は減らせる。

---

### E-2. 権限プリロードを 1 回にまとめる

#### 改善案: API 側を「全権限フラットに返す」設計に統一し、フロントは 1 回だけ呼ぶ

**バックエンド** (`apps/api/src/routes/committee-member.ts`)

```ts
// GET /committee/me/permissions
// レスポンス: { permissions: ["MEMBER_EDIT", "PROJECT_REGISTRATION_FORM_CREATE", ...] }
```

**フロント** (`apps/web/src/lib/auth/guard.ts`)

```ts
// 既存の 2 関数を統廃合
let permissionPreloadPromise: Promise<void> | null = null;

export async function preloadCommitteePermissions(): Promise<void> {
  const { isCommitteeMember } = useAuthStore.getState();
  if (!isCommitteeMember) {
    useAuthStore.setState({
      hasMemberEditPermission: false,
      hasProjectRegistrationPermission: false,
    });
    return;
  }

  // インフライト中の重複呼び出しを dedupe
  if (permissionPreloadPromise) return permissionPreloadPromise;

  permissionPreloadPromise = (async () => {
    try {
      const { permissions } = await getMyPermissions();
      const set = new Set(permissions.map(p => p.permission));
      useAuthStore.setState({
        hasMemberEditPermission: set.has("MEMBER_EDIT"),
        hasProjectRegistrationPermission:
          set.has("PROJECT_REGISTRATION_FORM_CREATE") ||
          set.has("PROJECT_REGISTRATION_FORM_DELIVER"),
        permissionsLoadedAt: Date.now(),
      });
    } finally {
      permissionPreloadPromise = null;
    }
  })();

  return permissionPreloadPromise;
}
```

`apps/web/src/routes/committee/route.tsx:19-20` は次のように 1 行になる。

```ts
beforeLoad: async () => {
  await requireAuth(location.pathname);
  await requireCommitteeMember();
  await preloadCommitteePermissions(); // 旧: 2 関数を直列呼び出し
},
```

**追加で**: store に `permissionsLoadedAt` を持たせ、`Date.now() - permissionsLoadedAt < 60_000` なら fetch をスキップ（手動 invalidate も提供）。

---

### E-3. 軽量「未読カウント」API の新設 + ポーリング基盤の共通化

#### 改善案: 専用エンドポイント `GET /unread-counts`

**バックエンド** (`apps/api/src/routes/unread.ts` 新規)

```ts
// 委員 / 企画メンバー両対応。クライアントは「自分が見える範囲」のカウントを 1 リクエストで取得
app.get("/unread-counts", requireAuth, async c => {
  const user = c.get("user");

  // 集計クエリは全部並列、かつ COUNT のみで row を引かない
  const [forms, notices, inquiries] = await Promise.all([
    prisma.formDelivery.count({
      where: {
        targetUserId: user.id,
        readAt: null,
        form: { deletedAt: null },
      },
    }),
    prisma.noticeRecipient.count({
      where: { userId: user.id, readAt: null, notice: { deletedAt: null } },
    }),
    prisma.inquiry.count({
      where: {
        OR: [{ createdById: user.id }, { assignees: { some: { userId: user.id } } }],
        hasUnreadReply: true,
      },
    }),
  ]);

  return c.json({ forms, notices, inquiries });
});
```

実テーブル名は `prisma/schema.prisma` に合わせて要調整。**鍵は `count` だけで済むこと**と、**この 1 エンドポイントで全画面の未読バッジが賄えること**。

#### フロント: 共通フック

`apps/web/src/lib/hooks/useUnreadCounts.ts` （新規）

```ts
import { useQuery } from "@tanstack/react-query";

export function useUnreadCounts() {
  return useQuery({
    queryKey: ["unread-counts"],
    queryFn: () => httpClient.get("unread-counts").json<UnreadCounts>(),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}
```

#### 既存 60 秒ポーリングの置換

`apps/web/src/routes/project/route.tsx:217-233` の `setInterval(router.invalidate, 60_000)` を**削除**。各タブのバッジは `useUnreadCounts()` を参照する。リスト本体は「タブを開いた瞬間 + window focus 時」だけ refetch する。

**効果**:
- idle 時: 3 本/60秒 + payload 数十KB → 1 本/60秒 + payload <100B
- 委員会側にも同じバッジが乗る

---

### E-4. TanStack Query 導入とキャッシュ戦略

#### セットアップ

`apps/web/src/main.tsx`

```ts
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 1,
    },
  },
});

// <QueryClientProvider client={queryClient}> でラップ
```

#### キャッシュキー設計（推奨）

| データ | queryKey | staleTime | 備考 |
|---|---|---|---|
| 自分のユーザー情報 | `["me"]` | 5 min | ログイン後ほぼ不変 |
| 自分の権限 | `["me", "permissions"]` | 60 sec | 委員ルートで参照 |
| 未読カウント | `["unread-counts"]` | 30 sec | refetchInterval 60s |
| フォーム一覧 | `["forms", { scope: "project" \| "committee" }]` | 10 sec | focus で refetch |
| フォーム詳細 | `["forms", formId]` | 30 sec | |
| フォーム回答一覧 | `["forms", formId, "responses"]` | 30 sec | タブ表示時のみ enabled |
| 通知一覧 | `["notices", { scope }]` | 10 sec | |
| 問い合わせ一覧 | `["inquiries", { scope }]` | 10 sec | |
| マスターシート全体 | `["mastersheet"]` | 5 sec | 編集衝突を考慮し短め |
| マスターシート履歴 | `["mastersheet", "history", cellId]` | 30 sec | パネル開時のみ enabled |

#### Loader との併用（TanStack Router）

TanStack Router の `loader` 内で `queryClient.ensureQueryData()` を呼ぶことで、SSR 風の事前取得とキャッシュ共有が両立できる。

```ts
export const Route = createFileRoute("/committee/forms/$formId/")({
  loader: ({ params, context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["forms", params.formId],
      queryFn: () => getForm(params.formId),
    }),
  component: FormDetail,
});

function FormDetail() {
  const { formId } = Route.useParams();
  const { data } = useSuspenseQuery({
    queryKey: ["forms", formId],
    queryFn: () => getForm(formId),
  });
  // ...
}
```

#### タブ単位の遅延取得

`apps/web/src/routes/committee/forms/$formId/index.tsx` の `listFormResponses()`（loader で常時実行されている問題）は次のように切り出す。

```ts
function ResponsesTab({ formId }: { formId: string }) {
  const { data } = useQuery({
    queryKey: ["forms", formId, "responses"],
    queryFn: () => listFormResponses(formId),
    staleTime: 30_000,
  });
  // ...
}

// tab === "answers" のときだけ <ResponsesTab /> をマウント
```

---

### E-5. 楽観的更新パターン

#### 既読化（通知）

`apps/web/src/routes/committee/notice/index.tsx`

```ts
const queryClient = useQueryClient();
const markAsRead = useMutation({
  mutationFn: (noticeId: string) => markNoticeRead(noticeId),
  onMutate: async noticeId => {
    await queryClient.cancelQueries({ queryKey: ["notices"] });
    const prev = queryClient.getQueryData<Notice[]>(["notices", { scope: "committee" }]);
    queryClient.setQueryData<Notice[]>(["notices", { scope: "committee" }], old =>
      old?.map(n => (n.id === noticeId ? { ...n, isRead: true } : n))
    );
    // 未読カウントも -1
    queryClient.setQueryData<UnreadCounts>(["unread-counts"], old =>
      old ? { ...old, notices: Math.max(0, old.notices - 1) } : old
    );
    return { prev };
  },
  onError: (_e, _id, ctx) => {
    if (ctx?.prev) queryClient.setQueryData(["notices", { scope: "committee" }], ctx.prev);
  },
});
```

#### 行追加（メンバー）

`apps/web/src/routes/committee/members/index.tsx:441` の「追加後 `listCommitteeMembers()` 全件取り直し」は次のように差し替え。

```ts
const addMember = useMutation({
  mutationFn: createCommitteeMember,
  onSuccess: created => {
    queryClient.setQueryData<CommitteeMember[]>(["members"], old =>
      old ? [...old, created] : [created]
    );
  },
});
```

---

### E-6. マスターシート編集履歴を `DISTINCT ON` で取得

#### 問題のおさらい
`apps/api/src/routes/committee-mastersheet/helpers.ts:281-291` で「全履歴を fetch → JS で `(formItemId, projectId)` 単位の最新だけ抽出」している。100 列 × 50 案件で 5000+ 行が毎回飛ぶ。

#### 改善案: PostgreSQL の `DISTINCT ON` を Prisma raw クエリで使う

```ts
// helpers.ts
import { Prisma } from "@prisma/client";

export async function fetchLatestHistoryByCell(
  formItemIds: string[],
  projectIds: string[]
) {
  if (formItemIds.length === 0 || projectIds.length === 0) return [];

  // DISTINCT ON で (formItemId, projectId) ごとに createdAt 最新の 1 行のみ返す
  return prisma.$queryRaw<LatestHistoryRow[]>`
    SELECT DISTINCT ON (h."formItemId", h."projectId")
      h.id, h."formItemId", h."projectId",
      h."valueSnapshot", h."editedById", h."createdAt"
    FROM "FormItemEditHistory" h
    WHERE h."formItemId" = ANY(${formItemIds}::text[])
      AND h."projectId"  = ANY(${projectIds}::text[])
    ORDER BY h."formItemId", h."projectId", h."createdAt" DESC
  `;
}
```

**インデックスも合わせて追加**（`apps/api/prisma/schema.prisma`）

```prisma
model FormItemEditHistory {
  // ...
  @@index([formItemId, projectId, createdAt(sort: Desc)])
}
```

`apps/api/src/routes/project.ts:465-506` の `ProjectRegistrationFormItemEditHistory` も同じパターンで置換できる。

**効果**:
- データ転送量: 5000+ 行 → 5000 セル分の「最新 1 件」（数倍〜数十倍の削減）
- メモリ使用量: JS 側のフィルタリング不要
- TTFB: 1〜3 秒短縮見込み

---

### E-7. マスターシート data.ts を列タイプ別 `select` に分割

#### 改善案: 1 つの巨大 include を 3 本の `select` 並列クエリに分解

```ts
// data.ts
const [formItemColumns, prfColumns, customColumns] = await Promise.all([
  prisma.mastersheetColumn.findMany({
    where: { mastersheetId, type: "FORM_ITEM", deletedAt: null },
    select: {
      id: true, order: true, width: true,
      formItem: {
        select: { id: true, label: true, type: true, options: { select: { id: true, label: true } } },
      },
    },
  }),
  prisma.mastersheetColumn.findMany({
    where: { mastersheetId, type: "PROJECT_REGISTRATION_FORM_ITEM", deletedAt: null },
    select: {
      id: true, order: true, width: true,
      projectRegistrationFormItem: {
        select: { id: true, label: true, type: true },
      },
    },
  }),
  prisma.mastersheetColumn.findMany({
    where: { mastersheetId, type: "CUSTOM", deletedAt: null },
    select: {
      id: true, order: true, width: true, label: true,
      viewers: { select: { userId: true } }, // CUSTOM 列だけ viewer を取得
    },
  }),
]);
```

**ポイント**: 列タイプによって**必要な関連が違う**のに、現状は `include` で全部読んでいる（オプション・viewer・両方の formItem 系）。タイプごとに必要なものだけ取れば payload は劇的に減る。

---

### E-8. Prisma スキーマのインデックス追加

#### 当初案の再検証（実スキーマと突合）

実際の `schema.prisma` を精査したところ、当初案の一部はすでに対策済み、または現行クエリで使われていなかった。**実際に追加が必要なのは 3 行だけ**。

| 当初案 | 実態 | 結論 |
|---|---|---|
| `FormItemEditHistory` 複合 index | **既に存在**（`schema.prisma:1260`） | 不要 |
| `ProjectRegistrationFormItemEditHistory` 複合 index | **既に存在**（`schema.prisma:1314`） | 不要 |
| `FormCollaborator @@index([userId])` 等 | `@@unique([formId, userId])` 既存。`userId` 単独 WHERE のクエリは現行コードに無し | 見送り |
| `NoticeCollaborator @@index([userId])` | 同上 | 見送り |
| `Form @@index([ownerId, deletedAt])` | `Form.findMany` の WHERE は `{ deletedAt: null }` のみで `ownerId` フィルタしていない（`committee-form.ts:402-403`） | 見送り |

#### 追加対象（実クエリ証跡があるもの）

`apps/api/prisma/schema.prisma`

```prisma
model NoticeReadStatus {
  // ... 既存フィールドは変更なし
  @@unique([noticeDeliveryId, userId])
  @@index([userId])   // ← 追加：committee-project.ts:200 等で userId 起点
}

model FormDelivery {
  // ... 既存フィールドは変更なし
  @@unique([formAuthorizationId, projectId])
  @@index([projectId])   // ← 追加：project-form.ts:382, 421。NoticeDelivery と対称化
}

model InquiryAssignee {
  // ... 既存フィールドは変更なし
  @@unique([inquiryId, userId, deletedAt])
  @@index([inquiryId])
  @@index([userId])   // ← 追加：notifyInquiryCommentAdded.ts:16 等で userId 逆引き
}
```

期待 SQL（3 文）:
```sql
CREATE INDEX "NoticeReadStatus_userId_idx" ON "NoticeReadStatus"("userId");
CREATE INDEX "FormDelivery_projectId_idx"  ON "FormDelivery"("projectId");
CREATE INDEX "InquiryAssignee_userId_idx"  ON "InquiryAssignee"("userId");
```

マイグレーション後、本番では `CREATE INDEX CONCURRENTLY` の検討を（テーブルロックを避けるため）。Prisma 標準の migrate は `CONCURRENTLY` を吐かないので、本番反映時は手動で SQL を流すか、`prisma migrate diff` で SQL を出して編集する。なお対象テーブルは中規模なので、そのまま流す選択肢も現実的。

---

### E-9. HTTP クライアントへの軽量 dedupe レイヤ（TanStack Query 導入前の暫定策）

TanStack Query 導入が間に合わない場合の暫定として、`httpClient` ラッパで GET の同時実行を dedupe するだけでもかなり効く。

`apps/web/src/lib/http/dedupe.ts` （新規）

```ts
const inflight = new Map<string, Promise<unknown>>();

export function dedupedGet<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;

  const promise = fetcher().finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}
```

使用例:

```ts
export const getMyPermissions = () =>
  dedupedGet("me/permissions", () =>
    httpClient.get("committee/me/permissions").json<PermissionsResponse>()
  );
```

これだけでも、同一ティック内で 2 回呼ばれている `getMyPermissions()` が 1 リクエストになる。

---

### E-10. バックエンドにリクエスト単位のキャッシュを入れる（オプション）

Hono の context にメモ化を仕込み、同一リクエスト内で同じ Prisma クエリを 2 回叩かないようにする。

```ts
// lib/request-cache.ts
type CacheEntry<T> = { value: T };
export function createRequestCache() {
  const map = new Map<string, CacheEntry<unknown>>();
  return {
    async memo<T>(key: string, fn: () => Promise<T>): Promise<T> {
      const hit = map.get(key);
      if (hit) return hit.value as T;
      const value = await fn();
      map.set(key, { value });
      return value;
    },
  };
}
```

`requireAuth` で `c.set("cache", createRequestCache())` し、ルートハンドラ内で `await c.get("cache").memo(\`project:${id}\`, () => prisma.project.findFirst(...))` のように使う。長期的には不要だが、移行期にはノーリスクで効くショートカット。

---

## F. 改善のロールアウト計画（具体タスク）

### Phase 1 — 1〜2 日（リスク低・即効）

- [ ] E-2: `preloadCommitteePermissions()` への統合 + dedupe（`guard.ts`, `committee/route.tsx`）
- [ ] E-9: GET の dedupe レイヤ追加（`getMyPermissions` / `getMe` 等のキャッシュ対象 API に適用）
- [ ] E-8: Prisma index 追加 + `bun run db:migrate`
- [ ] E-1: `requireAuth` で `committeeMember` / `permissions` を一括ロード、後続ミドルウェアを軽量化

### Phase 2 — 1〜2 週間（中規模）

- [ ] E-3: `GET /unread-counts` 新設 + 共通フック化
- [ ] `/project/route.tsx:217-233` の `setInterval` を削除し、`useUnreadCounts()` に置換
- [ ] E-6: マスターシート履歴を `DISTINCT ON` に置換 + 履歴インデックス追加
- [ ] E-5: 通知既読 / メンバー追加など 4 箇所を楽観的更新に書き換え

### Phase 3 — 2〜4 週間（基盤）

- [ ] E-4: TanStack Query 導入 + キャッシュキー設計の合意
- [ ] 全ルートで loader → `ensureQueryData()` への移行
- [ ] E-7: マスターシート data.ts を列タイプ別 `select` に分割
- [ ] E-10: バックエンドのリクエスト単位キャッシュ（必要に応じて）

### 計測

各 Phase 完了時に以下を取り、ビフォーアフターを残す。

- フロント: 「トップから企画詳細を開くまでに飛ぶリクエスト数 / 累計バイト数 / Largest Contentful Paint」を Chrome DevTools の Network + Performance タブで記録
- バックエンド: Prisma の `log: ['query']` を一時的に ON にし、代表的なエンドポイントの「1 リクエストあたりのクエリ数 / 合計 ms」を記録
- DB: 本番に近いデータで `EXPLAIN ANALYZE` を流し、index が効いているか確認

---

## G. やらないことの整理（過剰最適化を避ける）

参考のため、**いま手をつけなくていい**領域も明示しておく。

- マイクロサービス分割やレイヤ追加（DAO / Repository 等の抽象化）: 効果に対して複雑度が増える
- 全画面の SSR / プリレンダリング化: 認証必須サービスのため恩恵が薄い
- Redis 等の外部キャッシュ導入: まず E-1 / E-3 / E-4 で十分。導入後の計測値で再判断
- WebSocket / SSE による push 化: 未読カウントは 60 秒ポーリングで十分。リアルタイム要件が出てから検討

---

## H. PR 分割計画（優先度順）

一括投入はリスクが高いので、**独立してマージ可能な単位**で 9 本に分割した。上から順に進めるのを推奨。各 PR の依存は「依存」欄に明示。

### 優先順位の方針

ユーザー体感（「もっさり感」）への効きやすさを最優先。具体的には:

1. **ネットワーク往復を確実に減らせるもの**（テーブル規模に依存せず効く）を先に
2. **DB index 追加**は重要だが、現状の sos26 規模だと体感差が小さい可能性があるため、ネットワーク削減系の後に置く
3. **後続 PR の前提になるもの**（auth 簡素化など）は早めに

### 全体マップ

| # | タイトル | 優先度 | 影響範囲 | 推定工数 | 依存 |
|---|---|---|---|---|---|
| PR1 | 権限プリロードの統合 + GET dedupe | ★★★ | Web | 0.5 日 | なし |
| PR2 | Prisma スキーマに index 追加 | ★★★ | DB | 0.5 日 | なし（PR1 と並行可） |
| PR3 | 認証 middleware の include 一括化 | ★★★ | API | 1 日 | なし（PR1/PR2 と並行可） |
| PR4 | 楽観的更新への置換（通知既読/行追加） | ★★ | Web | 1 日 | なし |
| PR5 | 軽量未読カウント API + ポーリング集約 | ★★ | API + Web | 2 日 | PR3 推奨（auth 簡素化後の方が変更が薄い） |
| PR6 | マスターシート履歴を `DISTINCT ON` に | ★★ | API | 1 日 | なし（履歴 index は既存） |
| PR7 | フォーム回答の lazy load 化 | ★ | Web | 0.5 日 | なし |
| PR8 | TanStack Query 導入（基盤のみ） | ★ | Web | 2〜3 日 | PR1 / PR5 のあと |
| PR9 | マスターシート data.ts の `select` 分割 | ★ | API | 2 日 | PR6 のあと |

★★★ = 最優先（リスク低・即効）／ ★★ = 中優先 ／ ★ = 基盤・大きめ

---

### PR1: 権限プリロードの統合 + GET dedupe（★★★）

**目的**: 委員ルート遷移ごとに `/me/permissions` が 2 回飛ぶ問題を解消。**ネットワーク往復を 1 つ確実に消せる** ため、体感への効きが最も大きく分かりやすい。

**変更ファイル**
- `apps/web/src/lib/auth/guard.ts`（2 関数を 1 つに統合）
- `apps/web/src/routes/committee/route.tsx`（呼び出し変更）
- `apps/web/src/lib/http/dedupe.ts`（新規）
- `apps/web/src/lib/api/committee-member.ts`（`getMyPermissions` を dedupe 対応に）
- `apps/web/src/lib/api/me.ts`（`getMe` も dedupe 対応に）
- `apps/web/src/lib/auth/store.ts`（`permissionsLoadedAt` を追加）

**変更内容**
- E-2: `preloadCommitteePermissions()` に統廃合
- E-9: `dedupedGet` ヘルパ追加（同一ティック内の同一キー GET を 1 リクエストに集約）
- `permissionsLoadedAt` を `useAuthStore` に追加し、60 秒以内なら fetch スキップ

**テスト方針**
- 委員ルートに遷移して DevTools Network で `/me/permissions` が 1 回しか飛ばないこと
- 非委員ユーザーで API が飛ばないこと
- 既存テストパス

**計測**
- 委員トップ → 案件詳細などの代表遷移で、Network タブの「Request 数 / Time」を before / after で記録
- 期待: `/me/permissions` の本数が 2 → 1（または 0、キャッシュ範囲内）

**リスク・ロールバック**
- 低（API 変更なし、フロントのみ）
- revert 1 発で戻せる粒度に保つこと

---

### PR2: Prisma スキーマに index 追加（★★★）

**目的**: ネットワーク削減の次の一手として、現行クエリで Seq Scan になっている箇所を Index Scan に。後続 PR5（未読カウント API）の前提でもある。

**スコープ（E-8 のとおり 3 行のみ）**
- `NoticeReadStatus @@index([userId])`
- `FormDelivery @@index([projectId])`（`NoticeDelivery` と対称化）
- `InquiryAssignee @@index([userId])`

> 当初案にあった `FormItemEditHistory` 等の履歴複合 index は**既に存在**（schema.prisma:1260, 1314）。`FormCollaborator.userId` / `Form.ownerId` は現行コードに WHERE 句証跡が無いため見送り。詳細は E-8 参照。

**変更ファイル**
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/*` （自動生成、SQL は 3 文の `CREATE INDEX`）

**手順**
1. `apps/api/prisma/schema.prisma` を編集（E-8 のとおり）
2. `bun run db:migrate` でマイグレーション生成
3. 生成 SQL が 3 文の `CREATE INDEX` のみであることを確認

**テスト方針**
- 既存テスト全パスを確認
- ステージング DB で以下を `EXPLAIN ANALYZE` 実行し、before/after を記録
  ```sql
  EXPLAIN ANALYZE SELECT * FROM "FormDelivery"     WHERE "projectId" = '<実在 id>';
  EXPLAIN ANALYZE SELECT * FROM "NoticeReadStatus" WHERE "userId"    = '<実在 id>';
  EXPLAIN ANALYZE SELECT * FROM "InquiryAssignee"  WHERE "userId"    = '<実在 id>' AND "deletedAt" IS NULL;
  ```
- before: `Seq Scan` / after: `Index Scan using ..._idx`

**リスク・ロールバック**
- 低（index 追加のみ）。問題時は `DROP INDEX` 3 本で即時復旧

**完了条件**
- マイグレーションが本番反映され、`EXPLAIN ANALYZE` で Seq Scan → Index Scan に切り替わる

**本番反映時の注意**
- Prisma migrate は `CREATE INDEX CONCURRENTLY` を生成しない。対象テーブルは中規模のため A 案（そのまま流す）でロック時間は秒未満で許容できる見込み。気になる場合は B 案（手動 SQL で `CONCURRENTLY` に置換）

---

### PR3: 認証 middleware の include 一括化（★★★）

**目的**: 全認証エンドポイントで 2〜3 本走っていた認証関連クエリを 1 本に。

**変更ファイル**
- `apps/api/src/middlewares/auth.ts`
- `apps/api/src/types/auth-env.ts`（`committeeMember`, `permissions` の型追加）
- `requireCommitteeMember` を使っている全ルート（呼び出しは変えない）

**変更内容**: E-1 のとおり。

```ts
// requireAuth で一括ロード
const user = await prisma.user.findFirst({
	where: { firebaseUid: decodedToken.uid, deletedAt: null },
	include: {
		committeeMember: {
			where: { deletedAt: null },
			include: { permissions: { select: { permission: true } } },
		},
	},
});

c.set("user", user);
c.set("committeeMember", user.committeeMember ?? null);
c.set(
	"permissions",
	new Set(user.committeeMember?.permissions.map(p => p.permission) ?? [])
);
```

`requireCommitteeMember` は **DB を叩かない** チェックのみに変更。

**テスト方針**
- 既存の認証テスト（`apps/api/src/middlewares/__tests__/auth.test.ts` 等）が全パス
- Prisma の `log: ['query']` を一時的に ON にして、認証必須エンドポイントで User クエリが 1 回しか走らないこと

**リスク・ロールバック**
- 中（型変更を伴うため、context 経由で読み出している箇所を全件洗い直す必要あり）
- 問題時は revert 一発で戻せる粒度に保つこと

**注意**: `requireProjectMember` の include は別 PR で。プロジェクト数が多いユーザーで N+1 化するリスクがあるため、慎重に分ける。

---

### PR4: 楽観的更新への置換（★★）

**目的**: 既読化や行追加のたびに「全件再取得」している箇所を、楽観的更新で軽くする。

**変更ファイル**
- `apps/web/src/routes/committee/notice/index.tsx`（78 行付近）
- `apps/web/src/routes/project/notice/index.tsx`（44-58 行）
- `apps/web/src/routes/committee/members/index.tsx`（441 行）
- `apps/web/src/routes/committee/mastersheet/index.tsx`（82 行）

**変更内容**
- いったん TanStack Query なしで、ローカル state（`useState` で持つリスト）への楽観的反映に置換
- POST のレスポンスを使って `setState(prev => prev.map / [...prev, created])`
- エラー時は元に戻す + トーストで通知

**テスト方針**
- 既読化操作後、リストが瞬時に反映され、`router.invalidate()` が走らないことを Network で確認
- API 失敗時に元の状態に戻ること

**リスク・ロールバック**
- 中（UI の挙動が変わる）。失敗時の rollback 処理を必ず実装

---

### PR5: 軽量未読カウント API + 60 秒ポーリング集約（★★）

**目的**: `/project/route.tsx:217` の 60 秒 `router.invalidate()` を廃止し、未読バッジ専用 API に集約。

**変更ファイル**
- `apps/api/src/routes/unread.ts`（新規）
- `apps/api/src/index.ts`（ルート登録）
- `apps/web/src/lib/api/unread.ts`（新規）
- `apps/web/src/lib/hooks/useUnreadCounts.ts`（新規 / PR8 前は素の useEffect + setInterval 実装）
- `apps/web/src/routes/project/route.tsx`（217-233 行の `setInterval` を削除）
- 委員会・企画ナビ周辺（バッジ表示を hook に切替）

**変更内容**: E-3 のとおり、`GET /unread-counts` を新設。

**段階導入**
- まず未読件数の表示だけ hook に置換
- 60 秒ポーリングは hook の中に内包
- TanStack Query 導入後（PR8）に `useQuery` ベースに切替

**テスト方針**
- `/project/...` 配下を開いて idle 状態にし、60 秒ごとに `/unread-counts` のみ飛ぶこと（リスト再取得が無いこと）
- バックエンド: `unread-counts` の応答時間が 100ms 未満であること

**リスク・ロールバック**
- 中（UI の挙動が変わる）

---

### PR6: マスターシート履歴を `DISTINCT ON` に（★★）

**目的**: マスターシート開時のもっさり感を解消。一番効くピンポイント PR。

**変更ファイル**
- `apps/api/src/routes/committee-mastersheet/helpers.ts:281-291`
- `apps/api/src/routes/project.ts:465-506`
- 関連テスト

**変更内容**: E-6 のとおり、`$queryRaw` で `DISTINCT ON` を使用。

**前提**
- `FormItemEditHistory` / `ProjectRegistrationFormItemEditHistory` の `@@index([formItemId, projectId, createdAt(sort: Desc)])` は**既に存在**しているため、追加対応不要（schema.prisma:1260, 1314）

**テスト方針**
- 既存の helpers.ts のユニットテストを通す
- 本番相当データでマスターシート初期表示の payload を比較（before/after で 60〜80% 削減を確認）

**リスク・ロールバック**
- 中（Prisma → raw SQL になるため、型安全性が下がる）
- 戻り値型を明示し、Vitest で integration テストを追加すること

---

### PR7: フォーム回答の lazy load 化（★）

**目的**: 委員フォーム詳細を開いた瞬間に走る `listFormResponses()` を、回答タブ表示時に遅延。

**変更ファイル**
- `apps/web/src/routes/committee/forms/$formId/index.tsx`（88-92 / 177 行）

**変更内容**
- loader から `listFormResponses()` を取り除く
- `tab === "answers"` の時だけ `<ResponsesTab />` をマウントし、その中で fetch（PR8 後は `useQuery({ enabled: tab === "answers" })`）

**テスト方針**
- フォーム詳細を開いた直後に `/forms/:id/responses` が飛ばないこと
- 回答タブを開くと初回のみ fetch されること

**リスク・ロールバック**
- 低（局所変更）

---

### PR8: TanStack Query 導入（基盤のみ）（★）

**目的**: 以降のキャッシュ戦略の土台を入れる。**この PR では既存の fetch ロジックを差し替えない**。

**変更ファイル**
- `apps/web/package.json`（`@tanstack/react-query` 追加）
- `apps/web/src/main.tsx`（`QueryClient` / `QueryClientProvider` セットアップ）
- `apps/web/src/lib/query/client.ts`（新規 / queryClient 単体エクスポート）
- TanStack Router の context に queryClient を渡す（`apps/web/src/routes/__root.tsx`）
- `useUnreadCounts` を `useQuery` ベースに移行（最小の動作確認として）

**変更内容**: E-4 のセットアップ部のみ。

**テスト方針**
- 既存挙動が壊れないこと
- DevTools 拡張で `unread-counts` がキャッシュされること

**リスク・ロールバック**
- 中（依存追加 + Provider 配置）
- 既存コードは触らないので revert が容易

**後続 PR（PR8 系列）**: 画面ごとに `useQuery` 化していく。1 ルート = 1 PR を推奨。
- PR8-a: 通知一覧
- PR8-b: フォーム一覧
- PR8-c: 問い合わせ一覧
- PR8-d: マスターシート
- ... など

---

### PR9: マスターシート data.ts の `select` 分割（★）

**目的**: マスターシート初期 payload のさらなる削減。

**変更ファイル**
- `apps/api/src/routes/committee-mastersheet/data.ts:31-247`
- 関連の serializer / 型定義
- フロント側のレスポンス型に追従

**変更内容**: E-7 のとおり、列タイプ別に `select` を分けて並列実行。

**テスト方針**
- 既存のスナップショット / integration テストでレスポンス互換性を担保
- payload サイズ比較

**リスク・ロールバック**
- 中〜高（レスポンス構造の変更を伴うため、フロント側の型と回帰テストが必須）
- フロント側の互換層を 1 リリース挟む or 一括変更するか、レビュー時に決定

---

### マージ順の推奨パターン

```
Week 1 (即効):  PR1 → PR2 → PR3   ※ PR1〜PR3 は依存なし、並列で進めても可
Week 2 (中規模): PR4 → PR5 → PR6 → PR7
Week 3-4 (基盤): PR8 → PR8-a, -b, -c, ... → PR9
```

**重要**: 各 PR マージ後に**簡易計測**（D 章「計測」参照）を取り、次の PR の優先度を再評価する。期待効果が出ていない場合は、その PR の追加調整を後続で挟むことも検討。

---

### 計測テンプレ（各 PR の Description に貼ると良い）

```
## Before / After 計測

### フロント
- 対象画面: /committee/mastersheet
- before: リクエスト数 XX 本 / 合計 XX KB / LCP XX ms
- after:  リクエスト数 XX 本 / 合計 XX KB / LCP XX ms

### バックエンド
- 対象 API: GET /committee/mastersheet/:id/data
- before: クエリ数 XX 本 / 合計 XX ms
- after:  クエリ数 XX 本 / 合計 XX ms
```
