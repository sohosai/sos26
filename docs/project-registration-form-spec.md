# 企画登録フォーム機能 仕様書

## 1. 概要

実委人が企画登録用の追加フォームを作成し、承認フローを経て有効化する機能。有効化されたフォームは、企画登録のステップとして差し込まれ、企画区分・実施場所でフィルタリングされた上で申請者に表示される。回答は企画と紐づいて保存される。

---

## 2. 用語定義

| 用語 | 説明 |
|------|------|
| **企画登録フォーム（ProjectRegistrationForm）** | 実委人が作成する追加質問票。企画登録のステップとして利用される |
| **設問（ProjectRegistrationFormItem）** | フォーム内の1つの質問。タイプ・ラベル・必須フラグ・選択肢を持つ |
| **選択肢（ProjectRegistrationFormItemOption）** | SELECT / CHECKBOX 設問の選択肢 |
| **オーナー** | フォームの作成者。編集・削除・共同編集者管理・承認申請が可能 |
| **共同編集者（ProjectRegistrationFormCollaborator）** | オーナーが追加した実委人。フォームの編集・承認申請が可能 |
| **承認申請（ProjectRegistrationFormAuthorization）** | フォームを有効化するための承認リクエスト |
| **有効フォーム** | `isActive: true` のフォーム。企画登録に表示される |
| **回答（ProjectRegistrationFormResponse / Answer）** | 企画登録時に提出されたフォームへの回答。企画と紐づく |

---

## 3. 承認ステータス

| ステータス | Enum 値 | 説明 |
|-----------|---------|------|
| 承認待機中 | `PENDING` | 承認者の判断を待っている状態 |
| 承認済み | `APPROVED` | 承認され、フォームが有効化された状態（`isActive: true`） |
| 却下 | `REJECTED` | 承認者により却下された状態 |

### ステータス遷移

```
PENDING → APPROVED
  操作者: 承認者（requestedTo 本人、PROJECT_REGISTRATION_FORM_DELIVER 権限必須）
  効果: フォームの isActive が true になる

PENDING → REJECTED
  操作者: 承認者（requestedTo 本人）

PENDING → REJECTED（自動）
  トリガー: フォームが削除された場合、PENDING の申請は自動的に REJECTED になる
```

---

## 4. ロールと権限

### 4.1 委員会権限

| 権限 | Enum 値 | 説明 |
|------|---------|------|
| 作成・編集権限 | `PROJECT_REGISTRATION_FORM_CREATE` | フォームの作成・編集・削除・承認申請が可能 |
| 承認権限 | `PROJECT_REGISTRATION_FORM_DELIVER` | 承認申請の承認・却下が可能 |

### 4.2 権限マトリクス

| 操作 | オーナー | 共同編集者 | DELIVER 権限保持者 | その他の実委人 |
|------|:-------:|:---------:|:----------------:|:-------------:|
| フォーム作成 | — | — | — | CREATE 権限保持者のみ（作成後オーナーになる） |
| フォーム一覧・詳細閲覧（実委側） | o | o | o | o |
| フォーム編集 | o | o | x | x |
| フォーム削除 | o | x | x | x |
| 共同編集者管理 | o | x | x | x |
| 承認申請の送信 | o | x | x | x |
| 承認・却下 | — | — | o（requestedTo 本人のみ） | x |

> フォームの編集・削除・承認申請には加えて `PROJECT_REGISTRATION_FORM_CREATE` 権限も必要。

---

## 5. データモデル

> カラムの完全な定義は `apps/api/prisma/schema.prisma` を参照。

### 5.1 ER 概要

```
ProjectRegistrationForm ─┬─ ProjectRegistrationFormItem ── ProjectRegistrationFormItemOption
                          ├─ ProjectRegistrationFormAuthorization
                          ├─ ProjectRegistrationFormCollaborator
                          └─ ProjectRegistrationFormResponse ── ProjectRegistrationFormAnswer
                                                                 └── ProjectRegistrationFormAnswerSelectedOption
```

### 5.2 モデル解説

#### ProjectRegistrationForm

| フィールド | 説明 |
|-----------|------|
| `ownerId` | 作成者 User ID |
| `title` | フォームタイトル（デフォルト: 「無題の企画登録フォーム」） |
| `description` | 説明文（任意） |
| `isActive` | 有効フラグ。承認されると `true` になり企画登録に表示される |
| `sortOrder` | 企画登録でのステップ表示順 |
| `filterTypes` | 対象企画区分（空配列 = 全区分対象） |
| `filterLocations` | 対象実施場所（空配列 = 全場所対象） |
| `deletedAt` | 論理削除タイムスタンプ |

#### ProjectRegistrationFormItem（設問）

フォームに属する質問。`sortOrder` で表示順を制御。

