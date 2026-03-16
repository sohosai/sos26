# マスターシート × 企画登録フォーム連携 仕様書

## 1. 概要

企画登録フォーム（`ProjectRegistrationForm`）の設問回答を、マスターシートのカラムとして追加・表示できるようにする。

企画登録フォームの回答は企画の**基本情報**であり、申請フォーム（`Form`）とは性質が異なる。読み取り専用で、編集履歴や変更追跡の仕組みは持たない。

### 1.1 現状

| 項目 | 申請フォーム（Form） | 企画登録フォーム（ProjectRegistrationForm） |
|------|---------------------|------------------------------------------|
| マスターシート連携 | `FORM_ITEM` カラムとして対応済み | **未対応** |
| 回答の保存先 | `FormAnswer` + `FormItemEditHistory` | `ProjectRegistrationFormAnswer` |
| 配信の概念 | あり（`FormDelivery`） | なし（企画登録時に自動回答） |
| 回答タイミング | 配信後に任意のタイミング | 企画作成時のみ |
| 再提出 | 可能 | 不可（企画作成は1回のみ） |
| 編集 | 企画メンバー（再提出）+ 実委人 | **不可（読み取り専用）** |
| 変更履歴 | `FormItemEditHistory`（append-only） | **なし** |

### 1.2 ゴール

- 新しいカラム種別 `PROJECT_REGISTRATION_FORM_ITEM` を追加
- 全実委人がカラムを作成・閲覧可能
- 回答値をマスターシート上で閲覧可能（読み取り専用）
- 既存の `FORM_ITEM` / `CUSTOM` と統一的に管理

---

## 2. カラム種別の追加

### 2.1 MastersheetColumnType の拡張

```
MastersheetColumnType: FORM_ITEM | CUSTOM | PROJECT_REGISTRATION_FORM_ITEM
```

### 2.2 PROJECT_REGISTRATION_FORM_ITEM カラム

企画登録フォームの設問と連動する列。企画登録時の回答が自動的にセル値となる。

| 項目 | 内容 |
|------|------|
| データ型 | 設問の型に準じる（TEXT, TEXTAREA, SELECT, CHECKBOX, NUMBER, FILE） |
| 作成者 | 全実委人 |
| 公開範囲 | 全実委人（企画登録情報の閲覧は元々全員可のため制限なし） |
| セル値の保存先 | `ProjectRegistrationFormAnswer` |
| 1設問1カラム | 同じ `projectRegistrationFormItemId` で複数カラムは作成不可（unique 制約） |

---

## 3. データモデル

### 3.1 MastersheetColumn の拡張

既存の `formItemId`（申請フォーム設問への FK）に加え、企画登録フォーム設問への FK を追加。

```
MastersheetColumn
├── ...（既存フィールド）
├── formItemId                          String?  FK → FormItem（FORM_ITEM 用、既存）
├── projectRegistrationFormItemId       String?  FK → ProjectRegistrationFormItem（新規）
```

- `type = PROJECT_REGISTRATION_FORM_ITEM` のとき `projectRegistrationFormItemId` が必須
- `projectRegistrationFormItemId` には unique 制約を付与（1設問1カラム）

### 3.2 表示値の導出

`ProjectRegistrationFormAnswer` から直接値を取得する。申請フォーム（FORM_ITEM）のような EditHistory を介した導出は行わない。

```
ProjectRegistrationFormResponse が存在する場合:
  → 該当 ProjectRegistrationFormAnswer の値を表示
存在しない場合:
  → NOT_APPLICABLE（回答なし）
```

---

## 4. セル状態

### 4.1 FORM_ITEM との違い

申請フォームには「配信」の概念があるため `NOT_DELIVERED` / `NOT_ANSWERED` の状態が存在するが、企画登録フォームは企画作成時に必ず回答が提出されるため、これらの状態は原則発生しない。

また、申請フォームでは実委人による編集があるため `COMMITTEE_EDITED` が発生するが、企画登録情報は読み取り専用のため発生しない。

