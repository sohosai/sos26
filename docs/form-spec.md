# フォーム機能 仕様書

## 1. 概要

実委人（委員会メンバー）がフォームを作成し、承認フローを経て企画（プロジェクト）に配信する機能。企画メンバーは配信されたフォームに対して企画単位で回答を提出する。

---

## 2. 用語定義

| 用語 | 説明 |
|------|------|
| **フォーム（Form）** | 実委人が作成する質問票。タイトル・説明文・設問（FormItem）から構成される |
| **設問（FormItem）** | フォーム内の1つの質問。タイプ・ラベル・必須フラグ・選択肢を持つ |
| **選択肢（FormItemOption）** | SELECT / CHECKBOX 設問の選択肢 |
| **共同編集者（Collaborator）** | フォーム作成者以外でフォームの編集・閲覧ができる実委人 |
| **承認依頼（FormAuthorization）** | フォーム配信の承認申請。配信日時・締切・配信先企画を指定する |
| **配信（FormDelivery）** | 承認済みの承認依頼に紐づく、企画への配信レコード。1 承認依頼 × 1 企画 で 1 レコード |
| **回答（FormResponse）** | 1 配信（= 1 企画）に対する回答。企画単位で最大 1 つ |
| **個別回答（FormAnswer）** | 回答内の各設問に対する値 |
| **提出（Submit）** | 回答を正式に提出すること。`submittedAt` がセットされる |
| **下書き（Draft）** | 提出前の回答。`submittedAt` が `null` |

---

## 3. データモデル

> カラムの完全な定義は `apps/api/prisma/schema.prisma` を参照。ここでは仕様理解に必要な関係性・制約・挙動に関わるフィールドのみ記述する。

### 3.1 ER 概要

```
Form ─┬─ FormItem ── FormItemOption
      ├─ FormCollaborator
      └─ FormAuthorization ── FormDelivery ── FormResponse ── FormAnswer ── FormAnswerSelectedOption
```

### 3.2 モデル間の関係と仕様上の要点

#### Form

- `ownerId` → User: フォームの作成者。削除・共同編集者管理はこのユーザーのみ
- `deletedAt`: 論理削除。`null` でないフォームは一覧・詳細・企画側のいずれからも不可視

#### FormItem（設問）

- Form に属する。`sortOrder` で表示順を制御
- `type`: 設問タイプ。回答時に送信する値の種類を決定する

| type | 説明 | 回答値 |
|------|------|--------|
| `TEXT` | 短文テキスト | `textValue` |
| `TEXTAREA` | 長文テキスト | `textValue` |
| `NUMBER` | 数値 | `numberValue` |
| `FILE` | ファイル | `fileUrl` |
| `SELECT` | 単一選択 | `FormAnswerSelectedOption` |
| `CHECKBOX` | 複数選択 | `FormAnswerSelectedOption` |

- `required`: 提出（`submit: true`）時の必須チェック対象。下書き保存時はチェックされない

#### FormCollaborator（共同編集者）

- 追加時は常に `isWrite: true` で作成される（UI 上は切り替え不可）
- `deletedAt`: 論理削除。再追加時は再アクティベーション
- **一意制約**: `(formId, userId)`

#### FormAuthorization（承認依頼）

- `requestedById` → User: 依頼者
- `requestedToId` → User: 承認者（`FORM_DELIVER` 権限が必要）
- `status`: `PENDING` → `APPROVED` / `REJECTED`
- `scheduledSendAt`: 配信予定日時。この時刻を過ぎると企画側に表示される
- `deadlineAt`: 回答締切日時。`null` なら締切なし
- `allowLateResponse`: `true` なら締切後も回答操作可能
- `required`: 回答必須の表示フラグ（バックエンドでの強制はなし）

#### FormDelivery（配信）

- FormAuthorization × Project の中間テーブル
- **一意制約**: `(formAuthorizationId, projectId)`

#### FormResponse（回答）

- `respondentId` → User: 最後に編集したユーザー（監査用）
- `submittedAt`: 提出日時。`null` = 下書き。一度セットされたら `null` に戻らない
- **一意制約**: `(formDeliveryId)` — 1 配信（= 1 企画）につき最大 1 回答

#### FormAnswer（個別回答）

- FormResponse × FormItem ごとに 1 レコード
- タイプに応じて `textValue` / `numberValue` / `fileUrl` のいずれかに値が入る
- SELECT / CHECKBOX は `FormAnswerSelectedOption`（中間テーブル）で選択肢 ID を保持
- **一意制約**: `(formResponseId, formItemId)`

---

## 4. アクターと権限モデル

### 4.1 アクター一覧

