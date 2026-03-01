# Notice API 仕様

このページは `apps/api/src/routes/committee-notice.ts` および `apps/api/src/routes/project-notice.ts` で提供しているお知らせ関連 API をまとめた仕様書です。

> 型定義・リクエスト/レスポンスの Zod スキーマは `packages/shared/src/endpoints/notice.ts` と `packages/shared/src/schemas/notice.ts` を参照してください。

---

## 目次

- [概要](#概要)
- [権限モデル](#権限モデル)
- [公開申請（承認ワークフロー）](#公開申請承認ワークフロー)
- [委員向け API（`/committee/notices`）](#委員向け-apicommitteenotices)
- [企画メンバー向け API（`/project/:projectId/notices`）](#企画メンバー向け-apiprojectprojectidnotices)

---

## 概要

お知らせ機能は、実委人が企画向けに情報を配信するための仕組みです。

```
作成 → 共同編集 → 公開申請 → 承認 → 配信 → 既読管理
```

### データモデル

| モデル | 説明 |
|---|---|
| `Notice` | お知らせ本体（タイトル・本文） |
| `NoticeCollaborator` | 共同編集者（ソフトデリート対応） |
| `NoticeAuthorization` | 公開申請（承認ステータス・配信希望日時） |
| `NoticeDelivery` | 配信先企画（承認後に配信される） |
| `NoticeReadStatus` | 既読状態（企画メンバー単位） |

---

## 権限モデル

| 権限 | 説明 | 必要な場面 |
|---|---|---|
| `NOTICE_DELIVER` | お知らせ配信・承認 | 公開申請の承認者として指定される条件 |

### 編集権限

- **オーナー**: お知らせの作成者。編集・削除・共同編集者管理が可能
- **共同編集者**: オーナーが追加した実委人。編集・公開申請が可能

---

## 公開申請（承認ワークフロー）

```
申請者（owner/共同編集者）
  → 承認者（NOTICE_DELIVER 権限を持つ実委人）を指定して申請
  → 承認者が APPROVED / REJECTED を決定
  → APPROVED の場合、deliveredAt 到来後に企画メンバーへ配信
```

### バリデーション

- 申請者は owner または共同編集者であること
- 承認者が `NOTICE_DELIVER` 権限を持つこと
- 配信希望日時は未来であること
- 同一お知らせに対して PENDING / APPROVED の申請が既に存在しないこと（Serializable トランザクションで保証）

### ステータス遷移

```
PENDING → APPROVED（承認）
PENDING → REJECTED（却下）
```

- お知らせが削除された場合、PENDING の申請は自動的に REJECTED になる
- 承認時に deliveredAt が過去の場合はエラー

---

## 委員向け API（`/committee/notices`）

認証: 全エンドポイントで `requireAuth` + `requireCommitteeMember` が必要

### エンドポイント一覧

| Method | Path | 概要 | 権限 |
|---|---|---|---|
| POST | `/committee/notices` | お知らせ作成 | 委員全員 |
| GET | `/committee/notices` | お知らせ一覧 | 委員全員 |
| GET | `/committee/notices/:noticeId` | お知らせ詳細 | 委員全員 |
| PATCH | `/committee/notices/:noticeId` | お知らせ編集 | owner / 共同編集者 |
| DELETE | `/committee/notices/:noticeId` | お知らせ削除 | owner のみ |
| POST | `/committee/notices/:noticeId/collaborators` | 共同編集者追加 | owner のみ |
| DELETE | `/committee/notices/:noticeId/collaborators/:collaboratorId` | 共同編集者削除 | owner のみ |
| POST | `/committee/notices/:noticeId/authorizations` | 公開申請 | owner / 共同編集者 |
| PATCH | `/committee/notices/:noticeId/authorizations/:authorizationId` | 承認 / 却下 | 申請先本人（`requestedTo`） |

### POST `/committee/notices`

お知らせを作成します。

- 入力: `title`（任意）、`body`（任意）
- `body` は DOMPurify でサニタイズして保存
- 作成者が owner になる

### GET `/committee/notices`

全お知らせ一覧を返します（実委人全員閲覧可）。

- 最新の承認申請（`authorizations` の先頭1件）を含む
- `deletedAt: null` のみ

### GET `/committee/notices/:noticeId`

お知らせ詳細を返します。

- owner、共同編集者、全承認申請（配信先含む）を返却

### PATCH `/committee/notices/:noticeId`

お知らせを編集します。

- 入力: `title`（任意）、`body`（任意）
- `body` は DOMPurify でサニタイズして保存
- owner または共同編集者のみ編集可能

### DELETE `/committee/notices/:noticeId`

お知らせを論理削除します。

- owner のみ実行可能
- PENDING の承認申請は自動的に REJECTED になる

### POST `/committee/notices/:noticeId/collaborators`

共同編集者を追加します。

- 入力: `userId`
- owner のみ実行可能
- 対象ユーザーが実委人であること
- 自分自身は追加できない
- ソフトデリート済みの場合は再有効化

### DELETE `/committee/notices/:noticeId/collaborators/:collaboratorId`

共同編集者を論理削除します。

- owner のみ実行可能

### POST `/committee/notices/:noticeId/authorizations`

公開申請を送信します。

- 入力: `requestedToId`、`deliveredAt`、`projectIds`
- バリデーション詳細は[公開申請（承認ワークフロー）](#公開申請承認ワークフロー)を参照

### PATCH `/committee/notices/:noticeId/authorizations/:authorizationId`

承認または却下します。

- 入力: `status`（`APPROVED` | `REJECTED`）
- `requestedTo` 本人のみ操作可能
- PENDING 状態でなければ操作不可

---

## 企画メンバー向け API（`/project/:projectId/notices`）

認証: 全エンドポイントで `requireAuth` + `requireProjectMember` が必要

### エンドポイント一覧

| Method | Path | 概要 |
|---|---|---|
| GET | `/project/:projectId/notices` | 配信済みお知らせ一覧 |
| GET | `/project/:projectId/notices/:noticeId` | お知らせ詳細 |
| POST | `/project/:projectId/notices/:noticeId/read` | 既読にする |

### 表示条件

以下の全てを満たすお知らせのみ表示されます。

- 承認ステータスが `APPROVED`
- `deliveredAt`（配信日時）が現在時刻以前
- お知らせが削除されていない（`deletedAt: null`）

### POST `/project/:projectId/notices/:noticeId/read`

お知らせを既読にします。

- body 不要の POST（パスパラメータと認証情報のみ使用）
- 冪等（既に既読の場合は何もしない）
