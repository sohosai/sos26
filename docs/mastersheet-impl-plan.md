# マスターシート機能 実装計画

> **参照**: [docs/mastersheet-plan.md](./mastersheet-plan.md) — 機能仕様
> **作成日**: 2026-03-03
> **ブランチ**: `feat/mastersheet`

---

## 残タスク一覧

> Phase 0〜4・5-A・5-D は完了済み。以下が未実装。

| # | タスク | Phase | 概要 |
|---|--------|-------|------|
| 1 | **FORM_ITEM「元に戻す」ボタン** | 5-B | オーバーライド済みセルに「元に戻す」ボタンを追加（編集自体は実装済み） |
| 2 | **閲覧申請の承認 UI** | 5-C | ColumnPanel に届いた申請を表示し承認/却下できるようにする |
| 3 | **編集履歴パネル** | 5-E | `CellHistoryPanel` を新規作成（`FormItemCell` にアイコン追加） |
| 4 | **配信設定モーダル統合** | 6 | DataTable に `rowSelection` を追加し、配信先選択を置き換え |

タスク 1〜3 は独立して着手可能。

---

## フェーズ概要

```
Phase 0: Enum リネーム           ✅
Phase 1: DB スキーマ追加          ✅
Phase 2: shared 型定義            ✅
Phase 3: API エンドポイント        ✅
Phase 4: DataTable 拡張           ✅
Phase 5: マスターシートページ      🔄 一部未完了（詳細は各 Sub-Phase 参照）
Phase 6: 配信設定モーダル統合      ⬜ 未着手
```

---

## Phase 0: Enum リネーム

既存 enum を汎用名に変更し、マスターシートと共用できるようにする。

### 0-1. `InquiryViewerScope` → `ViewerScope`

| ファイル | 変更内容 |
|---------|---------|
| `apps/api/prisma/schema.prisma` | enum 名・`InquiryViewer.scope` の型を変更 |
| `packages/shared/src/schemas/inquiry.ts` | `inquiryViewerScopeSchema` → `viewerScopeSchema`、型名も変更 |
| `apps/api/src/routes/committee-inquiry.ts` | 参照箇所を更新 |
| Web 側 Inquiry 関連コンポーネント | 型参照を更新 |

### 0-2. `FormAuthorizationStatus` → `ApprovalStatus`

| ファイル | 変更内容 |
|---------|---------|
| `apps/api/prisma/schema.prisma` | enum 名・`FormAuthorization.status` の型を変更 |
| `packages/shared/src/schemas/form.ts` | `formAuthorizationStatusSchema` → `approvalStatusSchema`、型名も変更 |
| `apps/api/src/routes/committee-form.ts` | 参照箇所を更新 |
| Web 側フォーム関連コンポーネント | 型参照を更新 |

### 完了確認

```bash
bun run typecheck
bun run db:migrate
```

---

## Phase 1: DB スキーマ追加

`apps/api/prisma/schema.prisma` に以下を追加する。

### 新規 Enum

```prisma
enum MastersheetColumnType {
  FORM_ITEM  // フォーム由来
  CUSTOM     // 自由追加
}

enum MastersheetDataType {
  TEXT
  NUMBER
  SELECT
  MULTI_SELECT
}

enum MastersheetColumnVisibility {
  PRIVATE
  PUBLIC
}
```

### 新規 Model