| アクター | 説明 |
|---------|------|
| 実委人（Committee Member） | `CommitteeMember` テーブルに存在するユーザー |
| フォーム作成者（Owner） | `Form.ownerId` が自身のユーザー |
| 共同編集者（Collaborator） | `FormCollaborator` に登録されたユーザー。Owner と同等の編集権限を持つ |
| FORM_DELIVER 権限保持者 | `CommitteeMemberPermission` で `FORM_DELIVER` を持つ実委人 |
| 企画メンバー（Project Member） | 企画の owner / subOwner / member |

### 4.2 操作 × 権限マトリクス（実委人側）

| 操作 | Owner | Collaborator | その他の実委人 | 状態制約 |
|------|:-----:|:----------:|:-------------:|---------|
| フォーム作成 | — | — | 全員可 | — |
| フォーム一覧取得 | — | — | 全員可 | 削除済み除外 |
| フォーム詳細取得 | — | — | 全員可 | 削除済み除外 |
| フォーム編集 | OK | OK | NG | APPROVED な承認依頼が存在しないこと |
| フォーム削除 | OK | NG | NG | — |
| 共同編集者の追加 | OK | NG | NG | — |
| 共同編集者の削除 | OK | NG | NG | — |
| 承認依頼を送信 | OK | OK | NG | — |
| 承認 / 却下 | — | — | `requestedToId` 本人のみ | status = PENDING |
| 回答一覧閲覧 | OK | OK | NG | — |

### 4.3 操作 × 権限マトリクス（企画側）

全エンドポイントに `requireAuth` + `requireProjectMember` が必須。**自分が所属する企画宛に配信されたフォームのみ**が操作対象となる。

| 操作 | 企画メンバー | 追加条件 |
|------|:-----------:|---------|
| フォーム一覧 | OK | 自企画宛の配信済みフォームのみ（§5.5 表示条件参照） |
| フォーム詳細 | OK | 同上 |
| 回答作成（POST） | OK | 上記 + 企画として未回答であること + 締切内（§7 参照） |
| 回答更新（PATCH） | OK | 上記 + 該当配信の回答が存在すること + 締切内（§7 参照） |

---

## 5. フォームのライフサイクル（実委人視点）

### 5.1 フォーム作成

任意の実委人がフォームを作成できる。

- タイトル・説明文・設問を一括で登録
- 設問ごとにタイプ・ラベル・必須フラグ・補足説明を設定
- SELECT / CHECKBOX タイプの設問には選択肢を設定可能
- 設問は `sortOrder` で表示順を制御

作成直後のフォームは **DRAFT（公開申請前）** 状態。

### 5.2 フォーム編集

#### 誰が編集できるか

- Owner または Collaborator
- Owner/Collaborator でない実委人は編集不可

#### いつ編集できるか

- **APPROVED な FormAuthorization が 1 つでも存在する場合は編集不可**
  - PENDING や REJECTED の承認依頼は編集をブロックしない
  - つまり承認待ちの間はまだ編集可能、却下後は再編集可能
- 削除済みフォームは編集不可（そもそも取得できない）

#### 何を編集できるか

- フォームのタイトル・説明文
- 設問の追加・更新・削除・並び替え
- 設問更新時、選択肢は全削除→再作成（ID が変わる）

#### 設問削除の制約

- **回答（FormAnswer）が 1 つでも存在する設問は削除不可**
- 回答が存在しない設問は物理削除（Cascade により選択肢も削除）
- これにより配信済みフォームの設問構造が保護される

### 5.3 共同編集者の管理

Owner のみが管理可能。

| 操作 | 挙動 |
|------|------|
| 追加 | 対象ユーザーの存在確認後、`FormCollaborator` を作成 |
| 追加（論理削除済み） | `deletedAt` を `null` に戻して再アクティベーション |
| 削除 | `deletedAt` に現在日時をセット（論理削除） |

**制約:**
- Owner 自身を共同編集者に追加することはできない
- 対象ユーザーは削除されていない (`deletedAt = null`) ユーザーであること

### 5.4 承認ワークフロー

#### 5.4.1 状態遷移

```
DRAFT（公開申請前）
  │
  ├─ [承認依頼を送信]
  ▼
PENDING_APPROVAL（承認待ち）
  │
  ├─ [承認] ──▶ SCHEDULED（配信予定: scheduledSendAt > now）
  │              │
  │              ├─ [配信時刻到来: scheduledSendAt <= now]
  │              ▼
  │            PUBLISHED（配信済み）
  │              │
  │              ├─ [回答期限到来: deadlineAt <= now かつ deadlineAt != null]
  │              ▼
  │            EXPIRED（期限切れ）
  │
  └─ [却下] ──▶ REJECTED
                  │
                  └─ [再度承認依頼] ──▶ PENDING_APPROVAL
```

