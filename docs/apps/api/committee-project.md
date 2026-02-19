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
  - [GET `/committee/projects/:projectId/members`](#get-committeeprojectsprojectidmembers)

---

## 共通仕様

- ベースパス: `/committee/projects`
- 認証: 全エンドポイントで `requireAuth` + `requireCommitteeMember` が必要
- 削除データ: `deletedAt` を持つモデルは、基本的に `deletedAt: null` を対象に扱う
- 実委人であれば任意の企画を閲覧可能（`requireProjectMember` は不要）

---

## エンドポイント一覧

| Method | Path | 概要 |
|---|---|---|
| GET | `/committee/projects` | 全企画一覧（フィルタ・検索・ページネーション） |
| GET | `/committee/projects/:projectId` | 企画詳細（owner/subOwner/メンバー数含む） |
| GET | `/committee/projects/:projectId/members` | 企画メンバー一覧（ロール付き） |

---

## 各 API 詳細

### GET `/committee/projects`

全企画の一覧を返します。フィルタ・検索・ページネーションに対応。

#### クエリパラメータ

| パラメータ | 型 | デフォルト | 説明 |
|---|---|---|---|
| `type` | `"STAGE" \| "FOOD" \| "NORMAL"` | なし | 企画区分でフィルタ |
| `search` | `string` | なし | 企画名・団体名で部分一致検索（大文字小文字区別なし） |
| `page` | `number` | `1` | ページ番号（1始まり） |
| `limit` | `number` | `20` | 1ページあたりの件数（最大100） |

#### レスポンス

```json
{
  "projects": [
    {
      "id": "clxxx...",
      "name": "企画名",
      "namePhonetic": "キカクメイ",
      "organizationName": "団体名",
      "organizationNamePhonetic": "ダンタイメイ",
      "type": "NORMAL",
      "ownerId": "clxxx...",
      "subOwnerId": "clyyy..." | null,
      "inviteCode": "ABC123",
      "createdAt": "2026-...",
      "updatedAt": "2026-...",
      "deletedAt": null,
      "memberCount": 5,
      "ownerName": "筑波太郎"
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

#### 動作

- `deletedAt: null` の企画のみ対象
- `search` 指定時は `name` と `organizationName` の OR 条件で部分一致検索（`mode: "insensitive"`）
- `memberCount` は `deletedAt: null` のメンバーのみカウント
- `createdAt` 降順でソート

---

### GET `/committee/projects/:projectId`

企画の詳細情報を返します。責任者・副責任者のユーザー情報とメンバー数を含みます。

#### パスパラメータ

| パラメータ | 型 | 説明 |
|---|---|---|
| `projectId` | `string` | 企画ID |

#### レスポンス

```json
{
  "project": {
    "id": "clxxx...",
    "name": "企画名",
    "namePhonetic": "キカクメイ",
    "organizationName": "団体名",
    "organizationNamePhonetic": "ダンタイメイ",
    "type": "NORMAL",
    "ownerId": "clxxx...",
    "subOwnerId": "clyyy..." | null,
    "inviteCode": "ABC123",
    "createdAt": "2026-...",
    "updatedAt": "2026-...",
    "deletedAt": null,
    "memberCount": 5,
    "owner": { "id": "...", "name": "...", ... },
    "subOwner": { "id": "...", "name": "...", ... } | null
  }
}
```

#### エラー

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