```prisma
// ─── カラム定義 ───

model MastersheetColumn {
  id          String                       @id @default(cuid())
  type        MastersheetColumnType
  name        String
  description String?
  sortOrder   Int
  createdById String
  createdBy   User                         @relation(fields: [createdById], references: [id])

  // フォーム由来カラムの場合
  formItemId  String?
  formItem    FormItem?                    @relation(fields: [formItemId], references: [id])

  // 自由追加カラムの場合
  dataType    MastersheetDataType?
  visibility  MastersheetColumnVisibility?

  viewers        MastersheetColumnViewer[]
  options        MastersheetColumnOption[]
  cellValues     MastersheetCellValue[]
  overrides      MastersheetOverride[]
  editHistory    MastersheetEditHistory[]
  accessRequests MastersheetAccessRequest[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

// ─── 自由追加カラムの選択肢 ───
// セル値は label ではなく id で参照する（ラベル変更時の不整合を防ぐ）

model MastersheetColumnOption {
  id        String            @id @default(cuid())
  columnId  String
  column    MastersheetColumn @relation(fields: [columnId], references: [id], onDelete: Cascade)
  label     String
  sortOrder Int

  cellSelections MastersheetCellSelectedOption[]
}

// ─── 自由追加カラムのセル値 ───

model MastersheetCellValue {
  id          String            @id @default(cuid())
  columnId    String
  column      MastersheetColumn @relation(fields: [columnId], references: [id], onDelete: Cascade)
  projectId   String
  project     Project           @relation(fields: [projectId], references: [id])
  textValue   String?
  numberValue Float?
  selectedOptions MastersheetCellSelectedOption[]
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt
  @@unique([columnId, projectId])
}

// ─── SELECT/MULTI_SELECT のセル値（中間テーブル）───

model MastersheetCellSelectedOption {
  id       String                  @id @default(cuid())
  cellId   String
  cell     MastersheetCellValue    @relation(fields: [cellId], references: [id], onDelete: Cascade)
  optionId String
  option   MastersheetColumnOption @relation(fields: [optionId], references: [id], onDelete: Cascade)
  @@unique([cellId, optionId])
}

// ─── フォーム回答のオーバーライド ───

model MastersheetOverride {
  id          String            @id @default(cuid())
  columnId    String
  column      MastersheetColumn @relation(fields: [columnId], references: [id], onDelete: Cascade)
  projectId   String
  project     Project           @relation(fields: [projectId], references: [id])
  textValue   String?
  numberValue Float?
  fileUrl     String?
  isStale     Boolean           @default(false)
  selectedOptions MastersheetOverrideSelectedOption[]
  editorId    String
  editor      User              @relation(fields: [editorId], references: [id])
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt
  @@unique([columnId, projectId])
}

// ─── SELECT/CHECKBOX オーバーライドの選択肢（中間テーブル）───
// optionId は FormItemOption.id を参照

model MastersheetOverrideSelectedOption {
  id         String              @id @default(cuid())
  overrideId String
  override   MastersheetOverride @relation(fields: [overrideId], references: [id], onDelete: Cascade)
  optionId   String
  @@unique([overrideId, optionId])
}

// ─── カラムの公開範囲（自由追加カラム用）───

model MastersheetColumnViewer {
  id          String            @id @default(cuid())
  columnId    String
  column      MastersheetColumn @relation(fields: [columnId], references: [id], onDelete: Cascade)
  scope       ViewerScope
  bureauValue Bureau?
  userId      String?
  user        User?             @relation(fields: [userId], references: [id])
}

// ─── 閲覧申請 ───

model MastersheetAccessRequest {
  id          String            @id @default(cuid())
  columnId    String
  column      MastersheetColumn @relation(fields: [columnId], references: [id], onDelete: Cascade)
  requesterId String
  requester   User              @relation("MastersheetAccessRequester", fields: [requesterId], references: [id])
  decidedById String?
  decidedBy   User?             @relation("MastersheetAccessDecider", fields: [decidedById], references: [id])
  status      ApprovalStatus
  decidedAt   DateTime?
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt
}

// ─── 編集履歴 ───

model MastersheetEditHistory {
  id        String            @id @default(cuid())
  columnId  String
  column    MastersheetColumn @relation(fields: [columnId], references: [id], onDelete: Cascade)
  projectId String
  project   Project           @relation(fields: [projectId], references: [id])
  oldValue  String?           // JSON シリアライズ
  newValue  String?           // JSON シリアライズ
  editorId  String
  editor    User              @relation(fields: [editorId], references: [id])
  createdAt DateTime          @default(now())
}

// ─── 保存済みビュー ───

model MastersheetView {
  id          String   @id @default(cuid())
  name        String
  createdById String
  createdBy   User     @relation(fields: [createdById], references: [id])
  state       String   // JSON: { columns: string[], filters: {...}, sorting: {...} }
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### フォーム回答提出時の isStale 更新

`apps/api/src/routes/project-form.ts` の POST・PATCH エンドポイントで `submittedAt` をセットするタイミングに以下を追加:

```typescript
// MastersheetOverride.isStale = true にする
await tx.mastersheetOverride.updateMany({
  where: {
    projectId,
    column: { formItem: { formId: delivery.formAuthorization.formId } },
    isStale: false,
  },
  data: { isStale: true },
});
```

### 完了確認

```bash
bun run db:migrate
bun run typecheck
```

---

## Phase 2: shared パッケージ

`packages/shared/src/schemas/mastersheet.ts` を新規作成し、`packages/shared/src/index.ts` に追加する。

### スキーマ構成

```typescript
// Enum スキーマ
export const mastersheetColumnTypeSchema = z.enum(["FORM_ITEM", "CUSTOM"]);
export const mastersheetDataTypeSchema = z.enum(["TEXT", "NUMBER", "SELECT", "MULTI_SELECT"]);
export const mastersheetColumnVisibilitySchema = z.enum(["PRIVATE", "PUBLIC"]);

