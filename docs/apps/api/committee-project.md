# Committee Project API 仕様（`/committee/projects`）

このページは `apps/api/src/routes/committee-project.ts` で提供している `/committee/projects` 系 API をまとめた仕様書です。

> 型定義・リクエスト/レスポンスの Zod スキーマは `packages/shared/src/endpoints/committee-project.ts` と `packages/shared/src/schemas/committee-project.ts` を参照してください。

---

## 目次

- [共通仕様](#共通仕様)
- [エンドポイント一覧](#エンドポイント一覧)
- [各 API 詳細](#各-api-詳細)
  - [GET `/committee/projects`](#get-committeeprojects)
  - [GET `/committee/projects/:projectId`](#get-committeeprojectsprojectid)
  - [PATCH `/committee/projects/:projectId/base-info`](#patch-committeeprojectsprojectidbase-info)
  - [PATCH `/committee/projects/:projectId/deletion-status`](#patch-committeeprojectsprojectiddeletion-status)
  - [GET `/committee/projects/:projectId/members`](#get-committeeprojectsprojectidmembers)

---

## 共通仕様

- ベースパス: `/committee/projects`
- 認証: 全エンドポイントで `requireAuth` + `requireCommitteeMember` が必要
- 削除データ: `deletedAt` を持つモデルは、基本的に `deletedAt: null` を対象に扱う
- 実委人であれば任意の企画を閲覧可能（`requireProjectMember` は不要）
- レスポンスに `inviteCode`・`deletedAt` は含まない
- 連絡先（owner/subOwner の `email` と `telephoneNumber`）は `PROJECT_VIEW` 権限がない場合 `null` を返す
- 企画基礎情報更新には `PROJECT_EDIT` 権限が必要
- 企画削除状態更新には `PROJECT_DELETE` 権限が必要

---

## エンドポイント一覧

| Method | Path | 概要 |
|---|---|---|
| GET | `/committee/projects` | 全企画一覧（フィルタ・検索・ページネーション） |
| GET | `/committee/projects/:projectId` | 企画詳細（permissions/連絡先マスキング/アクション履歴含む） |
| PATCH | `/committee/projects/:projectId/base-info` | 企画基礎情報を更新 |
| PATCH | `/committee/projects/:projectId/deletion-status` | 企画削除状態を更新（削除/抽選漏れ/取消） |
| GET | `/committee/projects/:projectId/members` | 企画メンバー一覧（ロール付き） |

---

## 各 API 詳細

### GET `/committee/projects`

全企画の一覧を返します。フィルタ・検索・ページネーションに対応。

#### クエリパラメータ

| パラメータ | 型 | デフォルト | 説明 |
|---|---|---|---|
| `type` | `"STAGE" \| "FOOD" \| "NORMAL"` | なし | 企画区分でフィルタ |
| `search` | `string`（1文字以上） | なし | 企画名・団体名で部分一致検索（大文字小文字区別なし） |
| `page` | `number` | `1` | ページ番号（1始まり）。`limit` 指定時のみ有効 |
| `limit` | `number` | なし | 1ページあたりの件数（最大100）。省略時は全件取得 |

#### レスポンス

```jsonc
{
  "projects": [
    {
      "id": "clxxx...",
      "number": 12,
      "name": "企画名",
      "namePhonetic": "きかくめい",
      "organizationName": "団体名",
      "organizationNamePhonetic": "だんたいめい",
      "type": "NORMAL",
      "location": "INDOOR",
      "ownerId": "clxxx...",
      "subOwnerId": "clyyy...",  // null の場合あり
      "deletionStatus": null,
      "createdAt": "2026-...",
      "updatedAt": "2026-...",
      "memberCount": 5,
      "ownerName": "筑波太郎"
    }
  ],
  "total": 42,
  "page": 1,    // limit 指定時のみ
  "limit": 20   // limit 指定時のみ
}
```

#### 動作

- `deletedAt: null` の企画のみ対象
- `search` 指定時は `name` と `organizationName` の OR 条件で部分一致検索（`mode: "insensitive"`）
- `memberCount` は `deletedAt: null` のメンバーのみカウント
- `createdAt` 降順でソート

---

### GET `/committee/projects/:projectId`

企画の詳細情報を返します。企画責任者・副企画責任者情報、メンバー数、アクション履歴、操作権限を含みます。

#### パスパラメータ

| パラメータ | 型 | 説明 |
|---|---|---|
| `projectId` | `string` | 企画ID |

#### レスポンス

```jsonc
{
  "project": {
    "id": "clxxx...",
    "number": 12,
    "name": "企画名",
    "namePhonetic": "きかくめい",
    "organizationName": "団体名",
    "organizationNamePhonetic": "だんたいめい",
    "type": "NORMAL",
    "location": "INDOOR",
    "ownerId": "clxxx...",
    "subOwnerId": "clyyy...",  // null の場合あり
    "deletionStatus": null,
    "createdAt": "2026-...",
    "updatedAt": "2026-...",
    "memberCount": 5,
    "owner": {
      "id": "clxxx...",
      "name": "筑波太郎",
      "email": "s1234567@u.tsukuba.ac.jp",      // PROJECT_VIEW なしなら null
      "telephoneNumber": "090-1234-5678"         // PROJECT_VIEW なしなら null
    },
    "subOwner": {
      "id": "clyyy...",
      "name": "筑波花子",
      "email": "s7654321@u.tsukuba.ac.jp",
      "telephoneNumber": "090-8765-4321"
    },
    "actions": {
      "forms": [
        { "id": "fd_xxx", "title": "食品衛生申請", "sentAt": "2026-..." }
      ],
      "notices": [
        { "id": "nd_xxx", "title": "提出期限のお知らせ", "sentAt": "2026-..." }
      ],
      "inquiries": [
        { "id": "iq_xxx", "title": "提出物について", "sentAt": "2026-..." }
      ]
    },
    "permissions": {
      "canEdit": true,
      "canDelete": false,
      "canViewContacts": true
    }
  }
}
```

#### 動作

- `PROJECT_VIEW` 権限がない場合、owner/subOwner の `email`・`telephoneNumber` は `null`
- `actions.forms` / `actions.notices` は最新20件を返却
  - 紐づくフォーム/お知らせ本体が論理削除済み（`deletedAt != null`）の配信は除外
- `actions.inquiries` は下書き除外（`isDraft: false`）の最新20件を返却
- `permissions` は実委メンバー権限から算出
  - `canEdit` = `PROJECT_EDIT`
  - `canDelete` = `PROJECT_DELETE`
  - `canViewContacts` = `PROJECT_VIEW`

#### エラー

- 企画が存在しない場合: `NOT_FOUND`

---

### PATCH `/committee/projects/:projectId/base-info`

企画の基礎情報を更新します。

#### 権限

- `PROJECT_EDIT` が必要

#### リクエスト

部分更新（1項目以上必須）。

```json
{
  "name": "新しい企画名",
  "namePhonetic": "あたらしいきかくめい",
  "organizationName": "新しい団体名",
  "organizationNamePhonetic": "あたらしいだんたいめい",
  "type": "NORMAL",
  "location": "INDOOR"
}
```

#### レスポンス

```json
{
  "project": {
    "id": "clxxx...",
    "number": 12,
    "name": "新しい企画名",
    "namePhonetic": "あたらしいきかくめい",
    "organizationName": "新しい団体名",
    "organizationNamePhonetic": "あたらしいだんたいめい",
    "type": "NORMAL",
    "location": "INDOOR",
    "ownerId": "clxxx...",
    "subOwnerId": "clyyy...",
    "deletionStatus": null,
    "createdAt": "2026-...",
    "updatedAt": "2026-...",
    "memberCount": 5,
    "owner": {
      "id": "clxxx...",
      "name": "筑波太郎",
      "email": "s1234567@u.tsukuba.ac.jp",
      "telephoneNumber": "090-1234-5678"
    },
    "subOwner": null
  }
}
```

#### エラー

- 権限がない場合: `FORBIDDEN`
- 企画が存在しない場合: `NOT_FOUND`

---

### PATCH `/committee/projects/:projectId/deletion-status`

企画の削除状態を更新します。

- `"DELETED"` または `"LOTTERY_LOSS"` を指定すると、企画は「停止中」として扱われる（`deletionStatus != null` が停止状態を表す）
- `null` を指定すると削除状態を取り消し、企画は「有効」として扱われる（`deletionStatus == null` が有効状態を表す）

#### 権限

- `PROJECT_DELETE` が必要

#### リクエスト

```json
{
  "deletionStatus": "DELETED"
}
```

取り消し時:

```json
{
  "deletionStatus": null
}
```

#### レスポンス

`PATCH /committee/projects/:projectId/base-info` と同じ形式（`project`）を返します。

#### 動作

- 削除状態を新たに設定した場合、企画責任者へメール通知と Push 通知を送信

#### エラー

- 権限がない場合: `FORBIDDEN`
- 企画が存在しない場合: `NOT_FOUND`

---

### GET `/committee/projects/:projectId/members`

企画のメンバー一覧を返します。各メンバーにロール（OWNER / SUB_OWNER / MEMBER）を付与。

#### パスパラメータ

| パラメータ | 型 | 説明 |
|---|---|---|
| `projectId` | `string` | 企画ID |

#### レスポンス

```json
{
  "members": [
    {
      "id": "pm_clxxx...",
      "userId": "clxxx...",
      "name": "筑波太郎",
      "email": "s1234567@u.tsukuba.ac.jp",
      "role": "OWNER",
      "joinedAt": "2026-..."
    }
  ]
}
```

#### 動作

- 企画の存在確認後、`deletedAt: null` のメンバーを `joinedAt` 昇順で返却
- ロールは `project.ownerId` / `project.subOwnerId` との一致で判定

#### エラー

- 企画が存在しない場合: `NOT_FOUND`
