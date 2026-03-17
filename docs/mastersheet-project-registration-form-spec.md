# マスターシート × 企画登録フォーム連携 仕様書

## 1. 概要

企画登録フォーム（`ProjectRegistrationForm`）の設問回答を、マスターシートのカラム種別 `PROJECT_REGISTRATION_FORM_ITEM` として追加・表示する。

企画登録フォームの回答は企画の**基本情報**であり、読み取り専用。編集履歴や変更追跡の仕組みは持たない。

---

## 2. データモデル

### 2.1 MastersheetColumnType

```
MastersheetColumnType: FORM_ITEM | CUSTOM | PROJECT_REGISTRATION_FORM_ITEM
```

### 2.2 MastersheetColumn の拡張

既存の `formItemId`（申請申請設問への FK）に加え、企画登録フォーム設問への FK を追加。

```
MastersheetColumn
├── ...（既存フィールド）
├── formItemId                          String?  FK → FormItem（FORM_ITEM 用、既存）
├── projectRegistrationFormItemId       String?  FK → ProjectRegistrationFormItem（新規）
```

- `type = PROJECT_REGISTRATION_FORM_ITEM` のとき `projectRegistrationFormItemId` が必須
- `projectRegistrationFormItemId` には unique 制約を付与（1設問1カラム）

### 2.3 MastersheetCellStatus

```
MastersheetCellStatus: NOT_DELIVERED | NOT_ANSWERED | SUBMITTED | COMMITTEE_EDITED | NOT_APPLICABLE
```

`NOT_APPLICABLE` を追加。`PROJECT_REGISTRATION_FORM_ITEM` カラムでのみ使用。

---

## 3. PROJECT_REGISTRATION_FORM_ITEM カラム

企画登録フォームの設問と連動する列。企画登録時の回答が自動的にセル値となる。

| 項目 | 内容 |
|------|------|
| データ型 | 設問の型に準じる（TEXT, TEXTAREA, SELECT, CHECKBOX, NUMBER, FILE） |
| 作成者 | 全実委人 |
| 公開範囲 | 全実委人（企画登録情報の閲覧は元々全員可のため制限なし） |
| セル値の保存先 | `ProjectRegistrationFormAnswer` |
| 1設問1カラム | 同じ `projectRegistrationFormItemId` で複数カラムは作成不可（unique 制約） |
| セル編集 | **不可（読み取り専用）** |

---

## 4. セル状態

### 4.1 状態一覧

| 状態 | 条件 | 表示 |
|------|------|------|
| NOT_APPLICABLE | 回答が存在しない | 「─」（グレー） |
| SUBMITTED | 企画登録時に回答が提出された | 回答値 |

回答が存在しないケース:
- 企画登録フォームが**企画作成後に**追加・有効化された場合（既存企画には回答がない）
- 企画の `type` / `location` が申請の `filterTypes` / `filterLocations` に合致しなかった場合

配信の概念がないため `NOT_DELIVERED` / `NOT_ANSWERED` は発生しない。読み取り専用のため `COMMITTEE_EDITED` は発生しない。

### 4.2 表示値の導出

`ProjectRegistrationFormAnswer` から直接値を取得する。`FORM_ITEM` のような EditHistory を介した導出は行わない。

```
ProjectRegistrationFormResponse が存在する場合:
  → 該当 ProjectRegistrationFormAnswer の値を表示
存在しない場合:
  → NOT_APPLICABLE（回答なし）
```

---

## 5. 可視性・アクセス申請

全実委人がアクセス可能。アクセス申請は**不要**。

アクセス申請エンドポイントに `PROJECT_REGISTRATION_FORM_ITEM` カラムが指定された場合はエラーを返す。

---

## 6. API

### 6.1 カラム作成

`POST /committee/mastersheet/columns`

```typescript
z.object({
  type: z.literal("PROJECT_REGISTRATION_FORM_ITEM"),
  name: z.string().min(1),
  description: z.string().optional(),
  sortOrder: z.number().int(),
  projectRegistrationFormItemId: z.cuid(),
})
```

作成条件:
- 実委人であること
- 対象の `ProjectRegistrationFormItem` に対してカラムが未作成であること

### 6.2 カラム定義レスポンス

`mastersheetColumnDefSchema` に以下を追加:

```typescript
projectRegistrationFormItemId: z.string().nullable(),
projectRegistrationFormItemType: formItemTypeSchema.nullable(),
```

### 6.3 GET /committee/mastersheet/data

`columns` 配列に `PROJECT_REGISTRATION_FORM_ITEM` 型のカラムが含まれる。

セル値の取得:
1. 対象申請の `ProjectRegistrationFormResponse` をバッチ取得
2. 対象の `ProjectRegistrationFormAnswer` から値を取得
3. 回答が存在すれば `SUBMITTED`、存在しなければ `NOT_APPLICABLE`

セルスキーマは `FORM_ITEM` と共通の `formValue` フィールドを使用:

```typescript
const mastersheetCellSchema = z.object({
  columnId: z.string(),
  status: mastersheetCellStatusSchema.optional(),     // FORM_ITEM / PRF_ITEM 用
  formValue: cellValueDataSchema.nullable().optional(), // FORM_ITEM / PRF_ITEM 用
  cellValue: cellValueDataSchema.nullable().optional(), // CUSTOM 用
});
```

### 6.4 セル編集

`PUT /committee/mastersheet/edits/:columnId/:projectId` は `FORM_ITEM` のみ対象。`PROJECT_REGISTRATION_FORM_ITEM` は編集不可。

---

## 7. 権限まとめ

| 操作 | CUSTOM | FORM_ITEM | PROJECT_REGISTRATION_FORM_ITEM |
|------|--------|-----------|-------------------------------|
| カラム作成 | 全実委人 | 申請 owner / collaborator | **全実委人** |
| カラム編集（名前等） | 作成者のみ | 作成者のみ | 作成者のみ |
| カラム削除 | 作成者のみ | 作成者のみ | 作成者のみ |
| カラムへのアクセス | 作成者 + viewer 設定に合致 | 申請 owner / collaborator | **全実委人** |
| セル編集 | アクセス可能な全員 | アクセス可能な全員 | **不可（読み取り専用）** |
| アクセス申請の承認 | カラム作成者 | 申請 owner | **不要** |
| 変更履歴の閲覧 | — | アクセス可能な全員 | **─（なし）** |

---

## 8. 構造比較（3種カラム）

| 項目 | CUSTOM | FORM_ITEM | PROJECT_REGISTRATION_FORM_ITEM |
|------|--------|-----------|-------------------------------|
| 現在値の保存先 | `MastersheetCellValue` | `FormItemEditHistory`（最新）→ `FormAnswer` | `ProjectRegistrationFormAnswer` |
| 変更履歴 | なし | `FormItemEditHistory` | **なし** |
| 選択肢テーブル | `MastersheetCellSelectedOption` | `FormItemEditHistorySelectedOption` | `ProjectRegistrationFormAnswerSelectedOption` |
| 編集者 | 実委人のみ | 企画メンバー + 実委人 | **なし（読み取り専用）** |
| 配信の概念 | なし | あり | なし |
| 回答なしの扱い | — | NOT_DELIVERED / NOT_ANSWERED | NOT_APPLICABLE |
