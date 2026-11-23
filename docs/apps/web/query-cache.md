# query cache（TanStack Query）

Web では、画面をまたいで同じ API を取り直さないよう、取得結果を TanStack Query のキャッシュで共有する。

## 1. 構成

### 1.1 QueryClient

キャッシュは `apps/web/src/lib/query/client.ts` の `queryClient` 1つにまとめ、`main.tsx` の `QueryClientProvider` で全画面に渡す。loader やダイアログからはこの `queryClient` を import して使う。

既定の設定は次のとおり。

| 設定 | 値 | 理由 |
|---|---|---|
| `retry` | `false` | GET は HTTP クライアント（ky）で 1 回再試行している |
| `refetchOnWindowFocus` | `false` | `/project` 配下は notification-status の変化を見て取り直す（5 章） |

Firebase のユーザーが替わったとき（サインアウトを含む）は、`lib/auth/store.ts` で `queryClient.clear()` を呼んでキャッシュを捨てる。

### 1.2 キャッシュする API

| 対象 | 定義 | query key | staleTime |
|---|---|---|---|
| 委員の候補（委員メンバー、自分の申請、全企画） | `lib/query/committee.ts` | `["committee", ...]` | 60 秒 |
| 企画の notification-status、企画情報、申請・お知らせ・問い合わせ・メンバーの一覧 | `lib/query/project.ts` | `["project", projectId, 種類]` | 30 秒 |

staleTime のあいだは API を呼ばずにキャッシュを返す。委員の候補は、ほかの委員の操作で変わっても 60 秒までは古いまま使う。

## 2. query の定義

key・取得関数・staleTime は `queryOptions` でまとめ、`lib/query/` に置く。key は `committeeQueryKeys` と `projectQueryKeys` から作り、文字列を直接書かない。

```ts
export const projectFormsQuery = (projectId: string) =>
	queryOptions({
		queryKey: projectQueryKeys.forms(projectId),
		queryFn: () => listProjectForms(projectId),
		staleTime: PROJECT_STALE_TIME,
	});
```

企画の key は先頭を `["project", projectId]` にそろえ、企画ごとにまとめて無効にできるようにする。

## 3. 取得

### 3.1 loader

loader では `queryClient.fetchQuery(query)` を使う。staleTime 内ならキャッシュを返し、過ぎていれば取得を待つ。`ensureQueryData` は staleTime を過ぎたキャッシュもそのまま返すため、loader では使わない。

```ts
loader: async () => {
	const { selectedProjectId } = useProjectStore.getState();
	if (!selectedProjectId) return;
	await queryClient.fetchQuery(projectFormsQuery(selectedProjectId));
},
```

一覧そのものを表示する画面で、開くたびに最新にしたいときは `staleTime: 0` を上書きする。取得結果はキャッシュに入るので、ほかの画面の候補も新しくなる。

```ts
await queryClient.fetchQuery({ ...myFormsQuery, staleTime: 0 });
```

### 3.2 コンポーネント

| 画面で取得結果を書き換えるか | 読み方 |
|---|---|
| 書き換える | loader と同じ query を `useSuspenseQuery` で読む |
| 書き換えない | loader の返り値を `Route.useLoaderData()` で読む |

`useSuspenseQuery` で読むと、4 章の更新がそのまま画面に反映される。

```tsx
const { id: projectId } = useProject();
const { data } = useSuspenseQuery(projectFormsQuery(projectId));
```

loader を持たないダイアログでは、開いたときに `queryClient.fetchQuery(query)` を呼ぶ。

## 4. mutation のあとの更新

更新は query key 単位で行う。画面全体を取り直す `router.invalidate()` だけで済ませると、loader が staleTime 内のキャッシュを返し、更新が反映されない。

### 4.1 応答で一覧を書き換えられるとき

`queryClient.setQueryData` でキャッシュを直接書き換える。申請の回答と、お知らせの既読がこの形である。

```ts
queryClient.setQueryData(projectNoticesQuery(projectId).queryKey, prev =>
	prev && {
		...prev,
		notices: prev.notices.map(n =>
			n.id === noticeId ? { ...n, isRead: true } : n
		),
	}
);
```

### 4.2 書き換えられないとき

`queryClient.invalidateQueries({ queryKey })` で古くし、次に取得するときに取り直させる。次の場合がこれにあたる。

| 操作 | 無効にする key |
|---|---|
| 委員メンバーの追加・削除・所属局と権限の変更 | `committeeQueryKeys.membersPicker` |
| 委員による企画の基本情報の更新 | `committeeQueryKeys.allProjects` |
| 企画メンバーの削除、副企画責任者の任命とリクエストの承認・取り消し・辞退 | `projectQueryKeys.members(projectId)` |
| 問い合わせの作成、問い合わせ詳細を開く | `projectQueryKeys.inquiries(projectId)` |
| 企画情報の保存 | `projectQueryKeys.publicInfo(projectId)` |

### 4.3 loader を取り直させるとき

`router.invalidate()` で loader を再実行するときは、先に `invalidateQueries` に `refetchType: "none"` を付けて対象を古くしておく。古くしておかないと、loader の `fetchQuery` がキャッシュを返す。

```ts
await queryClient.invalidateQueries({
	queryKey: projectQueryKeys.publicInfo(project.id),
	refetchType: "none",
});
await router.invalidate();
```

## 5. `/project` の新着の反映

`/project` のレイアウト（`routes/project/route.tsx`）は、60 秒ごとと、タブに戻ったときに notification-status を `staleTime: 0` で取り直す。前の値から変わっていれば、notification-status 以外の企画の query を 4.3 の形で古くし、`router.invalidate()` で開いている画面を取り直す。

自分の操作で未回答・未確認の状態が変わったときは `refreshNotificationDot()` を呼ぶ。サイドバーのドットだけを取り直し、画面は取り直さない。