> **注**: DB 上の `FormAuthorization.status` は `PENDING` / `APPROVED` / `REJECTED` の 3 値のみ。`SCHEDULED` / `PUBLISHED` / `EXPIRED` はフロントエンドで `scheduledSendAt` / `deadlineAt` と現在時刻を比較して算出する **表示用ステータス**（§11 参照）。

#### 5.4.2 承認依頼の作成

**誰が:** Owner または Collaborator

**何を指定するか:**

| フィールド | 必須 | 説明 |
|-----------|:----:|------|
| `requestedToId` | 必須 | 承認者の User ID |
| `scheduledSendAt` | 必須 | 配信予定日時 |
| `deadlineAt` | 任意 | 回答締切日時 |
| `allowLateResponse` | 任意 | 遅延提出の許可（デフォルト: `false`） |
| `required` | 任意 | 回答必須（デフォルト: `true`） |
| `projectIds` | 必須 | 配信先企画 ID の配列（1 つ以上） |

**バリデーション:**
- 承認者が `FORM_DELIVER` 権限を持つ実委人であること
- `scheduledSendAt` が未来の日時であること
- `deadlineAt` が指定されている場合、`scheduledSendAt < deadlineAt` であること
- 配信先企画が全て存在し、削除されていないこと

**処理:**
- `FormAuthorization` を作成（status = `PENDING`）
- 指定された `projectIds` ごとに `FormDelivery` を作成

#### 5.4.3 承認 / 却下

**誰が:** `requestedToId` 本人のみ

**前提条件:**
- status が `PENDING` であること

**承認時の追加バリデーション:**
- フォームが削除されていないこと（`form.deletedAt` が `null`）
- `scheduledSendAt` が未来の日時であること（過去の日時は再申請を促す）
- `deadlineAt` が指定されている場合、`scheduledSendAt < deadlineAt` であること

**処理:**
- `status` を `APPROVED` または `REJECTED` に更新
- `decidedAt` に現在日時をセット

#### 5.4.4 却下後の再申請

- status が `REJECTED` の場合、フォームは編集可能に戻る
- 修正後、新たに承認依頼を作成できる（新しい `FormAuthorization` レコード）

### 5.5 配信

承認後、フォームは自動的に配信される。明示的な「配信」操作は不要。

**企画側でフォームが表示される条件（全て AND）:**
1. `FormAuthorization.status` = `APPROVED`
2. `scheduledSendAt` <= 現在日時
3. `form.deletedAt` = `null`

この 3 条件を満たすと、該当する `FormDelivery` に紐づく企画のフォーム一覧に自動表示される。

---

## 6. 承認依頼の設定項目と挙動

承認依頼作成時に指定する各設定項目が、以降のフローにどう影響するかを整理する。

### 6.1 `scheduledSendAt`（配信予定日時）

配信が開始されるタイミング。

| タイミング | 影響 |
|-----------|------|
| 承認依頼作成時 | 未来の日時であることをバリデーション |
| 承認時 | 再度未来の日時であることをバリデーション（申請と承認の間に過ぎた場合は承認不可） |
| 承認後〜配信前（now < scheduledSendAt） | 企画側にフォームは表示されない（SCHEDULED 状態） |
| 配信後（now >= scheduledSendAt） | 企画側にフォームが表示される（PUBLISHED 状態） |

### 6.2 `deadlineAt`（回答締切日時）

回答の締切。`null` の場合は締切なし。

| 条件 | 影響 |
|------|------|
| `deadlineAt` = `null` | 締切なし。いつでも回答・編集可能 |
| `now < deadlineAt` | 締切前。回答の作成・編集・提出が全て可能 |
| `now >= deadlineAt` | 締切後。`allowLateResponse` の設定に従う（§6.3 参照） |

**フロントエンド表示への影響:**
- `deadlineAt` が設定済みかつ `now >= deadlineAt` → 表示ステータスが `EXPIRED`（期間外）になる

### 6.3 `allowLateResponse`（遅延提出の許可）

締切後の回答操作を許可するかどうか。`deadlineAt` が `null` の場合はこの設定は無関係。

| deadlineAt | allowLateResponse | 締切後の挙動 |
|:----------:|:-----------------:|-------------|
| null | — | 常に回答可能（締切の概念なし） |
| 設定済み | `false`（デフォルト） | 締切後は回答の作成・編集・提出が**全て不可** |
| 設定済み | `true` | 締切後も回答の作成・編集・提出が**可能** |

