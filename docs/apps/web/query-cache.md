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

staleTime のあいだは API を呼ばずにキャッシュを返す。自分の操作による変化は 4 章の更新ですぐに反映し、ほかの人の操作による変化は次の表の時点で反映する。

| 対象 | 定義 | staleTime | ほかの人の操作を反映する時点 |
|---|---|---|---|
| 委員の候補（委員メンバー、自分の申請、全企画） | `lib/query/committee.ts` | 60 秒 | 最大 60 秒後。委員の申請一覧を開いたときは、自分の申請を取り直す |
| 企画の申請・お知らせ・問い合わせの一覧 | `lib/query/project.ts` | 30 秒 | notification-status が変わったとき（5 章） |
| 企画メンバーの一覧 | `lib/query/project.ts` | 30 秒 | メンバー管理画面を開いたとき。問い合わせの担当者の候補では最大 30 秒後 |
| 企画の notification-status | `lib/query/project.ts` | 30 秒 | `/project` の中で画面を移るたびと、60 秒ごと（5 章） |

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

その画面が主に表示する一覧で、ほかの人の操作をすぐに反映したいときは、`staleTime: 0` を上書きして開くたびに取り直す。取得結果はキャッシュに入るので、ほかの画面の候補も新しくなる。委員の申請一覧と企画メンバーの管理画面がこの形である。

```ts
await queryClient.fetchQuery({ ...myFormsQuery, staleTime: 0 });
```

### 3.2 コンポーネント

| 画面の形 | 読み方 | 例 |
|---|---|---|
| キャッシュの一覧を表示し、画面で書き換える | loader と同じ query を `useSuspenseQuery` で読み、4.1 の形で書き換える | 企画の申請一覧、お知らせ一覧 |
| 開くたびに取り直し、画面で書き換える | loader の返り値を state に移して書き換え、4.2 の形でキャッシュを古くする | 企画メンバーの管理画面 |
| 書き換えない | loader の返り値を `Route.useLoaderData()` で読む | 問い合わせ一覧 |

`useSuspenseQuery` に渡す企画 ID には、`useProjectStore` の値ではなく loader が返した値を使う。企画を切り替えた直後は、新しい loader が終わる前に画面が描画し直される。このときストアの企画 ID を使うと、キャッシュのない企画の一覧を待つあいだ `/project` 全体が表示されなくなる。

```tsx
loader: async () => {
	const { selectedProjectId } = useProjectStore.getState();
	if (selectedProjectId) {
		await queryClient.fetchQuery(projectFormsQuery(selectedProjectId));
	}
	return { projectId: selectedProjectId };
},
```

```tsx
function RouteComponent() {
	const { projectId } = Route.useLoaderData();
	return projectId ? <ProjectFormsPage projectId={projectId} /> : null;
}

function ProjectFormsPage({ projectId }: { projectId: string }) {
	const { data } = useSuspenseQuery(projectFormsQuery(projectId));
	// ...
}
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
| 申請の編集・共同編集者と閲覧者の変更・承認など、申請詳細を取り直す操作 | `committeeQueryKeys.myForms` |
| 委員による企画の基本情報の更新 | `committeeQueryKeys.allProjects` |
| 企画メンバーの削除、副企画責任者の任命とリクエストの承認・取り消し・辞退 | `projectQueryKeys.members(projectId)` |
| 問い合わせの作成、問い合わせ詳細を開く | `projectQueryKeys.inquiries(projectId)` |

取得中の query を無効にすると、その取得が成功した時点で無効が打ち消される。問い合わせ詳細のように、取得と同時に状態が変わる操作では、取得を待ってから無効にする。

### 4.3 loader を取り直させるとき

`router.invalidate()` で loader を再実行するときは、先に `invalidateQueries` に `refetchType: "none"` を付けて対象を古くしておく。古くしておかないと、loader の `fetchQuery` がキャッシュを返す。

```ts
await queryClient.invalidateQueries({
	queryKey: projectQueryKeys.all(projectId),
	predicate: q => q.queryKey[2] !== "notification-status",
	refetchType: "none",
});
void router.invalidate();
```

## 5. `/project` の新着の反映

`/project` のレイアウト（`routes/project/route.tsx`）は、次の時点で notification-status を `staleTime: 0` で取り直し、キャッシュにあった前回の値と比べる。

| 時点 | 変わっていたときの処理 |
|---|---|
| `/project` の中で画面を移るとき（`beforeLoad`） | notification-status 以外の企画の query を古くする。続く子ルートの loader が一覧を取り直す |
| 60 秒ごとと、タブに戻ったとき | 同じく古くしたうえで `router.invalidate()` を呼び、開いている画面を取り直す |

`beforeLoad` で比べるのは、TanStack Router が親と子の loader を並列に実行するためである。親の loader で古くしても、同じ遷移の子の loader には間に合わない。

自分の操作で未回答・未確認の状態が変わったときは `refreshNotificationDot()` を呼ぶ。サイドバーのドットを取り直し、開いている画面は取り直さない。