| type | 説明 | 回答値 |
|------|------|--------|
| `TEXT` | 短文テキスト | `textValue` |
| `TEXTAREA` | 長文テキスト | `textValue` |
| `NUMBER` | 数値 | `numberValue` |
| `FILE` | ファイル | `fileUrl` |
| `SELECT` | 単一選択 | `ProjectRegistrationFormAnswerSelectedOption` |
| `CHECKBOX` | 複数選択 | `ProjectRegistrationFormAnswerSelectedOption` |

#### ProjectRegistrationFormCollaborator（共同編集者）

- `isWrite: true` 固定（書き込み権限のみ）
- `deletedAt`: 論理削除。再追加時は再アクティベーション
- **一意制約**: `(formId, userId)`

#### ProjectRegistrationFormAuthorization（承認申請）

- `requestedById` → User: 申請者
- `requestedToId` → User: 承認者（`PROJECT_REGISTRATION_FORM_DELIVER` 権限が必要）
- PENDING または APPROVED の申請が既に存在する場合は新規申請不可

#### ProjectRegistrationFormResponse / Answer（回答）

- `ProjectRegistrationFormResponse`: 企画 × フォームの回答単位
- `ProjectRegistrationFormAnswer`: 設問ごとの回答値
- `ProjectRegistrationFormAnswerSelectedOption`: SELECT / CHECKBOX の選択肢 ID
- **一意制約**: `(formId, projectId)` — 1 企画につき 1 フォームに対し最大 1 回答

---

## 6. フォームのライフサイクル（実委人視点）

### 6.1 フォーム作成

`PROJECT_REGISTRATION_FORM_CREATE` 権限を持つ実委人が作成できる。

- タイトル・説明文・設問・表示順・フィルタを一括で登録
- 作成時、指定 `sortOrder` 以降の既存フォームは自動的に +1 シフトされる
- 作成直後は `isActive: false`（下書き状態）

### 6.2 フォーム編集

#### 誰が編集できるか

- `PROJECT_REGISTRATION_FORM_CREATE` 権限を持つオーナーまたは共同編集者

#### いつ編集できるか

- `isActive: false` のフォームのみ編集可能
- 承認済み（`isActive: true`）のフォームは編集不可

#### 何を編集できるか

- タイトル・説明文・表示順・フィルタ
- 設問の追加・更新・削除（設問更新時、選択肢は全削除→再作成）

### 6.3 共同編集者の管理

`PROJECT_REGISTRATION_FORM_CREATE` 権限を持つオーナーのみが管理可能。

| 操作 | 挙動 |
|------|------|
| 追加 | 対象ユーザーの `CREATE` 権限を確認後、`ProjectRegistrationFormCollaborator` を作成 |
| 追加（論理削除済み） | `deletedAt` を `null` に戻して再アクティベーション |
| 削除 | `deletedAt` に現在日時をセット（論理削除） |

**制約:**
- オーナー自身を共同編集者に追加することはできない
- 追加対象は `PROJECT_REGISTRATION_FORM_CREATE` 権限を持つアクティブな実委人であること

### 6.4 承認ワークフロー

#### 状態遷移

```
isActive: false（下書き）
  │
  ├─ [承認申請を送信]（オーナー + CREATE 権限）
  ▼
PENDING（承認待機中）
  │
  ├─ [承認]（requestedTo 本人 + DELIVER 権限）
  │     ▼
  │   isActive: true（有効化）
  │
  └─ [却下]（requestedTo 本人）
        ▼
      REJECTED → 再申請可能
```

#### 申請の制約

- PENDING または APPROVED の申請が存在する場合は新規申請不可（Serializable トランザクションで二重申請を防止）
- 承認申請先は `PROJECT_REGISTRATION_FORM_DELIVER` 権限を持つ実委人であること

#### 承認・却下

- **承認（APPROVED）**: フォームの `isActive` が `true` になり、企画登録に表示される
- **却下（REJECTED）**: 申請者は内容を修正して再申請可能
- PENDING 状態でなければ操作不可

### 6.5 フォームの削除

- オーナー（+ `CREATE` 権限）のみが論理削除可能
- 削除時に PENDING の承認申請は自動的に REJECTED になる
- `isActive: true` のフォームは削除できない

---

## 7. 表示順の管理

- `sortOrder` が企画登録でのステップ表示順を決定する
- フォーム作成・更新時に `sortOrder` を指定すると、前後の既存フォームが自動シフトされる

---

## 8. 企画登録時の利用（ユーザー視点）

### 8.1 登録のフロー

企画登録は `ProjectCreateDialog` が担い、以下のステップで進む。