**判定ロジック（`checkDeadline`）:**
```
deadlineAt が null           → 通過（締切なし）
allowLateResponse が true    → 通過（遅延許可あり）
now < deadlineAt             → 通過（締切前）
それ以外                      → エラー「回答期限を過ぎています」
```

> **注**: この締切チェックは回答の作成・編集時に `submit` の値に関わらず常に実行される。締切を過ぎると下書き保存もできない（`allowLateResponse = false` の場合）。

### 6.4 `required`（回答必須フラグ）

企画側の回答が必須かどうかを示す。

| required | 影響 |
|:--------:|------|
| `true`（デフォルト） | フロントエンドで「必須」として表示される |
| `false` | フロントエンドで「任意」として表示される |

> **注**: `required` はあくまで表示上のフラグ。API レベルでは `required = false` でも回答の作成・提出自体は可能。未回答を禁止するバックエンド制御はない。

### 6.5 設問の `required`（必須項目フラグ）

各設問の必須フラグ。これは承認依頼の `required` とは別の概念。

| 条件 | 影響 |
|------|------|
| `submit: false`（下書き保存） | 必須チェックは**スキップ**。未入力でも保存可能 |
| `submit: true`（提出） | 必須チェックが**実行**。空の必須項目があればエラー |

---

## 7. 回答ワークフロー（企画メンバー視点）

### 7.1 企画単位の回答モデル

- 1 つの `FormDelivery`（= 1 企画への配信）に対して `FormResponse` は**最大 1 つ**
- DB レベルで `@@unique([formDeliveryId])` により保証
- 企画の**誰が**作成・編集しても**同じ回答**を操作する
- `respondentId` は「最後に編集した人」として保持（監査用）

**例:**
> 企画メンバー A が下書きを保存 → メンバー B がフォームを開くと A の下書きが表示される → B が編集・提出すると `respondentId` は B になる

### 7.2 回答の状態遷移

```
[未回答] FormResponse なし
  → POST { submit: false } → [下書き]
  → POST { submit: true }  → [提出済み]

[下書き] submittedAt = null
  → PATCH { submit: false }  → [下書き]
  → PATCH { submit: true }   → [提出済み]

[提出済み] submittedAt あり
  → PATCH                    → [提出済み]（再提出扱い、submit フラグは無視）
```

**ポイント:**
- `submittedAt` は一度セットされたら `null` に戻らない（提出取り消し不可）
- 提出済み回答の PATCH は常に再提出。`submit` フラグは下書き→提出の遷移にのみ意味を持つ
- PATCH では全設問分の answers を送信する。DB 上には常に最後に保存された回答のみが存在する

### 7.3 回答の作成（POST）

`POST /:formDeliveryId/response` で新規回答を作成する。

**誰が:** 企画メンバー

**前提条件:**
- フォームが表示条件を満たしていること（§5.5）
- 該当配信に対して回答がまだ存在しないこと（存在する場合は 409 エラー）

```
1. FormDelivery の存在・表示条件チェック
2. 締切チェック（常に実行。§6.3 参照）
3. 選択肢 ID の妥当性チェック（§7.6）
4. 回答タイプの一致チェック（§7.6）
5. submit=true の場合:
   a. 必須項目チェック（§7.6）
6. FormResponse を作成
   - submittedAt = submit ? 現在日時 : null
   - respondentId = 操作者
7. FormAnswer を作成
```

### 7.4 回答の更新（PATCH）

`PATCH /:formDeliveryId/response` で既存回答を更新する。1 配信 1 回答のため `:responseId` は不要。

**誰が:** 企画メンバー（同じ企画の誰でも可）

**前提条件:**
- フォームが表示条件を満たしていること（§5.5）
- 該当配信に対する回答が存在すること（存在しない場合は 404 エラー）

#### 下書きの更新（submittedAt = null）

```
1. FormDelivery の存在・表示条件チェック
2. 締切チェック（常に実行。§6.3 参照）
3. 選択肢 ID の妥当性チェック（§7.6）
4. 回答タイプの一致チェック（§7.6）
5. submit=true の場合:
   a. 必須項目チェック（§7.6）
6. FormResponse を更新
   - submittedAt = submit ? 現在日時 : null
   - respondentId = 操作者
7. 送信された answers で FormAnswer を更新
```

#### 提出済み回答の更新（submittedAt != null）

```
1〜4. 上記と同じ
5. 必須項目チェック（submit フラグに関わらず常に実行）
6. FormResponse を更新
   - submittedAt = 現在日時（submit フラグに関わらず常に更新）
   - respondentId = 操作者
7. 送信された answers で FormAnswer を更新
```

