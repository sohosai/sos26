# マスターシート機能 仕様書

## 1. 用語定義

| 用語 | 説明 |
|------|------|
| マスターシート | 実委人が企画横断で情報を管理するスプレッドシート風の画面 |
| カラム | マスターシートの列。CUSTOM または FORM_ITEM の2種類がある |
| セル | カラムと企画の交差点。カラム種別に応じて値の管理方法が異なる |
| ビュー | ユーザーごとに保存されるテーブルの表示状態（ソート・フィルター・カラム表示/非表示） |

---

## 2. データモデル

### 2.1 テーブル一覧

#### カラム定義

| テーブル | 役割 |
|---------|------|
| `MastersheetColumn` | カラムの定義（型・名前・ソート順・作成者）。FORM_ITEM と CUSTOM の共通テーブル |
| `MastersheetColumnOption` | CUSTOM カラムの SELECT/MULTI_SELECT 用選択肢 |
| `MastersheetColumnViewer` | CUSTOM カラムの公開範囲設定（scope: ALL / BUREAU / INDIVIDUAL） |
| `MastersheetAccessRequest` | カラムへのアクセス申請（PENDING → APPROVED / REJECTED） |

#### CUSTOM カラムのセル値

| テーブル | 役割 |
|---------|------|
| `MastersheetCellValue` | セルの現在値。1セル1レコード（upsert） |
| `MastersheetCellSelectedOption` | SELECT/MULTI_SELECT の選択値（中間テーブル） |

#### フォーム回答とその編集履歴

| テーブル | 役割 |
|---------|------|
| `FormResponse` | フォーム回答（1配信1件）。`submittedAt` で下書き/提出済みを判別 |
| `FormAnswer` | 各設問への回答値。**企画者の提出時のみ**作成・上書きされる |
| `FormItemEditHistory` | フォーム設問の全編集履歴（append-only）。企画の提出・実委の編集を統一管理 |
| `FormItemEditHistorySelectedOption` | `FormItemEditHistory` の SELECT/CHECKBOX 選択値（中間テーブル） |

#### ビュー

| テーブル | 役割 |
|---------|------|
| `MastersheetView` | ユーザーごとの保存済みビュー（ソート・フィルター・カラム表示状態を JSON で保持） |

### 2.2 FORM_ITEM の表示値の導出

FORM_ITEM に関連するセルの表示値は `FormItemEditHistory` と `FormAnswer` から導出される。この導出はマスターシートだけでなく、委員会側のフォーム回答画面、企画側の回答確認画面など**全ての画面で共通**。

```
FormItemEditHistory に該当レコード（formItemId × projectId）がある場合:
  → 最新レコードの value を表示

FormItemEditHistory にレコードがない場合:
  → FormAnswer の値を表示（なければ null）
```

`FormItemEditHistory` は append-only で、レコードの削除・更新は行わない。

### 2.3 FormItemEditHistory スキーマ

```
FormItemEditHistory
├── id          String    PK
├── formItemId  String    FK → FormItem
├── projectId   String    FK → Project
├── textValue   String?   テキスト値
├── numberValue Float?    数値
├── fileUrl     String?   ファイル URL
├── selectedOptions  FormItemEditHistorySelectedOption[]  選択肢（中間テーブル）
├── actorId     String    FK → User（実委人 or 企画メンバー）
├── trigger     Enum      変更の種別（下記参照）
├── createdAt   DateTime  記録日時

FormItemEditHistorySelectedOption
├── id              String  PK
├── editHistoryId   String  FK → FormItemEditHistory
├── formItemOptionId String FK → FormItemOption
```

| trigger | 意味 | 誰が |
|---------|------|------|
| `PROJECT_SUBMIT` | 企画がフォーム回答を初回提出 | 企画メンバー |
| `PROJECT_RESUBMIT` | 企画がフォーム回答を再提出 | 企画メンバー |
| `COMMITTEE_EDIT` | 実委人がセル値を編集 | 実委人 |

### 2.4 FormAnswer との関係