ただし、以下のケースで回答が存在しないことがある:
- 企画登録フォームが**企画作成後に**追加・有効化された場合（既存企画には回答がない）
- 企画の `type` / `location` がフォームの `filterTypes` / `filterLocations` に合致しなかった場合

### 4.2 状態一覧

```
NOT_APPLICABLE   企画がフォームの対象外（filter 不一致）、またはフォームが企画作成後に追加された
SUBMITTED        企画登録時に回答が提出された
```

| 状態 | 条件 | 表示 |
|------|------|------|
| NOT_APPLICABLE | 回答が存在しない | 「─」（グレー） |
| SUBMITTED | 企画登録時に回答が提出された | フォーム回答値 |

### 4.3 状態の導出ロジック

```typescript
function computePrfCellStatus(
  response: ProjectRegistrationFormResponse | null,
): MastersheetCellStatus {
  if (!response) return "NOT_APPLICABLE";
  return "SUBMITTED";
}
```

### 4.4 MastersheetCellStatus の拡張

```
MastersheetCellStatus: NOT_DELIVERED | NOT_ANSWERED | SUBMITTED | COMMITTEE_EDITED | NOT_APPLICABLE
```

`NOT_APPLICABLE` を追加。`PROJECT_REGISTRATION_FORM_ITEM` カラムでのみ使用。

---

## 5. カラムの可視性

企画登録情報の閲覧は元々全実委人に公開されているため、`PROJECT_REGISTRATION_FORM_ITEM` カラムは**全実委人がアクセス可能**。アクセス申請は不要。

---

## 6. セル編集

企画登録情報由来カラムは**読み取り専用**。実委人によるセル値の編集は不可。変更履歴も存在しない。

| セル状態 | 編集可否 |
|----------|----------|
| NOT_APPLICABLE | 不可 |
| SUBMITTED | 不可 |

---

## 7. カラム作成

### 7.1 作成条件

- 実委人であること（全実委人が作成可能）
- 対象の `ProjectRegistrationFormItem` に対してカラムが未作成であること

### 7.2 API

`POST /committee/mastersheet/columns` の `createMastersheetColumnRequestSchema` に新しい discriminated union メンバーを追加:

```typescript
z.object({
  type: z.literal("PROJECT_REGISTRATION_FORM_ITEM"),
  name: z.string().min(1),
  description: z.string().optional(),
  sortOrder: z.number().int(),
  projectRegistrationFormItemId: z.cuid(),
})
```

### 7.3 レスポンス

`mastersheetColumnDefSchema` に以下を追加:

```typescript
projectRegistrationFormItemId: z.string().nullable(),
projectRegistrationFormItemType: formItemTypeSchema.nullable(),
```

---

## 8. アクセス申請フロー

`PROJECT_REGISTRATION_FORM_ITEM` カラムは全実委人がアクセス可能なため、アクセス申請フローは**不要**。アクセス申請エンドポイントに `PROJECT_REGISTRATION_FORM_ITEM` カラムが指定された場合はエラーを返す。

---

## 9. GET /committee/mastersheet/data への影響

### 9.1 カラム定義

`columns` 配列に `PROJECT_REGISTRATION_FORM_ITEM` 型のカラムが含まれるようになる。

### 9.2 セル値の取得

企画登録フォームの回答を取得する際は:

1. 全ての `ProjectRegistrationFormResponse` を取得
2. 対象の `ProjectRegistrationFormAnswer` から値を取得
3. 回答が存在すれば `SUBMITTED`、存在しなければ `NOT_APPLICABLE`

### 9.3 セルスキーマ

既存の `mastersheetCellSchema` に `formValue` フィールドを共用。`PROJECT_REGISTRATION_FORM_ITEM` と `FORM_ITEM` は同じ構造でセル値を返す。

```typescript
const mastersheetCellSchema = z.object({
  columnId: z.string(),
  status: mastersheetCellStatusSchema.optional(),     // FORM_ITEM / PRF_ITEM 用
  formValue: cellValueDataSchema.nullable().optional(), // FORM_ITEM / PRF_ITEM 用
  cellValue: cellValueDataSchema.nullable().optional(), // CUSTOM 用
});
```