> 提出済み回答は常に再提出扱いとなる。`submit=false` を送っても下書きに戻ることはなく、必須チェック・締切チェックも常に適用される。

### 7.5 回答操作の可否まとめ

| 状態 | 下書き保存 | 提出 | 提出済み回答の再提出 | 回答閲覧 |
|------|:--------:|:---:|:--------------:|:------:|
| SCHEDULED（配信前） | — | — | — | — |
| PUBLISHED・未回答 | OK | OK | — | — |
| PUBLISHED・下書き | OK | OK | — | OK |
| PUBLISHED・提出済み | — | — | OK | OK |
| EXPIRED・`allowLate=true` | OK | OK | OK | OK |
| EXPIRED・`allowLate=false` | NG | NG | NG | OK |
| フォーム削除済み | NG | NG | NG | NG |

### 7.6 回答バリデーション

#### 選択肢 ID の妥当性チェック（常に実行）

- SELECT / CHECKBOX タイプの回答で指定された `selectedOptionIds` が、該当設問の選択肢に存在すること
- 存在しない選択肢 ID が含まれている場合はエラー
- TEXT / TEXTAREA / NUMBER / FILE タイプの回答はこのチェックの対象外

#### 回答タイプの一致チェック（常に実行）

- 回答の `type` フィールドが、対応する設問の `type` と一致すること
- 例: 設問が `TEXT` なのに回答で `type: "NUMBER"` を送信するとエラー

#### 必須項目チェック

- **下書き時（`submit=false` かつ未提出）**: スキップ。途中段階の不完全な回答を保存可能
- **提出時（`submit=true`）**: 実行
- **提出済み回答の更新時**: `submit` フラグに関わらず常に実行

`required: true` の設問に対して、以下の条件で「空」と判定:

| タイプ | 空の判定 |
|--------|---------|
| TEXT / TEXTAREA | `textValue` が `null` または falsy（空文字含む） |
| NUMBER | `numberValue` が `null` |
| FILE | `fileUrl` が `null` または falsy（空文字含む） |
| SELECT / CHECKBOX | `selectedOptionIds` が `null`、未指定、または空配列 |

---

## 8. 実委人側の回答閲覧

### 8.1 閲覧権限

Owner または Collaborator が閲覧可能。Owner/Collaborator でない実委人は閲覧不可。

### 8.2 閲覧対象

- **提出済み（`submittedAt` が非 `null`）の回答のみ**が一覧に表示される
- 下書き状態の回答は実委人側には表示されない
- 各回答には回答者（`respondent`）、所属企画、提出日時、全設問の回答値が含まれる

---

## 9. 削除時の挙動

### 9.1 フォームの論理削除

**誰が:** Owner のみ

**処理:**
- `Form.deletedAt` に現在日時をセット
- 関連する `PENDING` ステータスの `FormAuthorization` は `REJECTED` に更新される

**削除後の影響:**

| 操作 | 可否 |
|------|------|
| 実委人側の一覧に表示 | されない |
| 実委人側の詳細取得 | 不可（404） |
| フォーム編集 | 不可 |
| 承認依頼の作成 | 不可 |
| 承認 | 不可（削除チェックで弾かれる） |
| 企画側の一覧に表示 | されない |
| 企画側の回答操作 | 不可（フォーム取得で 404） |

> **注**: 論理削除のため、DB 上のデータ（設問・回答・配信レコードなど）は残る。既に提出済みの回答データが失われることはない。

### 9.2 共同編集者の論理削除

- Owner のみが実行可能
- `FormCollaborator.deletedAt` に現在日時をセット
- 再追加時は `deletedAt` を `null` に戻す（再アクティベーション）

### 9.3 設問の削除（フォーム編集時）

- **回答（FormAnswer）が 1 つでも存在する設問は削除不可**
- 回答が存在しない設問は物理削除（Cascade により選択肢も削除）
- 設問の追加・削除は承認前（APPROVED な承認依頼がない状態）でのみ可能

---

## 10. API エンドポイント一覧

### 10.1 実委人側（`/committee/forms`）

#### フォーム管理

| メソッド | パス | 説明 | 権限 |
|---------|------|------|------|
| POST | `/create` | フォーム作成（設問・選択肢含む一括登録） | 実委人 |
| GET | `/list` | フォーム一覧取得（削除済み除外、最新承認情報付き） | 実委人 |
| GET | `/:formId/detail` | フォーム詳細（設問・共同編集者・承認詳細付き） | 実委人 |
| PATCH | `/:formId/detail` | フォーム編集（タイトル・説明・設問の CRUD） | Owner / Collaborator |
| DELETE | `/:formId` | フォーム論理削除 | Owner |

#### 共同編集者管理