// セルの状態（フォーム由来カラム用）
export const mastersheetCellStatusSchema = z.enum([
  "NOT_DELIVERED",   // 未配信
  "NOT_ANSWERED",    // 未回答
  "DRAFT",           // 下書き
  "SUBMITTED",       // 提出済み
  "OVERRIDDEN",      // オーバーライド済み
  "STALE_OVERRIDE",  // 要確認（元データ更新あり）
]);

// Model スキーマ・Request/Response スキーマ・Endpoint 定義
// → 既存の committee-form.ts のパターンに従う
```

`packages/shared/src/endpoints/committee-mastersheet.ts` を新規作成し、全エンドポイントの型を定義する。

---

## Phase 3: API エンドポイント実装

`apps/api/src/routes/committee-mastersheet.ts` を新規作成。
`apps/api/src/index.ts` に登録:

```typescript
app.route("/committee/mastersheet", committeeMastersheetRoute);
```

### エンドポイント一覧

| Method | パス | 実装メモ |
|--------|------|---------|
| GET | `/data` | 全企画 × 権限フィルタ後の全カラムを1リクエストで返す。初期カラム（Project 基本情報）も含む |
| POST | `/columns` | `type=FORM_ITEM`/`CUSTOM` で分岐。FORM_ITEM はフォームへのアクセス権チェック必須 |
| PATCH | `/columns/:columnId` | name/description/sortOrder/visibility を更新。作成者のみ |
| DELETE | `/columns/:columnId` | 作成者のみ。関連データはカスケード削除 |
| PUT | `/cells/:columnId/:projectId` | 自由追加カラムのみ。SELECT/MULTI_SELECT は `MastersheetCellSelectedOption` を upsert |
| PUT | `/overrides/:columnId/:projectId` | フォーム由来カラムのみ。`isStale=false` にリセット + 編集履歴を記録 |
| DELETE | `/overrides/:columnId/:projectId` | オーバーライド削除（元データに戻す）。履歴記録 |
| GET | `/columns/:columnId/history/:projectId` | `MastersheetEditHistory` を降順で返す |
| GET | `/columns/discover` | PUBLIC カラム全件 + 自分の PRIVATE カラム。権限外は name/createdBy のみ返す |
| POST | `/columns/:columnId/access-request` | PENDING 重複チェック（既存あれば 409）。フォーム由来カラムは即時 `FormCollaborator`（`isWrite=false`）作成、自由追加は `MastersheetAccessRequest` 作成 |
| PATCH | `/access-requests/:requestId` | カラム管理者のみ。APPROVED 時は `MastersheetColumnViewer` 作成で権限付与 |
| GET | `/views` | 自分が作成したビュー一覧 |
| POST | `/views` | ビュー保存 |
| DELETE | `/views/:viewId` | 自分のビューのみ削除可 |

### 権限チェックの方針

```typescript
// カラム閲覧権チェック
// FORM_ITEM: フォームの owner または collaborator
// CUSTOM PRIVATE: createdById === userId のみ
// CUSTOM PUBLIC: MastersheetColumnViewer の scope で判定