| イベント | FormAnswer | FormItemEditHistory |
|---------|-----------|---------------------|
| 企画者が初回提出 | 作成 | `PROJECT_SUBMIT` を追加 |
| 企画者が再提出 | 上書き | `PROJECT_RESUBMIT` を追加 |
| 実委人が編集 | **変更しない** | `COMMITTEE_EDIT` を追加 |

- `FormAnswer` は企画者が「フォームで提出した値」を保持する記録
- 実委人の編集は `FormItemEditHistory` のみに記録される
- 表示には常に §2.2 のロジックを用いる

### 2.5 CUSTOM カラムと FORM_ITEM カラムの構造比較

| 項目 | CUSTOM | FORM_ITEM |
|------|--------|-----------|
| 現在値の保存先 | `MastersheetCellValue`（1セル1レコード） | `FormItemEditHistory`（最新）→ `FormAnswer`（フォールバック） |
| 変更履歴 | なし | `FormItemEditHistory`（append-only） |
| 選択肢の保存 | `MastersheetCellSelectedOption`（中間テーブル） | `FormItemEditHistorySelectedOption`（中間テーブル） |
| 編集者 | 実委人のみ | 企画メンバー（フォーム提出）+ 実委人（編集） |
| 履歴が必要な理由 | — | 企画と実委の双方が関与し、変更の追跡が必要なため |

---

## 3. カラム種別

### 3.1 CUSTOM カラム

実委人が自由に作成する列。データ型・公開範囲を設定できる。

| 項目 | 内容 |
|------|------|
| データ型 | TEXT, NUMBER, SELECT, MULTI_SELECT |
| 作成者 | 任意の実委人 |
| 公開範囲 | PRIVATE（作成者のみ）/ PUBLIC（viewer 設定に従う） |
| セル値の保存先 | `MastersheetCellValue` |
| 編集権限 | カラムにアクセスできる全員 |

### 3.2 FORM_ITEM カラム

フォームの設問と連動する列。フォーム回答が自動的にセル値となる。

| 項目 | 内容 |
|------|------|
| データ型 | フォーム設問の型に準じる（TEXT, TEXTAREA, SELECT, CHECKBOX, NUMBER, FILE） |
| 作成者 | フォームの owner または collaborator |
| 公開範囲 | フォームの owner / collaborator のみ（viewer 設定なし） |
| セル値の保存先 | `FormItemEditHistory`（最新）→ `FormAnswer`（フォールバック） |
| 1 設問 1 カラム | 同じ formItemId で複数カラムは作成不可（unique 制約） |

---

## 4. カラムの可視性

### 4.1 CUSTOM カラム

| viewer 設定 | visibility | アクセス可能者 |
|-------------|------------|------------|
| なし | PRIVATE | 作成者のみ |
| scope=ALL | PUBLIC | 全実委人 |
| scope=BUREAU:X | PUBLIC | 局 X に所属する実委人 |
| scope=INDIVIDUAL:U | PUBLIC | ユーザー U のみ |
| 複数 viewer の組合せ | PUBLIC | いずれかの条件に合致する実委人 |

- viewer の追加・削除で PRIVATE ↔ PUBLIC が自動切替される
- アクセス申請（`MastersheetAccessRequest`）の承認で `scope=INDIVIDUAL` の viewer が追加される

### 4.2 FORM_ITEM カラム

| 条件 | アクセス可否 |
|------|----------|
| フォームの owner | アクセス可 |
| フォームの collaborator（isWrite 不問） | アクセス可 |
| 上記以外 | アクセス不可 |

- アクセス申請の承認で `FormCollaborator(isWrite=true)` が作成され、アクセス可能になる

---

## 5. セル状態（FORM_ITEM カラムのみ）

### 5.1 状態一覧

セル状態は `FormItemEditHistory` の最新レコードの trigger で決まる。