| メソッド | パス | 説明 | 権限 |
|---------|------|------|------|
| POST | `/:formId/collaborators/:userId` | 共同編集者追加（再アクティベーション含む） | Owner |
| DELETE | `/:formId/collaborators/:userId` | 共同編集者論理削除 | Owner |

#### 承認フロー

| メソッド | パス | 説明 | 権限 |
|---------|------|------|------|
| POST | `/:formId/authorizations` | 承認依頼作成（配信先企画・日時・設定項目を指定） | Owner / Collaborator |
| PATCH | `/:formId/authorizations/:authorizationId` | 承認 / 却下 | requestedTo 本人 |

#### 回答閲覧

| メソッド | パス | 説明 | 権限 |
|---------|------|------|------|
| GET | `/:formId/responses` | 提出済み回答一覧（回答者・企画・回答値付き） | Owner / Collaborator |

### 10.2 企画側（`/project/:projectId/forms`）

| メソッド | パス | 説明 | 権限 |
|---------|------|------|------|
| GET | `/` | 配信済みフォーム一覧（回答状況付き） | 企画メンバー |
| GET | `/:formDeliveryId` | フォーム詳細 + 既存回答（下書き含む） | 企画メンバー |
| POST | `/:formDeliveryId/response` | 回答作成（下書き or 提出） | 企画メンバー |
| PATCH | `/:formDeliveryId/response` | 回答更新 | 企画メンバー |

### 10.3 共通ミドルウェア

| ミドルウェア | 説明 |
|-------------|------|
| `requireAuth` | Firebase ID Token 検証。Bearer トークンからユーザーを特定 |
| `requireCommitteeMember` | 実委人であることを検証 |
| `requireProjectMember` | 企画メンバー（owner / subOwner / member）であることを検証 |

---

## 11. 回答入力スキーマ

回答は `type` フィールドによる判別共用体（discriminated union）で表現される。

```typescript
// TEXT / TEXTAREA
{ formItemId: string, type: "TEXT" | "TEXTAREA", textValue: string | null }

// NUMBER
{ formItemId: string, type: "NUMBER", numberValue: number | null }

// FILE
{ formItemId: string, type: "FILE", fileUrl: string | null }

// SELECT / CHECKBOX
{ formItemId: string, type: "SELECT" | "CHECKBOX", selectedOptionIds: string[] }
```

リクエストボディ:
```typescript
{
  answers: FormAnswerInput[],
  submit: boolean  // false = 下書き, true = 提出
}
```

---

## 12. フロントエンド表示ステータス

フロントエンドでは承認情報と日時から以下の表示ステータスを算出する。

| 表示ステータス | コード | 条件 | バッジ色 |
|--------------|--------|------|---------|
| 公開申請前 | `DRAFT` | 承認依頼が存在しない | gray |
| 承認待機中 | `PENDING_APPROVAL` | status = PENDING | orange |
| 却下 | `REJECTED` | status = REJECTED | red |
| 公開予定 | `SCHEDULED` | status = APPROVED かつ scheduledSendAt > now | blue |
| 公開済み | `PUBLISHED` | status = APPROVED かつ scheduledSendAt <= now かつ (deadlineAt = null または deadlineAt > now) | green |
| 期間外 | `EXPIRED` | deadlineAt が設定済みかつ deadlineAt <= now | gray |

> **判定優先順位:** EXPIRED が最優先で評価される。deadlineAt を過ぎていれば status に関わらず EXPIRED となる。

**企画側の回答状況表示:**

| 表示 | 条件 |
|------|------|
| 未回答 | FormResponse が存在しない |
| 下書き | FormResponse が存在し、`submittedAt` = `null` |
| 提出済み | FormResponse が存在し、`submittedAt` が非 `null` |
| 期限切れ（操作不可） | EXPIRED かつ `allowLateResponse = false` |

---

## 13. シナリオ別の挙動

### 13.1 通常フロー

```
1. 実委人 A がフォームを作成（DRAFT）
2. 実委人 A が共同編集者 B を追加
3. 実委人 B がフォームを編集
4. 実委人 A が承認依頼を作成（承認者 C、配信: 4/1 10:00、締切: 4/7 23:59）
5. 実委人 C が承認（SCHEDULED）
6. 4/1 10:00 到来 → PUBLISHED（企画側に表示される）
7. 企画メンバー X が下書き保存
8. 企画メンバー Y が（X の下書きを引き継いで）編集・提出
9. 4/7 23:59 到来 → EXPIRED
10. 実委人 A/B が回答を閲覧
```

### 13.2 提出済み回答の再提出