// カラム管理権チェック（PATCH/DELETE）
// createdById === userId のみ許可
```

### 実装パターン参照

- 認証・権限チェック: `apps/api/src/routes/committee-form.ts` の `requireWriteAccess`/`requireOwner` パターン
- トランザクション: `{ isolationLevel: "Serializable" }` を使用（既存パターン踏襲）
- エラー: `Errors.notFound()` / `Errors.forbidden()` / `Errors.invalidRequest()`

---

## Phase 4: DataTable コンポーネント拡張

### 4-1. DataTableFeatures 拡張

`apps/web/src/components/patterns/DataTable/DataTable.tsx`:

```typescript
type DataTableFeatures = {
  // 既存（変更なし）
  sorting?: boolean;
  globalFilter?: boolean;
  columnVisibility?: boolean;
  selection?: boolean;     // セル選択（既存）
  copy?: boolean;
  csvExport?: boolean;
  // 新規追加
  columnFilter?: boolean;  // カラムフィルター（マスターシート用）
  rowSelection?: boolean;  // 行チェックボックス選択（配信先指定用）
};
// rowSelection=true の場合は selection（セル選択）を無効化
```

### 4-2. カラムフィルター

TanStack Table の `columnFilters` ステートと `getFilteredRowModel()` を追加。カラムヘッダーにフィルターアイコン（▼）を配置し、クリックでポップオーバー表示。

| 型 | フィルター UI |
|----|-------------|
| テキスト | 部分一致テキストボックス |
| 数値 | 最小値・最大値インプット |
| 単一選択・複数選択 | チェックボックスリスト |
| フォーム由来カラム | 上記 + セル状態フィルター（6状態） |

デフォルトは全状態チェック済み（= フィルターなし）。状態間は OR、値フィルターとは AND。

### 4-3. 新規セルコンポーネント

`apps/web/src/components/patterns/DataTable/cells/` に追加:

| コンポーネント | 用途 |
|--------------|------|
| `MultiSelectCell.tsx` | 複数選択肢をバッジで表示・編集 |
| `FileCell.tsx` | ファイル URL をリンク表示 |
| `FormCellStatusBadge.tsx` | 未配信・未回答・下書き・要確認バッジ |

### 4-4. URL クエリパラメータ連動

TanStack Router の `search` 機能でテーブル状態（フィルター・ソート・表示カラム）を URL に保持。ビュー保存時はこの状態を DB に永続化。

---

## Phase 5: マスターシートページ実装

### ルート構成（現状）

```
apps/web/src/routes/committee/mastersheet/
├── index.tsx                          # マスターシート本体ページ ✅
└── -components/
    ├── MastersheetTable.tsx           # DataTable ラッパー（動的カラム生成）✅
    ├── FormItemCell.tsx               # FORM_ITEM セル（表示 + 編集）✅（「元に戻す」ボタンは未対応）
    ├── ViewTabs.tsx                   # ビュー切替タブ（メモリ上のみ）✅
    ├── ColumnPanel.tsx                # カラム管理パネル ✅（承認 UI は未対応）
    ├── AddFormItemColumnsDialog.tsx   # フォーム由来カラム追加 ✅
    ├── AddCustomColumnDialog.tsx      # カスタムカラム追加 ✅
    ├── ColumnDiscoverDialog.tsx       # カラム発見・閲覧申請 ✅
    └── CellHistoryPanel.tsx          # 編集履歴パネル（未実装）