```
ステップ 0: 基本情報入力
  （企画名・企画団体名・企画区分・企画実施場所）
  │
  ├─ [次へ] → API で有効フォームを取得（filterTypes / filterLocations でフィルタ）
  │
  ├─ フォームが存在する場合
  │     ▼
  │   ステップ 1〜N: 各フォームへの回答入力
  │     │
  │     └─ ステップ N+1: 同意事項（→ 8.2）
  │
  └─ フォームが存在しない場合
        ▼
      ステップ 1: 同意事項（→ 8.2）
```

フォームの取得には `GET /project/registration-forms?type=&location=` を使用し、`sortOrder` 順に表示される。

### 8.2 同意事項ステップ

最終ステップとして、以下の2項目への同意チェックボックスが表示される。どちらも **必須**。

| # | 同意文 |
|---|--------|
| 1 | 企画登録に回答した方は、別の企画団体の企画責任者または副企画責任者になることはできません。 |
| 2 | ここで回答した内容（企画区分・企画実施場所・企画名・企画団体名）の修正・変更は、企画応募期間が終了すると簡単に行うことができません。 |

- 両項目に同意しない限り「登録する」ボタンは送信をブロックする
- 同意状態はフロントエンドで検証した上で、`agreedToRegistrationConstraints: true` / `agreedToInfoImmutability: true` として `POST /project/create` のリクエスト JSON に含めて送信する
- バックエンド（Zod スキーマ）でも `z.literal(true)` により両フィールドが `true` であることを検証する（DB には保存しない）

### 8.3 企画作成時の回答保存

`POST /project/create` がトランザクション内で以下を同時に実行する。

1. `Project` レコードを作成
2. `registrationFormAnswers` が存在する場合、フォームごとに `ProjectRegistrationFormResponse` + `ProjectRegistrationFormAnswer` を作成

---

## 9. API エンドポイント

### 9.1 実委側

ミドルウェア: `requireAuth` → `requireCommitteeMember`

| メソッド | パス | 説明 | 認可 |
|---------|------|------|------|
| POST | `/committee/project-registration-forms/create` | フォーム作成 | `CREATE` 権限 |
| GET | `/committee/project-registration-forms` | フォーム一覧 | 実委人全員 |
| GET | `/committee/project-registration-forms/:formId` | フォーム詳細 | 実委人全員 |
| PATCH | `/committee/project-registration-forms/:formId` | フォーム更新 | `CREATE` 権限 + オーナー / 共同編集者 |
| DELETE | `/committee/project-registration-forms/:formId` | フォーム削除 | `CREATE` 権限 + オーナー |
| POST | `/committee/project-registration-forms/:formId/authorizations` | 承認申請 | `CREATE` 権限 + オーナー |
| PATCH | `/committee/project-registration-forms/:formId/authorizations/:authorizationId` | 承認 / 却下 | `DELIVER` 権限 + `requestedTo` 本人 |
| POST | `/committee/project-registration-forms/:formId/collaborators/:userId` | 共同編集者追加 | `CREATE` 権限 + オーナー |
| DELETE | `/committee/project-registration-forms/:formId/collaborators/:userId` | 共同編集者削除 | オーナー |
| GET | `/committee/project-registration-forms/:formId/responses` | 回答一覧 | 実委人全員 |

### 9.2 企画登録側

ミドルウェア: `requireAuth`

| メソッド | パス | 説明 | 認可 |
|---------|------|------|------|
| GET | `/project/registration-forms` | 有効フォーム一覧（`type` / `location` クエリでフィルタ） | 認証済みユーザー |

企画作成時の回答送信は `POST /project/create` に含める（`docs/apps/api/project.md` 参照）。

---

## 10. UI 仕様

### 10.1 実委側一覧画面（`/committee/project-registration`）

- 全フォームを `sortOrder` 昇順 → 作成日時降順で一覧表示
- 各フォームに最新の承認ステータスをバッジ表示
  - 下書き（gray）/ 承認待機中（orange）/ 却下（red）/ 有効（green）
- `CREATE` 権限保持者には作成ボタンを表示

### 10.2 実委側詳細画面（`/committee/project-registration/:formId`）

- メイン: フォームのタイトル・説明文・設問プレビュー
- サイドバー:
  - オーナー情報
  - 共同編集者一覧（オーナーのみ追加・削除可能）
  - 承認ステータス（申請者・承認者情報、申請日時、判定日時）
  - 承認申請ボタン（オーナー + `CREATE` 権限に表示）
  - 承認・却下ボタン（`requestedTo` 本人に表示）

### 10.3 企画登録（`ProjectCreateDialog`）

- ステップ 0（基本情報）→ ステップ 1〜N（登録フォーム回答）→ 最終ステップ（同意事項）の順で進む
- 「戻る」で前のステップに戻れる
- 各登録フォームステップでは必須項目のバリデーションを実施
- 最終ステップで両同意チェックボックスにチェックしないと「登録する」を送信できない