```
前提: 締切内、企画メンバーが既に提出済み

1. メンバーがフォームを開く → 提出済みの回答が表示される
2. 内容を修正して PATCH
   → 回答内容が上書きされる
   → submittedAt が現在日時に更新される（再提出）
   → 必須チェック・締切チェックが適用される
3. submit フラグの値に関わらず、下書きには戻らない
```

### 13.3 締切後の遅延提出（allowLateResponse = true）

```
前提: deadlineAt を過ぎている、allowLateResponse = true

1. フロントエンドでは「期間外」と表示されるが、回答ボタンは有効
2. 企画メンバーが回答を作成・編集・提出 → 全て成功
3. 実委人側には通常通り回答が表示される
```

### 13.4 締切後の操作（allowLateResponse = false）

```
前提: deadlineAt を過ぎている、allowLateResponse = false

1. フロントエンドで回答ボタンが無効化される
2. API を直接呼んでも「回答期限を過ぎています」エラー
3. 下書き保存も提出も不可
4. 既に提出済みの回答は実委人側から閲覧可能
```

### 13.5 フォーム削除時の影響

```
1. 実委人 A がフォームを削除
2. PENDING の承認依頼があれば自動で REJECTED に
3. 既に APPROVED で配信済みでも、企画側からはフォームが見えなくなる
4. 既に提出された回答データは DB に残る（論理削除のため）
```

### 13.6 承認依頼の却下と再申請

```
1. 承認者 C が却下（REJECTED）
2. フォームは編集可能に戻る
3. 実委人 A がフォーム内容を修正
4. 実委人 A が新たな承認依頼を作成（同じ or 別の承認者、新しい日時）
5. 承認者が承認 → 新しい設定で配信される
```

---

## 14. TODO（仕様と実装の差分）

本仕様に対して、現在の実装で未対応の項目を整理する。

### 承認フロー

- [ ] **承認依頼の重複防止**
  同じフォームに対して PENDING / APPROVED の承認依頼が複数共存できてしまう。異なる配信設定（配信先・期限等）が同時に承認される可能性がある。お知らせ機能のように Serializable TX 内で既存の PENDING / APPROVED をチェックし、重複を防止すべき。
  対象: `committee-form.ts` POST `/:formId/authorizations`

- [ ] **削除時の PENDING 承認依頼処理**
  フォーム論理削除時に、関連する PENDING の承認依頼を REJECTED に更新する処理が未実装（§9.1 に要件記載済み）。現状では削除後も PENDING のまま残り、承認可能な状態が続く（ただし承認時の `deletedAt` チェックで弾かれるため実害は限定的）。
  対象: `committee-form.ts` DELETE `/:formId`

- [ ] **承認済みチェックのトランザクション化**
  フォーム編集時の「APPROVED な承認依頼が存在するなら編集不可」チェックがトランザクション外で実行されている。チェック後・TX 開始前に別リクエストで承認が通ると、承認済みフォームが編集されるレースコンディションが発生しうる。チェックを TX 内に移動すべき。
  対象: `committee-form.ts` PATCH `/:formId/detail`（L212-223）

### 共同編集者

- [ ] **`isWrite` フラグの活用**
  DB スキーマと API には `isWrite` フラグが存在するが、UI からは常に `true` で作成される（切り替え UI なし）。読み取り専用 Collaborator（回答閲覧のみ可）を導入するか、不要であればスキーマ・API から `isWrite` を削除して簡素化する。
  対象: `schema.prisma` FormCollaborator、`form.ts` addFormCollaboratorRequestSchema

### 回答（API）

- [ ] **回答エンドポイントの整理**
  現在のパスは `POST /:formDeliveryId/responses`（複数形）+ `PATCH /:formDeliveryId/responses/:responseId`（ID 必須）。1 配信 1 回答のため `:responseId` は冗長。パスを `POST + PATCH /:formDeliveryId/response`（単数形、ID 不要）に変更すべき。
  対象: `project-form.ts` L409, L467、`endpoints/project-form.ts`

- [ ] **回答の企画単位化**
  現在は `respondentId`（個人）単位で回答を管理しており、同じ配信に対して企画メンバーごとに別の回答が作られてしまう。`FormResponse` に `@@unique([formDeliveryId])` を追加して DB レベルで 1 配信 1 回答を保証し、クエリから `respondentId` フィルタを削除して企画の誰でも同じ回答を操作できるようにする。
  対象: `schema.prisma` FormResponse、`project-form.ts` L353, L432, L482