```

---

### Phase 5-A: コアテーブル表示 + CUSTOM セル編集 ✅ **実装済み**

**対応内容:**
- `GET /committee/mastersheet/data` を loader で取得・表示
- 固定6列（企画番号・企画名・種別・団体名・担当者・副担当者）
- 動的カラム: `FORM_ITEM` → `FormItemCell`（表示のみ）、`CUSTOM TEXT/NUMBER` → `EditableCell`、`CUSTOM SELECT` → `SelectCell`、`CUSTOM MULTI_SELECT` → `MultiSelectEditCell`
- `onCellEdit` 時に `PUT /cells/...` or `PUT /overrides/...` を呼び分け + `router.invalidate()`
- `SelectCell` に `meta.selectOptions` サポートを追加
- `ColumnMeta` に `formItemType` フィールドを追加
- `MultiSelectEditCell` 新規作成（Popover + Checkbox リスト、Escape でキャンセル）

---

### Phase 5-B: FORM_ITEM「元に戻す」ボタン（未実装）

**現状:** TEXT/TEXTAREA/NUMBER のダブルクリック編集は実装済み。FILE/SELECT/CHECKBOX は表示のみ（仕様通り）。

**目的**: オーバーライド済みセルから元の回答値に戻せるようにする。

**対象ファイル:**
- `FormItemCell.tsx` — OVERRIDDEN / STALE_OVERRIDE 状態のセルにボタンを追加

**実装方針:**
- `FormItemCell` の `FormEditableCell` の隣（または下）に、`cell.status === "OVERRIDDEN" || cell.status === "STALE_OVERRIDE"` のときのみ「元に戻す」アイコンボタン（`IconRotateClockwise` 等）をホバーで表示
- クリックで `deleteMastersheetOverride(columnId, projectId)` を呼び、`table.options.meta?.updateData(...)` で即時 UI 更新（または `router.invalidate()`）

**API（実装済み）:**
- `DELETE /committee/mastersheet/overrides/:columnId/:projectId`

**新規追加が必要な API クライアント関数:**
- `deleteMastersheetOverride(columnId, projectId)` → `apps/web/src/lib/api/committee-mastersheet.ts`

---

### Phase 5-C: ColumnPanel 拡張（閲覧申請の承認 UI）（未実装）

**現状:** ColumnPanel にはカラム追加・編集・削除・カラム発見ダイアログは実装済み。ただし、**自分のカラムへの閲覧申請を承認/却下する UI がない**。

**目的**: 自分が作成したカスタムカラムに届いた閲覧申請を確認・承認/却下できるようにする。

**対象ファイル:**
- `ColumnPanel.tsx` — 自分のカラムリストに申請バッジと承認 UI を追加

**実装方針:**

`GET /committee/mastersheet/columns/discover` のレスポンスには申請情報が含まれていないため、カラムパネル用のデータ取得方法を検討する。

方針 A（推奨）: `ColumnPanel` 初期化時に `GET /columns/discover` に自分のカラムのフィルタをかけて申請一覧を取得
→ ただし現 API は申請情報を discover に含めていないため、API 側の変更が必要。

方針 B: 既存の `GET /committee/mastersheet/data` レスポンスの `columns` に `pendingAccessRequests` フィールドを追加する。

**推奨は方針 B**（追加 API 呼び出し不要、データの鮮度を保てる）:

1. `GET /data` のレスポンス型 `GetMastersheetDataResponse` の `columns` に以下を追加:
   ```typescript
   pendingAccessRequests?: Array<{
     id: string;
     requester: { id: string; name: string };
     createdAt: string;
   }>;
   ```
   自分が作成したカラムのみ含める（他人のカラムは `[]`）。

2. `ColumnPanel.tsx` の自分のカラムカード内に「N件の申請」バッジを追加:
   ```
   [カラム名]  [申請 2件▼]  [編集] [削除]
   ```
   クリックで申請一覧を展開し、各申請に [承認] [却下] ボタン。

3. 承認/却下後 `router.invalidate()` で再取得。

**API（実装済み）:**
- `PATCH /committee/mastersheet/access-requests/:requestId`

**新規追加が必要な API クライアント関数:**
- `updateMastersheetAccessRequest(requestId, status)` → `apps/web/src/lib/api/committee-mastersheet.ts`

**shared スキーマ変更（方針 B の場合）:**
- `GetMastersheetDataResponse` の `columns` に `pendingAccessRequests` フィールドを追加
- API 側 `GET /data` でカラム作成者のみ申請データを付加

---

### Phase 5-D: ColumnDiscoverDialog（カラム発見・閲覧申請）✅ **実装済み**

**対応内容:**
- `GET /columns/discover` で全公開カラム一覧を取得・表示
- `hasAccess=true`: 「表示中」バッジ
- `pendingRequest=true`: 「申請中」バッジ
- それ以外: [閲覧申請] ボタン → `POST /columns/:columnId/access-request`
- 申請後はローカル state を更新し「申請中」バッジに切り替え

---

### Phase 5-E: CellHistoryPanel（編集履歴）（未実装）

**目的**: セルの編集履歴（誰がいつ何を変えたか）を確認できる UI。

**対象ファイル:**
- `CellHistoryPanel.tsx` — 新規作成（Popover）
- `FormItemCell.tsx` — 履歴アイコン（`IconHistory`）を追加

**UI 構成:**
```
FormItemCell のホバー時に履歴アイコンを表示
アイコンクリック → Popover
  ヘッダー: 「編集履歴」
  リスト（降順）:
    ┌─────────────────────────────┐
    │ 田中太郎  2026/02/25 14:30  │
    │ 「未定」→「確定済み」         │
    ├─────────────────────────────┤
    │ 佐藤花子  2026/02/20 10:00  │
    │ （初回入力）「未定」          │
    └─────────────────────────────┘
  履歴なし: 「編集履歴はありません」
