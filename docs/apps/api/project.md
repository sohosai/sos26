# Project API 仕様（`/project`）

このページは `apps/api/src/routes/project.ts` で提供している `/project` 系 API をまとめた仕様書です。

> 型定義・リクエスト/レスポンスの Zod スキーマは `packages/shared/src/endpoints/project.ts` と `packages/shared/src/schemas/project.ts` を参照してください。

---

## 目次

- [共通仕様](#共通仕様)
- [エンドポイント一覧](#エンドポイント一覧)
- [各 API 詳細](#各-api-詳細)
  - [POST `/project/create`](#post-projectcreate)
  - [GET `/project/list`](#get-projectlist)
  - [POST `/project/join`](#post-projectjoin)
  - [GET `/project/:projectId/detail`](#get-projectprojectiddetail)
  - [PATCH `/project/:projectId/detail`](#patch-projectprojectiddetail)
  - [POST `/project/:projectId/invite-code/regenerate`](#post-projectprojectidinvite-coderegenerate)
  - [GET `/project/:projectId/members`](#get-projectprojectidmembers)
  - [POST `/project/:projectId/members/:userId/remove`](#post-projectprojectidmembersuseridremove)
  - [POST `/project/:projectId/members/:userId/promote`](#post-projectprojectidmembersuseridpromote)
- [役職と制約](#役職と制約)

---

## 共通仕様

- ベースパス: `/project`
- 認証: 全エンドポイントで `requireAuth` が必要
- 削除データ: `deletedAt` を持つモデルは、基本的に `deletedAt: null` を対象に扱う

---

## エンドポイント一覧

| Method | Path | 概要 |
|---|---|---|
| POST | `/project/create` | 企画作成 |
| GET | `/project/list` | 自分が参加中の企画一覧 |
| POST | `/project/join` | 招待コードで企画参加 |
| GET | `/project/:projectId/detail` | 企画詳細取得 |
| PATCH | `/project/:projectId/detail` | 企画設定更新（責任者のみ） |
| POST | `/project/:projectId/invite-code/regenerate` | 招待コード再生成（責任者のみ） |
| GET | `/project/:projectId/members` | 企画メンバー一覧 |
| POST | `/project/:projectId/members/:userId/remove` | メンバー削除（責任者/副責任者） |
| POST | `/project/:projectId/members/:userId/promote` | 副責任者任命（責任者のみ） |

---

## 各 API 詳細

### POST `/project/create`

企画を作成します。

- 実行ユーザーを `ownerId` に設定
- `subOwnerId` は `null`
- 招待コード（6文字英数字）を生成し、重複時は再生成
- 作成者を `projectMembers` に自動追加

### GET `/project/list`

自分が参加している企画一覧を返します。

- `projectMembers.some({ userId, deletedAt: null })` で参加判定
- 企画本体も `deletedAt: null` のみ対象

### POST `/project/join`

招待コードで企画に参加します。

- 入力: `inviteCode`（6文字）
- 対象企画が存在しない場合: `NOT_FOUND`
- 既に参加済みの場合: `ALREADY_EXISTS`
- 成功時は `projectMember` を作成

### GET `/project/:projectId/detail`

企画詳細を返します。

- `requireProjectMember` により、対象企画メンバーのみ取得可能
- 招待コードを含む企画情報を返却

### PATCH `/project/:projectId/detail`

企画詳細（名称・団体名など）を更新します。

- `requireProjectMember` + `projectRole === OWNER` が必須
- 責任者以外は `FORBIDDEN`

### POST `/project/:projectId/invite-code/regenerate`

招待コードを再生成します。

- `requireProjectMember` + `projectRole === OWNER` が必須
- 新しい 6 文字コードを重複回避しながら生成

### GET `/project/:projectId/members`

企画メンバー一覧を返します。

- 認証必須
- 対象企画の存在確認
- リクエストユーザーが当該企画メンバーか確認
- `joinedAt` 昇順で返却
- 返却時に `ownerId` / `subOwnerId` からロールを計算して付与

### POST `/project/:projectId/members/:userId/remove`

企画メンバーを削除します。

- 認証必須
- 実行者は OWNER または SUB_OWNER
- 対象がメンバーであること
- OWNER/SUB_OWNER 自身は削除不可
- 実体は論理削除（`deletedAt` 設定）

### POST `/project/:projectId/members/:userId/promote`

企画メンバーを副責任者に任命します。

- 認証必須
- 実行者は OWNER のみ
- 対象は当該企画のメンバーであること
- 既に副責任者がいる場合は不可
- OWNER を副責任者に指定することは不可
- さらに「他企画ですでに OWNER/SUB_OWNER ではない」ことを検証

---

## 役職と制約

役職は `OWNER / SUB_OWNER / MEMBER` の 3 種です。

- OWNER
  - 設定変更、招待コード再生成、副責任者任命が可能
- SUB_OWNER
  - メンバー削除が可能
- MEMBER
  - メンバー一覧の閲覧が可能

重要制約:

- 副責任者は 1 企画につき 1 人
- OWNER/SUB_OWNER は削除 API の対象外
- ユーザーは「別企画ですでに OWNER/SUB_OWNER」である場合、他企画の副責任者に任命されない