- [ ] **提出済み回答の再提出扱い**
  現在は `submittedAt = submit ? new Date() : null` で、提出済み回答に `submit: false` を送ると `submittedAt` が `null` に戻り下書きに逆戻りする。提出済み回答の更新時は `submit` フラグを無視し、常に `submittedAt = new Date()`（再提出）とすべき。必須チェックも提出済みなら常に実行する。
  対象: `project-form.ts` PATCH ハンドラ L491-499

- [ ] **回答タイプの一致チェック**
  `upsertAnswers` で回答の `type` と設問の `type` の一致を検証していない。例えば TEXT 設問に `type: "NUMBER"` の回答を送ってもエラーにならない。`if (type !== answer.type)` のチェックを追加すべき。
  対象: `project-form.ts` `upsertAnswers`（L92-97）

- [ ] **削除済みフォームの企画側フィルタ**
  `getDeliveryOrThrow` と企画側一覧の `where` 条件に `form: { deletedAt: null }` が含まれていない。論理削除されたフォームが企画側に表示され、回答操作も可能な状態。
  対象: `project-form.ts` `getDeliveryOrThrow`（L26-35）、GET `/`（L279-286）

- [ ] **締切チェックの常時実行**
  `checkDeadline` が `if (submit)` ブロック内でのみ実行されている。`submit: false`（下書き保存）でも締切後は操作不可とすべきなので、`submit` の値に関わらず常に実行する位置に移動する。
  対象: `project-form.ts` POST L426-429、PATCH L491-494

- [ ] **企画側一覧の回答サブクエリ**
  回答取得クエリが `formDelivery: { projectId }` のみでフィルタしており、`formAuthorization.status = APPROVED` や `scheduledSendAt <= now` の条件がない。一覧の配信側クエリでフィルタ済みのため表示には影響しないが、不要なデータを取得している。
  対象: `project-form.ts` GET `/`（L301-310）

### 回答（UI）

- [ ] **企画単位の回答表示**
  API 側の企画単位化（`respondentId` フィルタ削除）に伴い、同じ企画のメンバーがフォームを開いた際に、誰が保存した下書き・提出済み回答でも同じ内容が表示されることを確認する。現在は API が `respondentId: userId` でフィルタしているため、他のメンバーの下書きが見えない。
  対象: `ProjectFormAnswerDialog.tsx`（API レスポンスの表示部分）

- [ ] **提出済み回答の下書きボタン非表示**
  `FormViewer` で `onSaveDraft` が渡されていれば常に「下書き保存」ボタンを表示する。提出済み回答（`submittedAt != null`）では下書きに戻せないので、ボタンを非表示にすべき。
  対象: `FormViewer.tsx` L106、`ProjectFormAnswerDialog.tsx` L118

- [ ] **新規回答時の未操作設問**
  `buildAnswerBody` は `Object.entries(answers)` でシリアライズするため、ユーザーが一度も操作していない設問は `answers` に含まれず送信されない。フォームの全設問を走査して、未操作の設問にもデフォルト値（null / 空配列）を含めるべき。
  対象: `utils.ts` `buildAnswerBody`（L65-82）、`FormViewer.tsx` answers state 初期化（L22）

- [ ] **回答ダイアログ内の締切ガード**
  フォーム回答ダイアログ内に期限切れの判定がない。一覧画面のボタン無効化のみに依存している。ダイアログを開いた後に期限が到来した場合、ユーザーは保存・提出を試みることができる（API 側で弾かれるが、UX として不親切）。ダイアログ内でも `deadlineAt` を確認し、期限切れならボタンを無効化すべき。
  対象: `ProjectFormAnswerDialog.tsx`

### その他

- [ ] **承認依頼・承認/却下時の通知**
  お知らせ機能では承認依頼送信時・承認/却下時にプッシュ通知を送信している。フォームには同等の通知処理がない。承認依頼を受けた承認者、および承認/却下された依頼者への通知を追加すべき。
  対象: `committee-form.ts` POST `/:formId/authorizations`、PATCH `/:formId/authorizations/:authorizationId`

- [ ] **`findUniqueOrThrow` の統一**
  `GET /:formId/detail` で `findUniqueOrThrow` を使用しており、レコードが見つからない場合に Prisma の `NotFoundError` が throw され 500 エラーになる。`findFirst` + null チェック + `Errors.notFound()` のパターンに統一し、適切な 404 レスポンスを返すべき。
  対象: `committee-form.ts` L152

---

## 15. レビュー（実装上の課題・検討事項）

仕様の範囲外だが、実装上注意すべき課題を記録する。

- [ ] **期限チェックの境界値**
  `checkDeadline` で `deadlineAt < new Date()` と `<`（strict less than）で比較しているため、`deadlineAt` ちょうどの瞬間は提出可能。お知らせ機能は `<=` を使用しており不統一。どちらに揃えるか決定する。
