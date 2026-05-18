# 企画選択に関する不具合と対応策

複数企画に所属しているユーザーで発生する、企画選択に関する2つの不具合とその対応策をまとめる。

## 問題1: リロードすると index 0 の企画に戻る

### 現象

複数企画に所属しているユーザーが、企画A（index 1以降）を選択している状態でページをリロードすると、選択企画が企画B（index 0）に戻ってしまう。

### 原因

`apps/web/src/lib/project/store.ts` の Zustand store がメモリ内のみで動作し、永続化されていない。リロード時に `selectedProjectId` が `null` にリセットされる。

`apps/web/src/routes/project/route.tsx:111-118` の `beforeLoad`:

```ts
const currentId = store.selectedProjectId;  // リロード後は常に null
const isValid = currentId && res.projects.some(p => p.id === currentId);

store.setProjects(res.projects);
if (!isValid && res.projects[0]) {
    store.setSelectedProjectId(res.projects[0].id);  // 常に index 0 にフォールバック
}
```

### 対応策

`selectedProjectId` のみを localStorage に永続化する。`projects` 配列自体はAPIで毎回取得するため永続化不要。

**`apps/web/src/lib/project/store.ts`** を以下のように修正:

```ts
import type { Project } from "@sos26/shared";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type ProjectStore = {
    projects: Project[];
    selectedProjectId: string | null;
    setProjects: (projects: Project[]) => void;
    setSelectedProjectId: (id: string | null) => void;
};

export const useProjectStore = create<ProjectStore>()(
    persist(
        set => ({
            projects: [],
            selectedProjectId: null,
            setProjects: projects => set({ projects }),
            setSelectedProjectId: selectedProjectId => set({ selectedProjectId }),
        }),
        {
            name: "sos26-project-store",
            storage: createJSONStorage(() => localStorage),
            partialize: state => ({ selectedProjectId: state.selectedProjectId }),
        }
    )
);
```

`route.tsx:112-117` の既存ロジック（所属外/削除済み企画なら index 0 にフォールバック）はそのまま機能する。

### 留意点

- 同一ブラウザで複数アカウントを切り替える運用がある場合は、ログアウト時に `setSelectedProjectId(null)` を呼ぶか、key にユーザーIDを含める。
- 既存実装 `apps/web/src/lib/push.ts` で localStorage を直接操作するパターンが使われているため、その流儀に合わせて自前で `localStorage.getItem/setItem` する実装も可。

---

## 問題2: メールリンク経由で誤った企画が表示される

### 現象

通知メール内のリンクをクリックすると、リンク先で index 0 の企画として表示される。その結果:

- **お問い合わせ**: 該当のお問い合わせが他企画のものだった場合、「お問い合わせが見つかりません」エラー
- **申請・お知らせ**: 他企画の一覧が開くため、本来見せたかった項目が見つからない

### 原因（メール送信側のURL構造）

| 通知種別 | 送信箇所 | URL形式 |
|---------|---------|---------|
| お問い合わせ | `apps/api/src/lib/notifications/notifyInquiryCommentAdded.ts:30-33` | `${APP_URL}/project/support/${inquiryId}` （projectId なし） |
| 申請 | `apps/api/src/lib/notifications/notifyFormDelivered.ts:44` | `${APP_URL}/project/forms/` （ID・projectId 共になし） |
| お知らせ | `apps/api/src/lib/notifications/notifyNoticeDelivered.ts:45` | `${APP_URL}/project/notice/` （ID・projectId 共になし） |

申請・お知らせは複数企画に同一URLが配信される構造のため、URLだけでは対象企画を特定できない。

### 対応策

#### お問い合わせ

**案A（推奨）: メールURLに projectId を含める**

- `notifyInquiryCommentAdded.ts:30-33` で URL を `/project/support/${projectId}/${inquiryId}` に変更
- Webルートを `routes/project/support/$projectId.$inquiryId.tsx` に変更
- loader で `selectedProjectId !== params.projectId` の場合に `setSelectedProjectId(params.projectId)` を呼ぶ

メリット: URLで完結。実装が単純。

**案B: お問い合わせIDから企画を解決するAPIを追加**

- `GET /project/inquiries/:inquiryId/resolve` のような企画スコープなしのエンドポイントを追加
- 所属企画の中から該当 inquiry の projectId を返す
- loader でそれを呼んで `selectedProjectId` を切り替える

メリット: 既存メールURLを変更しなくて済む。
デメリット: 新規エンドポイント実装が必要。

#### 申請・お知らせ

URLから対象企画が一意に決まらない問題があるため、3案ある。

**案①（推奨）: メール送信側で受信者の企画ごとにURLを生成**

`notifyFormDelivered.ts:44` および `notifyNoticeDelivered.ts:45` で、`input.projectIds` をループしている各企画ごとに URL を分けて生成する:

```ts
// 現状: 全員に同じURL
const url = `${env.APP_URL}/project/forms/`;

// 修正: 受信者の企画ごとに別URL
const url = `${env.APP_URL}/project/forms/?projectId=${projectId}`;
```

Webルート側の loader で `search.projectId` があれば `setSelectedProjectId` を呼ぶ。お問い合わせの企画切替と同じロジックで処理可能。

メリット: 「メール内のリンクはその企画の申請/お知らせを開く」という挙動が明快。
デメリット: メール本文生成のループ単位の見直しが必要。

**案②: 一覧画面で全所属企画の申請/お知らせをマージ表示**

`/project/forms/` `/project/notice/` を「全所属企画の項目を企画名カラム付きで表示」する画面に変更。URLに projectId が無くても困らない。

メリット: メール側変更不要。複数企画の状況を一覧できる。
デメリット: 既存UIの大改修。回答・既読化などのアクションで企画を切替えるUX設計が必要。

**案③: 何もしない**

問題1の永続化修正のみ入れる。リロード時に直前選択が保持されるので、「メールクリック → 違う企画 → 自分で切替」の手動操作が1回で済むようになる。

メリット: 実装最小。
デメリット: 体験は改善されない。

---

## 推奨実装順序

1. **問題1 の永続化修正** — 影響範囲が `store.ts` のみで小さく、すべての問題の前提となる
2. **問題2 - お問い合わせの案A** — ルート変更とメール送信側変更で完結
3. **問題2 - 申請/お知らせの案①** — お問い合わせと同様の loader 切替ロジックを再利用

## 影響を受ける主なファイル

### 問題1
- `apps/web/src/lib/project/store.ts`

### 問題2（お問い合わせ）
- `apps/api/src/lib/notifications/notifyInquiryCommentAdded.ts`
- `apps/web/src/routes/project/support/$inquiryId.tsx` → `$projectId.$inquiryId.tsx` にリネーム
- お問い合わせ詳細ページにリンクしている他箇所（一覧画面など）の `Link to` 修正

### 問題2（申請・お知らせ）
- `apps/api/src/lib/notifications/notifyFormDelivered.ts`
- `apps/api/src/lib/notifications/notifyNoticeDelivered.ts`
- `apps/web/src/routes/project/forms/index.tsx`
- `apps/web/src/routes/project/notice/index.tsx`
