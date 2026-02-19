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
