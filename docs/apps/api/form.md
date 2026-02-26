# Form API 仕様

このページは、フォーム関連 API の仕様をまとめたドキュメントです。

- 実委向けフォーム管理: `apps/api/src/routes/committee-form.ts`
- 企画向けフォーム回答: `apps/api/src/routes/project-form.ts`

> 型定義・リクエスト/レスポンスの Zod スキーマは `packages/shared/src/endpoints/committee-form.ts` / `packages/shared/src/endpoints/project-form.ts` と `packages/shared/src/schemas/form.ts` を参照してください。

---

## 目次

- [Form API 仕様](#form-api-仕様)
	- [目次](#目次)
	- [概要](#概要)
		- [データモデル](#データモデル)
		- [設問型](#設問型)
	- [権限モデル](#権限モデル)
		- [実委向け（`/committee/forms`）](#実委向けcommitteeforms)
		- [企画向け（`/project/:projectId/forms`）](#企画向けprojectprojectidforms)
	- [公開申請（承認ワークフロー）](#公開申請承認ワークフロー)
		- [申請時バリデーション](#申請時バリデーション)
		- [編集制約](#編集制約)
	- [回答ワークフロー（企画メンバー）](#回答ワークフロー企画メンバー)
	- [実委向け API（`/committee/forms`）](#実委向け-apicommitteeforms)
		- [エンドポイント一覧](#エンドポイント一覧)
		- [補足](#補足)
	- [企画向け API（`/project/:projectId/forms`）](#企画向け-apiprojectprojectidforms)
		- [エンドポイント一覧](#エンドポイント一覧-1)
		- [一覧表示条件](#一覧表示条件)
		- [回答作成/更新](#回答作成更新)
	- [回答バリデーション詳細](#回答バリデーション詳細)
		- [1. 設問 ID の妥当性](#1-設問-id-の妥当性)
		- [2. 選択肢 ID の妥当性](#2-選択肢-id-の妥当性)
		- [3. 提出時の必須回答チェック](#3-提出時の必須回答チェック)
		- [4. 期限チェック](#4-期限チェック)
	- [実装参照](#実装参照)

---

## 概要

フォーム機能は、実委人がフォームを作成し、企画に配信して回答を回収するための仕組みです。

```txt
作成 → 共同編集 → 公開申請 → 承認 → 企画へ配信 → 下書き/提出
```

### データモデル

| モデル | 説明 |
|---|---|
| `Form` | フォーム本体（タイトル・説明） |
| `FormItem` | 設問（ラベル・説明・型・必須フラグ） |
| `FormItemOption` | 選択肢（SELECT / CHECKBOX 用） |
| `FormCollaborator` | 共同編集者（書き込み権限あり） |
| `FormAuthorization` | 公開申請（承認ステータス・配信設定） |
| `FormDelivery` | 配信先企画 |
| `FormResponse` | 企画メンバーの回答ヘッダ（下書き/提出） |
| `FormAnswer` | 設問ごとの回答値 |

### 設問型

`FormItem.type` は以下を扱います。

- `TEXT`
- `TEXTAREA`
- `NUMBER`
- `FILE`
- `SELECT`
- `CHECKBOX`

---

## 権限モデル

### 実委向け（`/committee/forms`）

- 認証: 全エンドポイントで `requireAuth` + `requireCommitteeMember`
- 編集可能ユーザー:
  - オーナー（`form.ownerId`）
  - `isWrite: true` の共同編集者
    - 2/26現在、`isWrite: false`のユーザーを作ることができる仕様にはしていない

### 企画向け（`/project/:projectId/forms`）

- 認証: 全エンドポイントで `requireAuth` + `requireProjectMember`
- 回答可能条件:
  - 承認済み（`APPROVED`）
  - 企画に配信済み
  - `scheduledSendAt <= now` のみ

---

## 公開申請（承認ワークフロー）

```txt
申請者（owner/共同編集者）
  → 承認者（FORM_DELIVER 権限保持者）を指定して申請
  → 承認者が APPROVED / REJECTED を決定
  → APPROVED の申請が各企画へ FormDelivery として配信
```

### 申請時バリデーション

- 申請者が owner または書き込み可能な共同編集者
- 承認依頼先ユーザーが存在すること
- 承認依頼先が実委人で、`FORM_DELIVER` 権限を持つこと
- `projectIds` で指定した配信先企画がすべて存在すること

### 編集制約

- `APPROVED` な公開申請が存在するフォームは編集不可
- フォーム削除はオーナーのみ

---

## 回答ワークフロー（企画メンバー）

企画メンバーは次の流れで回答します。

1. 一覧取得（`GET /project/:projectId/forms`）
2. 詳細取得（`GET /project/:projectId/forms/:formDeliveryId`）
3. 回答作成（`POST .../responses`）または更新（`PATCH .../responses/:responseId`）

回答時は `submit` フラグで状態を切り替えます。

- `submit: false` → 下書き保存
- `submit: true` → 提出

期限の扱い:

- 下書き保存時: 期限チェックなし
- 提出時: 期限チェックあり（`deadlineAt` 超過かつ `allowLateResponse=false` は拒否）

---

## 実委向け API（`/committee/forms`）

### エンドポイント一覧

| Method | Path | 概要 | 権限 |
|---|---|---|---|
| POST | `/committee/forms/create` | フォーム作成 | 実委人 |
| GET | `/committee/forms/list` | フォーム一覧 | 実委人 |
| GET | `/committee/forms/:formId/detail` | フォーム詳細 | 実委人 |
| PATCH | `/committee/forms/:formId/detail` | フォーム更新 | owner / 書込共同編集者 |
| DELETE | `/committee/forms/:formId` | フォーム削除（論理削除） | owner |
| POST | `/committee/forms/:formId/collaborators/:userId` | 共同編集者追加 | owner |
| DELETE | `/committee/forms/:formId/collaborators/:userId` | 共同編集者削除 | owner |
| POST | `/committee/forms/:formId/authorizations` | 公開申請 | owner / 書込共同編集者 |
| POST | `/committee/forms/:formId/authorizations/:authorizationId/approve` | 承認 | 申請先本人 |
| POST | `/committee/forms/:formId/authorizations/:authorizationId/reject` | 却下 | 申請先本人 |
| GET | `/committee/forms/:formId/responses` | 回答一覧 | owner / 書込共同編集者 |

### 補足

- 更新 API は、送信された `items` を元に差分更新を行います。
  - 送信から外れた既存 item は削除対象
  - ただし回答が存在する item は削除不可
- item 更新時、選択肢は基本的に全置換されます（`deleteMany` + `create`）

---

## 企画向け API（`/project/:projectId/forms`）

### エンドポイント一覧

| Method | Path | 概要 |
|---|---|---|
| GET | `/project/:projectId/forms` | 配信済みフォーム一覧 |
| GET | `/project/:projectId/forms/:formDeliveryId` | フォーム詳細 + 既存回答 |
| POST | `/project/:projectId/forms/:formDeliveryId/responses` | 回答作成（下書き/提出） |
| PATCH | `/project/:projectId/forms/:formDeliveryId/responses/:responseId` | 回答更新（下書き/再提出） |

### 一覧表示条件

`GET /project/:projectId/forms` は、次の条件を満たす配信のみ返します。

- `FormAuthorization.status = APPROVED`
- `scheduledSendAt <= now`

### 回答作成/更新

- 1企画につき 1 `formDeliveryId` に対して 1回答
- `POST` は既存回答がある場合エラー
- `PATCH` は自分の回答のみ更新可能

---

## 回答バリデーション詳細

回答保存時（`POST` / `PATCH`）には主に以下を検証します。

### 1. 設問 ID の妥当性

- 送信された `formItemId` が当該フォームの設問に存在すること

### 2. 選択肢 ID の妥当性

- `SELECT` / `CHECKBOX` では、`selectedOptionIds` が当該設問の選択肢 ID 集合に含まれること

### 3. 提出時の必須回答チェック

`submit: true` の場合のみ実施。

- `TEXT` / `TEXTAREA`: `textValue` が空でない
- `NUMBER`: `numberValue != null`
- `FILE`: `fileUrl` が空でない
- `SELECT` / `CHECKBOX`: `selectedOptionIds` が1件以上

### 4. 期限チェック

`submit: true` かつ次を満たす場合は提出を拒否します。

- `deadlineAt` が設定済み
- `allowLateResponse = false`
- `deadlineAt < now`

---

## 実装参照

- ルート定義:
  - `apps/api/src/routes/committee-form.ts`
  - `apps/api/src/routes/project-form.ts`
- shared endpoints:
  - `packages/shared/src/endpoints/committee-form.ts`
  - `packages/shared/src/endpoints/project-form.ts`
- shared schemas:
  - `packages/shared/src/schemas/form.ts`
