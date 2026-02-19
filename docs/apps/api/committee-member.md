# Committee Member API 仕様（`/committee/members`）

このページは `apps/api/src/routes/committee-member.ts` で提供している `/committee/members` 系 API をまとめた仕様書です。

> 型定義・リクエスト/レスポンスの Zod スキーマは `packages/shared/src/endpoints/committee-member.ts` と `packages/shared/src/schemas/committee-member.ts` を参照してください。

---

## 目次

- [共通仕様](#共通仕様)
- [エンドポイント一覧](#エンドポイント一覧)
- [各 API 詳細](#各-api-詳細)
  - [GET `/committee/members`](#get-committeemembers)
  - [POST `/committee/members`](#post-committeemembers)
  - [PATCH `/committee/members/:id`](#patch-committeemembersid)
  - [DELETE `/committee/members/:id`](#delete-committeemembersid)
- [権限管理 API](#権限管理-api)
  - [GET `/committee/members/:id/permissions`](#get-committeemembersidpermissions)
  - [POST `/committee/members/:id/permissions`](#post-committeemembersidpermissions)
  - [DELETE `/committee/members/:id/permissions/:permission`](#delete-committeemembersidpermissionspermission)

---

## 共通仕様

- ベースパス: `/committee/members`
- 認証: 全エンドポイントで `requireAuth` + `requireCommitteeMember` が必要
- 削除データ: `deletedAt` を持つモデルは、基本的に `deletedAt: null` を対象に扱う

---

## エンドポイント一覧

| Method | Path | 概要 |
|---|---|---|
| GET | `/committee/members` | 委員メンバー一覧を取得 |
| POST | `/committee/members` | 委員メンバーを作成 |
| PATCH | `/committee/members/:id` | 委員メンバーを更新 |
| DELETE | `/committee/members/:id` | 委員メンバーを論理削除 |
| GET | `/committee/members/:id/permissions` | 権限一覧を取得 |
| POST | `/committee/members/:id/permissions` | 権限を付与 |
| DELETE | `/committee/members/:id/permissions/:permission` | 権限を削除 |

---

## 各 API 詳細

### GET `/committee/members`

委員メンバー一覧を返します。

- `deletedAt: null` のメンバーのみ返却
- `user` リレーションを含む

### POST `/committee/members`

委員メンバーを作成します。

- 入力: `userId`、`Bureau`、`isExecutive`（任意）
- `userId` に対応するユーザーが存在しない場合: `NOT_FOUND`
- 既にアクティブなメンバーの場合: `ALREADY_EXISTS`
- ソフトデリート済みのメンバーが存在する場合は再有効化（`deletedAt: null`、`joinedAt` を更新）

### PATCH `/committee/members/:id`

委員メンバーの情報を部分更新します。

- 入力: `Bureau`（任意）、`isExecutive`（任意）
- 対象が存在しない場合: `NOT_FOUND`

### DELETE `/committee/members/:id`

委員メンバーを論理削除します。

- `deletedAt` に現在時刻を設定
- 対象が存在しない場合: `NOT_FOUND`

---

## 権限管理 API

委員メンバーに対して個別の権限を付与・削除するための API です。

### 権限の種類

| 権限名 | 説明 |
|---|---|
| `MEMBER_EDIT` | メンバー編集 |
| `NOTICE_DELIVER` | お知らせ配信 |
| `FORM_DELIVER` | フォーム配信 |

### GET `/committee/members/:id/permissions`

指定した委員メンバーの権限一覧を返します。

- 対象メンバーが存在しない場合: `NOT_FOUND`

### POST `/committee/members/:id/permissions`

委員メンバーに権限を付与します。

- 入力: `permission`（`MEMBER_EDIT` | `NOTICE_DELIVER` | `FORM_DELIVER`）
- 対象メンバーが存在しない場合: `NOT_FOUND`
- 同じ権限が既に付与されている場合: `ALREADY_EXISTS`

### DELETE `/committee/members/:id/permissions/:permission`

委員メンバーの権限を削除します。`:permission` には権限名（`MEMBER_EDIT` | `NOTICE_DELIVER` | `FORM_DELIVER`）を指定します。

- 不正な権限名の場合: `VALIDATION_ERROR`
- 対象メンバーが存在しない場合: `NOT_FOUND`
- 対象の権限が付与されていない場合: `NOT_FOUND`