```
NOT_DELIVERED    フォーム未配信
      ↓ (配信)
NOT_ANSWERED     配信済み・未提出（実委の編集不可）
      ↓ (企画が提出)
SUBMITTED        最新の変更が企画による
      ↓ (実委が編集)
COMMITTEE_EDITED 最新の変更が実委による
```

SUBMITTED と COMMITTEE_EDITED は相互に行き来する:
- 実委が編集すれば COMMITTEE_EDITED になる
- 企画が再提出すれば SUBMITTED になる

| 状態 | 条件 | 表示 | 実委の編集 |
|------|------|------|-----------|
| NOT_DELIVERED | フォーム配信が企画に届いていない | 「─」（グレー） | **不可** |
| NOT_ANSWERED | 配信済みだが未提出（下書きを含む） | 「─」 | **不可** |
| SUBMITTED | 最新の変更が企画の提出 | フォーム回答値 | 可 |
| COMMITTEE_EDITED | 最新の変更が実委の編集（`COMMITTEE_EDIT`） | 実委の編集値 | 可 |

**NOT_ANSWERED で編集不可の理由**: 企画が回答を提出していない段階で実委が値を入れると、企画側からは「自分が何も書いていないのに値がある」状態になる。旧 SOS でも提出前は編集不可だったため、同じ方針を踏襲する。

### 5.2 状態の導出ロジック

```typescript
function computeCellStatus(deliveryId, response, latestHistory) {
  if (!deliveryId) return "NOT_DELIVERED";
  if (!response?.submittedAt && !latestHistory) return "NOT_ANSWERED";
  if (latestHistory?.trigger === "COMMITTEE_EDIT") return "COMMITTEE_EDITED";
  return "SUBMITTED"; // PROJECT_SUBMIT or PROJECT_RESUBMIT
}
```

### 5.3 NOT_DELIVERED の扱い

- フォーム配信がその企画に届いていない状態
- セルは「─」（グレー）を表示し、**編集 UI を表示しない**

### 5.4 NOT_ANSWERED の扱い

- 配信済みだが企画が回答を提出していない状態（下書き保存中を含む）
- セルは「─」を表示し、**編集 UI を表示しない**
- 企画がフォーム回答を提出すると `SUBMITTED` に遷移し、実委も編集可能になる

### 5.5 下書き回答の扱い

- 下書き状態（`submittedAt` が null）の回答はマスターシートに**表示しない**
- セル状態は `NOT_ANSWERED` として扱われる
- 企画が下書き保存→提出すると `SUBMITTED` に遷移する

---

## 6. セル編集

### 6.1 CUSTOM カラム

| 操作 | 保存先 | 条件 |
|------|--------|------|
| セル値の入力・変更 | `MastersheetCellValue` | カラムにアクセスできる全員 |

- 全データ型（TEXT, NUMBER, SELECT, MULTI_SELECT）が編集可能
- 同時編集は後勝ち（最後の PUT が反映）

### 6.2 FORM_ITEM カラム — 実委人による編集

内部的には `FormItemEditHistory` に `COMMITTEE_EDIT` レコードを追加する。`FormAnswer` は変更しない。

| 操作 | 内部動作 | 条件 |
|------|---------|------|
| セル値の編集 | `FormItemEditHistory` に `COMMITTEE_EDIT` を追加 | カラムにアクセスできる全員 |

#### 編集可否（データ型別）

| フォーム設問型 | UI での編集 | API での編集 |
|---------------|-------------|-------------|
| TEXT | 可（ダブルクリック→入力） | 可 |
| TEXTAREA | 可（ダブルクリック→入力） | 可 |
| NUMBER | 可（ダブルクリック→入力） | 可 |
| SELECT | 可（プルダウン選択） | 可 |
| CHECKBOX | 可（複数選択） | 可 |
| FILE | 不可（リンク表示のみ） | 可 |

#### 編集可否（セル状態別）

| セル状態 | 編集可否 | 操作後の状態 |
|----------|----------|-------------|
| NOT_DELIVERED | **不可** | — |
| NOT_ANSWERED | **不可** | — |
| SUBMITTED | 可 | → COMMITTEE_EDITED |
| COMMITTEE_EDITED | 可 | COMMITTEE_EDITED（値更新） |