---

## 10. 権限まとめ

| 操作 | CUSTOM | FORM_ITEM | PROJECT_REGISTRATION_FORM_ITEM |
|------|--------|-----------|-------------------------------|
| カラム作成 | 全実委人 | フォーム owner / collaborator | **全実委人** |
| カラム編集（名前等） | 作成者のみ | 作成者のみ | 作成者のみ |
| カラム削除 | 作成者のみ | 作成者のみ | 作成者のみ |
| カラムへのアクセス | 作成者 + viewer 設定に合致 | フォーム owner / collaborator | **全実委人** |
| セル編集 | アクセス可能な全員 | アクセス可能な全員 | **不可（読み取り専用）** |
| アクセス申請の承認 | カラム作成者 | フォーム owner | **不要** |
| 変更履歴の閲覧 | — | アクセス可能な全員 | **─（なし）** |

---

## 11. 構造比較（3種カラム）

| 項目 | CUSTOM | FORM_ITEM | PROJECT_REGISTRATION_FORM_ITEM |
|------|--------|-----------|-------------------------------|
| 現在値の保存先 | `MastersheetCellValue` | `FormItemEditHistory`（最新）→ `FormAnswer` | `ProjectRegistrationFormAnswer` |
| 変更履歴 | なし | `FormItemEditHistory` | **なし** |
| 選択肢テーブル | `MastersheetCellSelectedOption` | `FormItemEditHistorySelectedOption` | `ProjectRegistrationFormAnswerSelectedOption` |
| 編集者 | 実委人のみ | 企画メンバー + 実委人 | **なし（読み取り専用）** |
| 配信の概念 | なし | あり | なし |
| 回答なしの扱い | — | NOT_DELIVERED / NOT_ANSWERED | NOT_APPLICABLE |

---

## 12. 実装で変更が必要な箇所

### 12.1 DB スキーマ（Prisma）

- `MastersheetColumnType` enum に `PROJECT_REGISTRATION_FORM_ITEM` を追加
- `MastersheetColumn` に `projectRegistrationFormItemId` フィールドを追加（optional, unique）
- `MastersheetCellStatus` enum に `NOT_APPLICABLE` を追加

### 12.2 共有スキーマ（packages/shared）

- `mastersheetColumnTypeSchema` に `PROJECT_REGISTRATION_FORM_ITEM` を追加
- `mastersheetCellStatusSchema` に `NOT_APPLICABLE` を追加
- `createMastersheetColumnRequestSchema` に新しいメンバーを追加
- `mastersheetColumnDefSchema` に `projectRegistrationFormItemId` / `projectRegistrationFormItemType` を追加

### 12.3 バックエンド（apps/api）

- `GET /committee/mastersheet/data` で企画登録フォーム回答を取得・セル値を構築
- `POST /committee/mastersheet/columns` で `PROJECT_REGISTRATION_FORM_ITEM` の作成を処理
- `PUT /committee/mastersheet/edits/:columnId/:projectId` は FORM_ITEM のみ対象（企画登録情報由来カラムは編集不可）
- アクセス申請は `PROJECT_REGISTRATION_FORM_ITEM` カラムに対しては不要（全実委人がアクセス可能）

### 12.4 フロントエンド（apps/web）

- `MastersheetTable` のカラムヘッダーに企画登録フォーム設問アイコンを追加
- `ColumnPanel` のカラム作成ダイアログで企画登録フォーム設問を選択可能にする
- `ColumnPanel` の discover 一覧に `PROJECT_REGISTRATION_FORM_ITEM` を表示

---

## 13. 未決事項

### 13.1 企画登録フォーム回答の再編集（企画側）

現状、企画登録フォームの回答は企画作成時のみ提出され、その後の編集はできない。将来的に企画側での再編集を許可する場合は、編集履歴テーブルの導入を検討する。