```

**実装方針:**
- `useState` で open/loading/data を管理（loader には含めない）
- Popover open 時に `getMastersheetHistory(columnId, projectId)` を fetch
- `oldValue` / `newValue` は JSON 文字列（サーバー側でシリアライズ済み）→ `JSON.parse` して表示
- CUSTOM カラムの `EditableCell` にも同じアイコンを追加することを検討（後回し可）

**API（実装済み）:**
- `GET /committee/mastersheet/columns/:columnId/history/:projectId`

**新規追加が必要な API クライアント関数:**
- `getMastersheetCellHistory(columnId, projectId)` → `apps/web/src/lib/api/committee-mastersheet.ts`

---

### Phase 5-F: ビュー保存 ✅ **実装済み**

**対応内容:**
- DB からビュー一覧取得・初期適用（ビューがなければ「ビュー1」を自動作成）
- タブ切り替えでテーブル状態を復元
- アクティブビューへの 1 秒デバウンス自動保存
- タブ追加・リネーム・削除
- ダーティマーク（未保存変更を `*` で表示）

---

## Phase 6: 配信設定モーダル統合（未実装）

お知らせ・フォームの配信先選択 UI をマスターシートで実現する。

### 変更対象

- `apps/web/src/routes/committee/notices/$noticeId/` — 配信申請フローの企画選択部分
- `apps/web/src/routes/committee/forms/$formId/` — 同上

### 前提条件

DataTable に `rowSelection` 機能を追加する必要がある（現在未実装）。

**DataTable 変更内容:**
- `features.rowSelection?: boolean` を追加
- `rowSelection=true` 時は `selection`（セル選択）を無効化し、代わりに行頭チェックボックスを追加
- `onSelectionChange?: (selectedIds: string[]) => void` prop を追加

### 実装方針

既存の企画選択 UI を `rowSelection: true` のマスターシート UI に置き換える。

```typescript
<MastersheetTable
  features={{ rowSelection: true, columnFilter: true, sorting: true }}
  onSelectionChange={(selectedProjectIds) => setDeliveryTargets(selectedProjectIds)}
/>
```

**実装ステップ:**
1. `DataTable` に `rowSelection` feature を追加（TanStack Table の `useRowSelection` を利用）
2. `MastersheetTable` に `onSelectionChange` prop を追加
3. 配信申請フローの企画選択部分を `MastersheetTable` に置き換え

---

## 重要な参照ファイル

| ファイル | 参照目的 |
|---------|---------|
| `apps/api/prisma/schema.prisma` | スキーマ追加対象 |
| `apps/api/src/routes/committee-form.ts` | API 実装パターン |
| `apps/api/src/routes/project-form.ts` | isStale 更新追加箇所 |
| `apps/api/src/index.ts` | ルート登録 |
| `packages/shared/src/schemas/inquiry.ts` | ViewerScope リネーム対象 |
| `packages/shared/src/schemas/form.ts` | ApprovalStatus リネーム対象 |
| `apps/web/src/components/patterns/DataTable/DataTable.tsx` | DataTable 拡張ベース |
| `apps/web/src/routes/committee/forms/$formId/answers/index.tsx` | 動的カラム生成パターン |

---

## 検証

```bash
bun run typecheck   # 型エラーなし
bun run test:run    # 既存テスト通過
bun run lint        # Biome エラーなし
bun run db:studio   # Prisma Studio でスキーマ確認
```

手動確認:
- カラム追加（フォーム由来・自由追加）・編集・削除
- セル編集・オーバーライド・isStale フロー（企画側再提出）
- カラムフィルター・状態フィルター・ビュー保存・URL 再現
- 配信設定モーダルでの行選択 → 配信申請