#### 値の優先順位

```
FormItemEditHistory にレコードがある場合:
  → 最新レコードの value を表示
FormItemEditHistory にレコードがない場合:
  → FormAnswer の値を表示（なければ null → 「─」）
```

---

## 7. フォーム提出時の挙動

企画がフォーム回答を提出すると（初回・再提出とも同じ挙動）:

1. `FormAnswer` が回答値で作成（初回）または上書き（再提出）される
2. `FormItemEditHistory` に提出の記録が追加される（trigger: `PROJECT_SUBMIT` or `PROJECT_RESUBMIT`）
3. 提出レコードが最新になるため、セル状態は `SUBMITTED`、表示値は提出値になる

レコードの削除は発生しない。全ての変更は `FormItemEditHistory` に append される。

### 具体例

**提出→実委編集→再提出:**

```
FormItemEditHistory:
  [1] trigger=PROJECT_SUBMIT,   value="A"  ← 企画が提出   → 状態: SUBMITTED,        表示: "A"
  [2] trigger=COMMITTEE_EDIT,   value="B"  ← 実委が編集   → 状態: COMMITTEE_EDITED,  表示: "B"
  [3] trigger=PROJECT_RESUBMIT, value="C"  ← 企画が再提出 → 状態: SUBMITTED,         表示: "C"
```

常に最新レコードの trigger で状態が決まり、最新レコードの value が表示される。

---

## 8. 表示値の統一

`FormItemEditHistory` の最新レコードに基づく表示値は、以下の全画面で共通:

| 画面 | 表示内容 |
|------|---------|
| マスターシート（FORM_ITEM カラム） | 最新の値 |
| 委員会側フォーム回答一覧 | 最新の値 |
| 企画側フォーム回答確認画面 | 最新の値 |

どの画面で見ても同じ値が表示される。「誰が最後に編集したか」は画面によらず統一される。

---

## 9. 変更履歴と監査

### 9.1 記録対象

フォーム設問に対する全変更が `FormItemEditHistory` に append-only で記録される。

フォーム回答は企画メンバーと実委人の双方が関与するため、「誰がいつ何を変えたか」を追跡できる必要がある。CUSTOM カラムは実委人のみが編集するため履歴は記録しない。

| 操作 | trigger | actor |
|------|---------|-------|
| 企画がフォーム初回提出 | `PROJECT_SUBMIT` | 企画メンバー |
| 企画がフォーム再提出 | `PROJECT_RESUBMIT` | 企画メンバー |
| 実委人が値を編集 | `COMMITTEE_EDIT` | 実委人 |

### 9.2 監査シート（将来）

- `FormItemEditHistory` を時系列で表示する画面
- フォーム設問 × 企画ごとに、誰がいつ何を変えたかを一覧できる
- フォーム回答の変更と実委人の編集が統一的に見える

---

## 10. アクセス申請フロー

### 10.1 CUSTOM カラム

```
申請者 ──→ MastersheetAccessRequest(PENDING) ──→ カラム作成者が承認
                                                       ↓
                                              MastersheetColumnViewer(INDIVIDUAL) 作成
                                                       ↓
                                                   アクセス可能に
```

### 10.2 FORM_ITEM カラム

```
申請者 ──→ MastersheetAccessRequest(PENDING) ──→ フォーム owner が承認
                                                       ↓
                                              FormCollaborator(isWrite=true) 作成
                                                       ↓
                                           フォーム回答 + 全関連カラムにアクセス可能に
```

- 重複申請は不可（PENDING の申請が既にある場合は 409）
- 却下された場合はステータスが REJECTED に更新されるのみ

---

## 11. 権限まとめ

