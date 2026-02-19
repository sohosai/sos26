# お知らせ API 設計

お知らせ（Notice）機能の API 設計ドキュメント。

## 目次

- [概要](#概要)
- [データモデル](#データモデル)
- [DB スキーマ変更](#db-スキーマ変更)
- [エンドポイント一覧](#エンドポイント一覧)
- [実委側 API 詳細](#実委側-api-詳細)
- [企画側 API 詳細](#企画側-api-詳細)
- [Zod スキーマ設計](#zod-スキーマ設計)
- [実装ファイル構成](#実装ファイル構成)
- [実装順序](#実装順序)

---

## 概要

お知らせは **実委人が作成・配信** し、**企画人が受信・確認** する一方向の通知機能。

### ライフサイクル

```
作成 → 編集 → (共同編集者を追加) → 配信承認申請 → 承認 → 配信 → 企画が確認（既読）
```

### 利用者別の操作

| ロール | 操作 |
|---|---|
| 実委人（全員） | お知らせの一覧閲覧・詳細閲覧 |
| 実委人（オーナー） | 作成、編集、削除、共同編集者の管理、配信承認申請 |
| 実委人（共同編集者） | 編集、配信承認申請 |
| 実委人（承認者） | 承認 / 却下（共同編集者の中から指定される） |
| 企画人 | **自企画に配信された**お知らせの一覧表示、詳細閲覧、既読マーク |

> **注意**: 企画人が閲覧できるのは、`NoticeDelivery` で自企画に紐づき、かつ承認済み（`APPROVED`）で配信日時が到来したお知らせのみ。全お知らせが見えるわけではない。

### 閲覧・編集の権限まとめ

| 操作 | 対象 |
|---|---|
| 閲覧（一覧・詳細） | 実委人全員 |
| 編集 | オーナー + 共同編集者 |
| 削除 | オーナーのみ |
| 共同編集者の追加・削除 | オーナーのみ |
| 配信承認申請 | オーナーまたは共同編集者（`NOTICE_DELIVER` 権限） |
| 承認 / 却下 | 承認先に指定された共同編集者本人 |

---

## データモデル

### 既存モデル（Prisma 定義済み）

```
Notice                  お知らせ本体（owner, title, body）
NoticeShare             → NoticeCollaborator に変更（下記参照）
NoticeAuthorization     配信承認（requestedBy → requestedTo、PENDING/APPROVED/REJECTED）
NoticeDelivery          配信先企画（NoticeAuthorization に紐づく）
```

### 関連図

```
Notice ─── owner (User)
  │
  ├── NoticeCollaborator[] ─── user (User)
  │     └── 共同編集者（全員が編集可能）
  │
  └── NoticeAuthorization[] ─── requestedBy (User)
        │                    └── requestedTo (User)  ※共同編集者から指定
        │                    └── status: PENDING / APPROVED / REJECTED
        │                    └── deliveredAt: DateTime (配信希望日時)
        │
        └── NoticeDelivery[] ─── project (Project)
              │
              └── NoticeReadStatus[] ─── user (User)  ※企画メンバー単位の既読
```

### 権限モデル

- `CommitteePermission.NOTICE_DELIVER` — 配信承認申請を行うために必要な権限
- お知らせの**閲覧**は実委人であれば全員可能
- お知らせの**編集**は owner または `NoticeCollaborator` に含まれるユーザーに限定
- **承認者**は共同編集者の中から指定する

---

## DB スキーマ変更

### 変更 1: NoticeShare → NoticeCollaborator にリネーム

`NoticeShare` を `NoticeCollaborator` にリネームし、`isWrite` フィールドを削除する。
共同編集者は全員が編集権限を持つため、権限フラグは不要。

```prisma
// 旧: NoticeShare（削除）
// 新: NoticeCollaborator

model NoticeCollaborator {
  id String @id @default(cuid())

  noticeId String
  userId   String

  notice Notice @relation(fields: [noticeId], references: [id], onDelete: Cascade)
  user   User   @relation(fields: [userId], references: [id])

  deletedAt DateTime?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  @@unique([noticeId, userId])
}
```

**Notice モデルの変更**:
```diff
- sharedUsers NoticeShare[]
+ collaborators NoticeCollaborator[]
```

**User モデルの変更**:
```diff
- sharedNotices NoticeShare[]
+ noticeCollaborations NoticeCollaborator[]
```

### 変更 2: NoticeReadStatus を新規追加

企画側の既読管理モデルが不足しているため、新規追加が必要。

```prisma
model NoticeReadStatus {
  id String @id @default(cuid())

  noticeDeliveryId String
  noticeDelivery   NoticeDelivery @relation(fields: [noticeDeliveryId], references: [id], onDelete: Cascade)

  // 既読にしたユーザー（企画メンバー）
  userId String
  user   User @relation(fields: [userId], references: [id])

  createdAt DateTime @default(now())

  @@unique([noticeDeliveryId, userId])
}
```

**必要なリレーション追加**:
- `User` に `noticeReadStatuses NoticeReadStatus[]` を追加
- `NoticeDelivery` に `readStatuses NoticeReadStatus[]` を追加

---

## エンドポイント一覧

### 実委側 `/committee/notices`

認可: 全エンドポイントに `requireAuth` + `requireCommitteeMember` を適用。

| メソッド | パス | 説明 | 追加認可 |
|---|---|---|---|
| `POST` | `/committee/notices` | お知らせを作成 | なし |
| `GET` | `/committee/notices` | お知らせ一覧を取得 | なし（実委人全員閲覧可） |
| `GET` | `/committee/notices/:noticeId` | お知らせ詳細を取得 | なし（実委人全員閲覧可） |
| `PATCH` | `/committee/notices/:noticeId` | お知らせを編集 | owner または共同編集者 |
| `DELETE` | `/committee/notices/:noticeId` | お知らせを削除（ソフトデリート） | owner のみ |
| `POST` | `/committee/notices/:noticeId/collaborators` | 共同編集者を追加 | owner のみ |
| `DELETE` | `/committee/notices/:noticeId/collaborators/:collaboratorId` | 共同編集者を削除 | owner のみ |
| `POST` | `/committee/notices/:noticeId/authorizations` | 配信承認を申請 | owner または共同編集者 + `NOTICE_DELIVER` 権限 |
| `PATCH` | `/committee/notices/:noticeId/authorizations/:authorizationId` | 承認 / 却下 | requestedTo 本人（共同編集者）のみ |
| `GET` | `/committee/notices/:noticeId/status` | 企画ごとの既読状況を取得 | owner または共同編集者 |

### 企画側 `/project/:projectId/notices`

認可: 全エンドポイントに `requireAuth` + `requireProjectMember` を適用。

| メソッド | パス | 説明 |
|---|---|---|
| `GET` | `/project/:projectId/notices` | 配信済みお知らせ一覧 |
| `GET` | `/project/:projectId/notices/:noticeId` | お知らせ詳細 |
| `POST` | `/project/:projectId/notices/:noticeId/read` | 既読にする |

---

## 実委側 API 詳細

### POST /committee/notices

お知らせを作成する。作成者は `c.get("user")` から取得。

**リクエスト**:
```json
{
  "title": "企画書提出期限のお知らせ",
  "body": "<p>企画書の提出期限は...</p>"
}
```

**レスポンス** (`201`):
```json
{
  "notice": {
    "id": "cm...",
    "title": "企画書提出期限のお知らせ",
    "body": "<p>企画書の提出期限は...</p>",
    "ownerId": "user_xxx",
    "createdAt": "2026-02-18T00:00:00.000Z",
    "updatedAt": "2026-02-18T00:00:00.000Z"
  }
}
```

---

### GET /committee/notices

全お知らせの一覧を返す。実委人であれば全員閲覧可能。

**レスポンス**:
```json
{
  "notices": [
    {
      "id": "cm...",
      "title": "企画書提出期限のお知らせ",
      "ownerId": "user_xxx",
      "owner": { "id": "user_xxx", "name": "田中太郎" },
      "collaborators": [
        { "id": "collab_xxx", "userId": "user_yyy", "user": { "id": "user_yyy", "name": "佐藤花子" } }
      ],
      "authorizations": [
        {
          "id": "auth_xxx",
          "status": "PENDING",
          "requestedTo": { "id": "user_zzz", "name": "山田次郎" },
          "deliveredAt": "2026-03-01T10:00:00.000Z"
        }
      ],
      "createdAt": "2026-02-18T00:00:00.000Z",
      "updatedAt": "2026-02-18T00:00:00.000Z"
    }
  ]
}
```

**Prisma クエリ方針**:
```ts
prisma.notice.findMany({
  where: { deletedAt: null },
  include: {
    owner: true,
    collaborators: { where: { deletedAt: null }, include: { user: true } },
    authorizations: {
      include: { requestedTo: true },
      orderBy: { createdAt: "desc" },
      take: 1,
    },
  },
  orderBy: { updatedAt: "desc" },
})
```

---

### GET /committee/notices/:noticeId

お知らせの詳細を取得する。実委人であれば全員閲覧可能。

**レスポンス**:
```json
{
  "notice": {
    "id": "cm...",
    "title": "...",
    "body": "<p>...</p>",
    "ownerId": "user_xxx",
    "owner": { "id": "user_xxx", "name": "田中太郎" },
    "collaborators": [...],
    "authorizations": [
      {
        "id": "auth_xxx",
        "status": "APPROVED",
        "requestedBy": { "id": "...", "name": "..." },
        "requestedTo": { "id": "...", "name": "..." },
        "deliveredAt": "2026-03-01T10:00:00.000Z",
        "decidedAt": "2026-02-20T00:00:00.000Z",
        "deliveries": [
          { "id": "del_xxx", "projectId": "proj_xxx", "project": { "id": "proj_xxx", "name": "焼きそば屋" } }
        ]
      }
    ],
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

---

### PATCH /committee/notices/:noticeId

お知らせのタイトル・本文を更新する。

**アクセス制御**: owner または共同編集者のみ。それ以外は `403 FORBIDDEN`。

**リクエスト**（部分更新）:
```json
{
  "title": "更新後のタイトル",
  "body": "<p>更新後の本文</p>"
}
```

**レスポンス**:
```json
{
  "notice": { ... }
}
```

---

### DELETE /committee/notices/:noticeId

お知らせをソフトデリートする。

**アクセス制御**: owner のみ。

**レスポンス**:
```json
{
  "success": true
}
```

---

### POST /committee/notices/:noticeId/collaborators

共同編集者を追加する。

**アクセス制御**: owner のみ。

**リクエスト**:
```json
{
  "userId": "user_yyy"
}
```

**レスポンス** (`201`):
```json
{
  "collaborator": {
    "id": "collab_xxx",
    "noticeId": "cm...",
    "userId": "user_yyy",
    "user": { "id": "user_yyy", "name": "佐藤花子" }
  }
}
```

**エラー**:
- 対象ユーザーが実委人でない → `400 INVALID_REQUEST`
- 既に共同編集者 → `409 ALREADY_EXISTS`
- 自分自身を追加 → `400 INVALID_REQUEST`

---

### DELETE /committee/notices/:noticeId/collaborators/:collaboratorId

共同編集者を削除する（ソフトデリート）。

**アクセス制御**: owner のみ。

**レスポンス**:
```json
{
  "success": true
}
```

---

### POST /committee/notices/:noticeId/authorizations

配信承認を申請する。承認者は**共同編集者の中から**指定する。配信先企画リストと配信希望日時も指定。

**アクセス制御**: owner または共同編集者で、`NOTICE_DELIVER` 権限を持つ実委人。

**リクエスト**:
```json
{
  "requestedToId": "user_zzz",
  "deliveredAt": "2026-03-01T10:00:00.000Z",
  "projectIds": ["proj_xxx", "proj_yyy"]
}
```

**レスポンス** (`201`):
```json
{
  "authorization": {
    "id": "auth_xxx",
    "noticeId": "cm...",
    "requestedById": "user_xxx",
    "requestedToId": "user_zzz",
    "status": "PENDING",
    "deliveredAt": "2026-03-01T10:00:00.000Z",
    "deliveries": [
      { "id": "del_xxx", "projectId": "proj_xxx" },
      { "id": "del_yyy", "projectId": "proj_yyy" }
    ]
  }
}
```

**バリデーション**:
- `requestedToId` が当該お知らせの**共同編集者**であること（owner 自身は不可）
- `projectIds` が空でないこと
- `deliveredAt` が未来日時であること
- 既に PENDING の承認申請がある場合は `409 ALREADY_EXISTS`

---

### PATCH /committee/notices/:noticeId/authorizations/:authorizationId

承認申請を承認 / 却下する。

**アクセス制御**: `requestedTo` 本人（共同編集者）のみ。

**リクエスト**:
```json
{
  "status": "APPROVED"
}
```

**レスポンス**:
```json
{
  "authorization": {
    "id": "auth_xxx",
    "status": "APPROVED",
    "decidedAt": "2026-02-20T00:00:00.000Z",
    ...
  }
}
```

**制約**:
- 現在の status が `PENDING` でない場合は `400 INVALID_REQUEST`
- `status` は `APPROVED` または `REJECTED` のみ受付
- `deliveredAt` が既に過去の場合は `400 INVALID_REQUEST`（エラーメッセージ例: 「配信希望日時を過ぎているため承認できません。新しい日時で再申請してください」）。申請者が新しい `deliveredAt` で再度 `POST authorizations` を行う必要がある

---

### GET /committee/notices/:noticeId/status

企画ごとの配信状況・既読状況を取得する。

**アクセス制御**: owner または共同編集者。

**レスポンス**:
```json
{
  "deliveries": [
    {
      "id": "del_xxx",
      "project": { "id": "proj_xxx", "name": "焼きそば屋" },
      "authorization": {
        "status": "APPROVED",
        "deliveredAt": "2026-03-01T10:00:00.000Z"
      },
      "readCount": 3,
      "memberCount": 5
    }
  ]
}
```

---

## 企画側 API 詳細

### GET /project/:projectId/notices

自企画に配信済み（承認済み & 配信日時到来）のお知らせ一覧を返す。

**レスポンス**:
```json
{
  "notices": [
    {
      "id": "cm...",
      "title": "企画書提出期限のお知らせ",
      "owner": { "id": "user_xxx", "name": "田中太郎" },
      "ownerBureau": "PLANNING",
      "deliveredAt": "2026-03-01T10:00:00.000Z",
      "isRead": false
    }
  ]
}
```

**Prisma クエリ方針**:
```ts
// 承認済み & 配信日時が過去のものを取得
prisma.noticeDelivery.findMany({
  where: {
    projectId,
    noticeAuthorization: {
      status: "APPROVED",
      deliveredAt: { lte: new Date() },
      notice: { deletedAt: null },
    },
  },
  include: {
    noticeAuthorization: {
      include: {
        notice: {
          include: { owner: { include: { committeeMember: true } } },
        },
      },
    },
    readStatuses: { where: { userId: user.id } },
  },
})
```

`isRead` はリクエストユーザーの `NoticeReadStatus` の有無で判定。

---

### GET /project/:projectId/notices/:noticeId

お知らせの詳細を取得する。

**アクセス制御**: 対象企画に配信されたお知らせのみ。それ以外は `404 NOT_FOUND`。

**レスポンス**:
```json
{
  "notice": {
    "id": "cm...",
    "title": "企画書提出期限のお知らせ",
    "body": "<p>企画書の提出期限は...</p>",
    "owner": { "id": "user_xxx", "name": "田中太郎" },
    "ownerBureau": "PLANNING",
    "deliveredAt": "2026-03-01T10:00:00.000Z",
    "isRead": false
  }
}
```

---

### POST /project/:projectId/notices/:noticeId/read

お知らせを既読にする。

**レスポンス**:
```json
{
  "success": true
}
```

**動作**:
- 該当の `NoticeDelivery` を特定し、`NoticeReadStatus` を作成
- 既に既読の場合は何もせず成功を返す（冪等）

---

## Zod スキーマ設計

### packages/shared/src/schemas/notice.ts

```ts
// 基本スキーマ
noticeSchema                          // Notice エンティティ
noticeCollaboratorSchema              // NoticeCollaborator エンティティ
noticeAuthorizationStatusSchema       // "PENDING" | "APPROVED" | "REJECTED"
noticeAuthorizationSchema             // NoticeAuthorization エンティティ
noticeDeliverySchema                  // NoticeDelivery エンティティ

// 実委側リクエスト
createNoticeRequestSchema             // { title, body? }
updateNoticeRequestSchema             // { title?, body? }
addCollaboratorRequestSchema          // { userId }
createNoticeAuthorizationRequestSchema // { requestedToId, deliveredAt, projectIds }
updateNoticeAuthorizationRequestSchema // { status: "APPROVED" | "REJECTED" }

// 実委側レスポンス
createNoticeResponseSchema
listNoticesResponseSchema
getNoticeResponseSchema
updateNoticeResponseSchema
deleteNoticeResponseSchema
addCollaboratorResponseSchema
removeCollaboratorResponseSchema
createNoticeAuthorizationResponseSchema
updateNoticeAuthorizationResponseSchema
getNoticeStatusResponseSchema

// 企画側レスポンス
listProjectNoticesResponseSchema
getProjectNoticeResponseSchema
readProjectNoticeResponseSchema
```

### packages/shared/src/endpoints/notice.ts

上記スキーマを使用して各エンドポイント定数を定義。

---

## 実装ファイル構成

```
packages/shared/src/
├── schemas/notice.ts          # Zod スキーマ
├── endpoints/notice.ts        # エンドポイント定義
└── index.ts                   # re-export 追加

apps/api/src/
├── routes/
│   ├── committee-notice.ts    # 実委側ルート
│   └── project.ts             # 既存ファイルに企画側お知らせルートを追加
│                              # （または project-notice.ts を分離）
├── middlewares/
│   └── auth.ts                # requireCommitteeMember は既存
└── index.ts                   # committee-notice ルートのマウント追加

apps/api/prisma/
└── schema.prisma              # NoticeShare → NoticeCollaborator リネーム
                               # + NoticeReadStatus 追加
```

---

## 実装順序

### Phase 1: 基盤

1. **DB スキーマ変更**: `NoticeShare` → `NoticeCollaborator` にリネーム（`isWrite` 削除）、`NoticeReadStatus` 新規追加
2. **DB マイグレーション**: `bun run db:migrate`
3. **Zod スキーマ**: `packages/shared/src/schemas/notice.ts` を作成
4. **エンドポイント定義**: `packages/shared/src/endpoints/notice.ts` を作成
5. **re-export**: `packages/shared/src/index.ts` に追加

### Phase 2: 実委側 CRUD

6. **ルートファイル作成**: `apps/api/src/routes/committee-notice.ts`
7. **マウント**: `apps/api/src/index.ts` に追加
8. **CRUD 実装**: POST / GET 一覧 / GET 詳細 / PATCH / DELETE
9. **テスト**: 各エンドポイントのユニットテスト

### Phase 3: 共同編集者・配信

10. **共同編集者**: POST collaborators / DELETE collaborators
11. **配信承認**: POST authorizations / PATCH authorizations
12. **権限チェック**: `NOTICE_DELIVER` 権限 + 共同編集者バリデーション
13. **配信状況**: GET status
14. **テスト**: 共同編集者・配信のテスト

### Phase 4: 企画側

15. **企画側ルート**: GET 一覧 / GET 詳細 / POST read
16. **テスト**: 企画側のテスト

### Phase 5: フロントエンド — 実委側 基本画面 ✅ 完了

**ファイル構成**:
```
apps/web/src/routes/committee/notice/
├── index.tsx                    # 一覧画面
├── index.module.scss
├── CreateNoticeDialog.tsx       # 作成・編集ダイアログ（共用）
├── CreateNoticeDialog.module.scss
└── $noticeId/
    ├── index.tsx                # 個別詳細ページ
    ├── index.module.scss
    ├── NoticeDetailSidebar.tsx   # サイドバーコンポーネント
    ├── NoticeDetailSidebar.module.scss
    ├── AddCollaboratorDialog.tsx
    ├── AddCollaboratorDialog.module.scss
    ├── PublishRequestDialog.tsx  # モック（API 接続は別途対応予定）
    ├── PublishRequestDialog.module.scss
    ├── DeliveryStatusDialog.tsx  # 配信状況ダイアログ
    └── DeliveryStatusDialog.module.scss
```

17. ✅ **一覧画面**: `GET /committee/notices` に接続済み。DataTable にタイトル、オーナー、共同編集者（AvatarGroup）、投稿日、更新日、承認者カラムを表示。操作列に「詳細」ボタン（`Link` で個別ページへ遷移）
18. ✅ **作成ダイアログ**: `CreateNoticeDialog` で `POST /committee/notices` に接続済み。RichTextEditor で本文入力
19. ✅ **お知らせ個別ページ**: `/committee/notice/$noticeId` の独立ページとして実装。2カラムグリッドレイアウト（メインコンテンツ `1fr` + サイドバー `280px`、768px 以下で 1 カラムに切り替え）。HTML 本文を `dangerouslySetInnerHTML` でレンダリング。ステータスバッジを `notice.authorizations` から導出して表示（公開申請前 / 承認待機中 / 却下 / 公開予定 / 公開済み）。作成日・更新日をアイコン付きで表示
20. ✅ **編集ダイアログ**: `CreateNoticeDialog` を `noticeId` と `initialValues` props で再利用。`PATCH /committee/notices/:noticeId` に接続済み
21. ✅ **削除確認ダイアログ**: `AlertDialog` で確認後 `DELETE /committee/notices/:noticeId` を呼び出し。owner のみ表示

### Phase 6: フロントエンド — 実委側 共同編集者管理 ✅ 完了

22. ✅ **サイドバーの共同編集者セクション**: `NoticeDetailSidebar` コンポーネントとして分離。オーナー（32px アバター + 名前）、共同編集者一覧（24px アバター + 名前 + Badge で人数表示）を表示。owner の場合は各共同編集者に削除ボタン、「共同編集者を追加」ボタン（破線ボーダー）を表示
23. ✅ **共同編集者追加ダイアログ**: `AddCollaboratorDialog` — 検索テキストフィールドでリアルタイムフィルタ、メンバーごとに「追加」ボタン。`POST /committee/notices/:noticeId/collaborators` に接続済み。追加後もダイアログを閉じず連続追加可能。追加可能なメンバーは `listCommitteeMembers` で取得し、オーナーと既存共同編集者を除外
24. ✅ **共同編集者削除**: 各共同編集者の横に `IconTrash` ボタン。`DELETE /committee/notices/:noticeId/collaborators/:collaboratorId` に接続済み

### Phase 7: フロントエンド — 実委側 配信承認フロー 🔧 一部完了（25 のみ残り）

25. 🔧 **公開申請ダイアログ**: `PublishRequestDialog` の UI モックを作成済み。以下のフィールドを持つ:
    - 承認依頼先（Select — 現在モックデータ）
    - 公開日時（date + time input）
    - 公開先プロジェクト（Checkbox リスト — 現在モックデータ）
    - **TODO**: `POST /committee/notices/:noticeId/authorizations` への API 接続
    - **TODO**: 承認依頼先を共同編集者リストから動的に取得
    - **TODO**: 公開先プロジェクトリストを取得する API が必要（実委レベルでプロジェクト一覧を取得するエンドポイント）
26. ✅ **ステータスバッジ表示**: 詳細ページに `NoticeStatusBadge` を実装。`notice.authorizations` の最新エントリから状態を導出:
    - 承認なし → 「公開申請前」（gray）
    - 最新が PENDING → 「承認待機中」（orange）
    - 最新が REJECTED → 「却下」（red）
    - 最新が APPROVED & `deliveredAt` が未来 → 「公開予定」（blue）
    - 最新が APPROVED & `deliveredAt` が過去 → 「公開済み」（green）
27. ✅ **承認・却下 UI**: `NoticeDetailSidebar` に実装済み。自分が `requestedTo` の PENDING 承認がある場合、申請者名・公開希望日時・配信先企画バッジ・承認/却下ボタンを表示。`PATCH /committee/notices/:noticeId/authorizations/:authorizationId` に接続
28. ✅ **配信状況ダイアログ**: `DeliveryStatusDialog` として実装済み。`GET /committee/notices/:noticeId/status` で企画ごとの既読率（readCount / memberCount）をプログレスバー付きで一覧表示。承認済み承認がある場合にサイドバーに「配信状況」ボタンを表示

### Phase 8: フロントエンド — 企画側 ❌ 未着手

29. ❌ **一覧画面の API 接続**: `GET /project/:projectId/notices` に接続。`isRead` に基づき「未チェック / チェック済み」タグを表示
30. ❌ **詳細画面の API 接続**: `GET /project/:projectId/notices/:noticeId` に接続。HTML 本文のレンダリング対応
31. ❌ **既読マーク**: 詳細を開いた際に `POST /project/:projectId/notices/:noticeId/read` を自動呼び出し。一覧のステータスをリアルタイム更新