| 操作 | CUSTOM カラム | FORM_ITEM カラム |
|------|--------------|-----------------|
| カラム作成 | 全実委人 | フォーム owner / collaborator |
| カラム編集（名前等） | 作成者のみ | 作成者のみ |
| カラム削除 | 作成者のみ | 作成者のみ |
| カラムへのアクセス | 作成者 + viewer 設定に合致する実委人 | フォーム owner / collaborator |
| セル編集 | カラムにアクセスできる全員 | カラムにアクセスできる全員 |
| アクセス申請の承認 | カラム作成者 | フォーム owner |
| 変更履歴の閲覧 | — | カラムにアクセスできる全員 |

---

## 12. ビュー管理

- ビューはユーザーごとに独立（他ユーザーには影響しない）
- ビュー名はユーザー内で一意
- テーブル状態の変更は 1 秒デバウンスで自動保存される

### 12.1 保存される状態（`state` フィールド）

`MastersheetView.state` には以下の構造の JSON 文字列が保存される。

```typescript
type ViewState = {
  sorting?: SortingState;          // カラムのソート状態
  columnFilters?: ColumnFiltersState; // カラムごとのフィルター条件
  knownColumnIds?: string[];       // このビューで表示するカラム ID 一覧
};
```

### 12.2 `knownColumnIds` によるカラム表示管理

現在の実装では、カラムの表示/非表示は `knownColumnIds` のみで管理される。

| カラムの状態 | 表示/非表示 |
|-------------|-----------|
| `knownColumnIds` に含まれる | 表示 |
| `knownColumnIds` に含まれない | 非表示 |
| 固定カラム（企画番号等） | 常に表示 |

ビュー保存時に、その時点で表示中の全カラム ID を `knownColumnIds` に記録する。これにより、他ユーザーがカラムを追加しても既存ビューの表示状態が崩れない。

### 12.3 初回アクセス時

マスターシートに初めてアクセスしたとき、ビューが存在しない場合は「ビュー1」が自動作成される。現在のテーブル状態がそのまま保存される。

---

## 13. アクセス申請関連のメール通知

- アクセス申請が届いたとき → カラム作成者（CUSTOM）/ フォームオーナー（FORM_ITEM）へ通知
- アクセス申請が承認・却下されたとき → 申請者へ通知

### 13.1 送信タイミング

| イベント | 送信先 | トリガー |
|---------|--------|---------|
| アクセス申請の作成 | カラム管理者（CUSTOM: 作成者 / FORM_ITEM: フォームオーナー） | `POST /committee/mastersheet/columns/:columnId/access-request` |
| アクセス申請の承認 | 申請者 | `PATCH /committee/mastersheet/access-requests/:requestId` (status=APPROVED) |
| アクセス申請の却下 | 申請者 | `PATCH /committee/mastersheet/access-requests/:requestId` (status=REJECTED) |

### 13.2 実装ファイル

- テンプレート: `apps/api/src/lib/emails/templates/accessRequest{Received,Approved,Rejected}.ts`
- usecase: `apps/api/src/lib/emails/usecases/sendAccessRequest{Received,Decided}Email.ts`
- 通知関数: `apps/api/src/lib/notifications/notifyAccessRequest{Received,Decided}.ts`
- 呼び出し元: `apps/api/src/routes/committee-mastersheet/access-requests.ts`（fire-and-forget）

---

## 14. 未実装機能

### 14.1 編集履歴パネル

セルの編集履歴（誰がいつ何を変えたか）を確認できる UI。

- FORM_ITEM セルのホバー時に履歴アイコンを表示
- アイコンクリックで Popover を開き、`GET /committee/mastersheet/columns/:columnId/history/:projectId` を fetch
- `trigger` に応じたラベル: `PROJECT_SUBMIT` → 「提出」、`PROJECT_RESUBMIT` → 「再提出」、`COMMITTEE_EDIT` → 「実委編集」
- API は実装済み

### 14.2 配信設定モーダル統合

お知らせ・フォームの配信先選択 UI をマスターシートで実現する。

- 既存の企画選択 UI を `rowSelection: true` のマスターシート UI に置き換える
- 対象: お知らせ配信申請フロー、フォーム配信申請フロー
- DataTable の `rowSelection` 機能は実装済み

