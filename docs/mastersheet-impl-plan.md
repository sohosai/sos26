# マスターシート機能 実装計画

> **参照**: [docs/mastersheet-plan.md](./mastersheet-plan.md) — 機能仕様
> **作成日**: 2026-03-03
> **ブランチ**: `feat/mastersheet`

---

## フェーズ概要

```
Phase 0: Enum リネーム
Phase 1: DB スキーマ追加 + マイグレーション
Phase 2: shared パッケージ 型定義・スキーマ追加
Phase 3: API エンドポイント実装
Phase 4: DataTable コンポーネント拡張
Phase 5: マスターシートページ実装
Phase 6: 配信設定モーダル統合（§8）
```

Phase 4 は Phase 3 と並行可能。それ以外は概ね順番に実施する。

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

### ルート構成

```
apps/web/src/routes/committee/mastersheet/
├── index.tsx                     # マスターシート本体ページ
└── -components/
    ├── MastersheetTable.tsx      # DataTable ラッパー（動的カラム生成）✅
    ├── FormItemCell.tsx          # FORM_ITEM セル表示コンポーネント ✅
    ├── ColumnManagerDialog.tsx   # カラム追加・設定 UI
    ├── ColumnDiscoverDialog.tsx  # カラム一覧・発見・閲覧申請
    ├── CellHistoryPanel.tsx      # 編集履歴パネル
    └── ViewSwitcher.tsx          # ビュー切替 UI
```

---

### Phase 5-A: コアテーブル表示 + CUSTOM セル編集 ✅ **実装済み**

**対応内容:**
- `GET /committee/mastersheet/data` を loader で取得・表示
- 固定6列（企画番号・企画名・種別・団体名・担当者・副担当者）
- 動的カラム: `FORM_ITEM` → `FormItemCell`（表示のみ）、`CUSTOM TEXT/NUMBER` → `EditableCell`、`CUSTOM SELECT` → `SelectCell`、`CUSTOM MULTI_SELECT` → `MultiSelectCell`（表示のみ）
- `onCellEdit` 時に `PUT /cells/...` or `PUT /overrides/...` を呼び分け + `router.invalidate()`
- `SelectCell` に `meta.selectOptions` サポートを追加
- `ColumnMeta` に `formItemType` フィールドを追加

**未対応（以降の Sub-Phase で対応）:**
- FORM_ITEM セルの編集（override）
- MULTI_SELECT の編集
- カラム管理・発見 UI
- 編集履歴
- ビュー保存・URL 連動

---

### Phase 5-B: FORM_ITEM セル インライン編集

**目的**: FORM_ITEM カラムを上書き（override）できるようにする。

**対象ファイル:**
- `FormItemCell.tsx` — EditableCell 相当のダブルクリック編集を組み込む

**実装方針:**
- `formItemType` が `TEXT` / `TEXTAREA` / `NUMBER` の場合のみ編集可能にする
- ダブルクリックで `<input>` を表示し、Enter/blur でコミット
- コミット時 `table.options.meta?.updateData(row, columnId, value)` を呼ぶ（既存の `onCellEdit` ルーティングが `upsertMastersheetOverride` を呼ぶ）
- `FILE` / `SELECT` / `CHECKBOX` 型は引き続き表示のみ（別途対応検討）
- オーバーライド済みの場合は「元に戻す（DELETE /overrides/...）」ボタンを追加検討

**考慮点:**
- 編集中は status badge を非表示にする
- `STALE_OVERRIDE` のとき編集を確定すると `isStale` がリセットされる（サーバー側で処理）

---

### Phase 5-C: ColumnManagerDialog（カラム管理）

**目的**: 自分が作成したカラムの追加・編集・削除ができる UI。

**対象ファイル:**
- `ColumnManagerDialog.tsx` — 新規作成
- `index.tsx` — ツールバーに「カラムを管理」ボタンを追加

**UI 構成:**
```
[カラムを管理] ボタン → ダイアログ
  タブ: [自分のカラム一覧] [新規追加]

  自分のカラム一覧タブ:
    - カラム名・種別・公開設定を一覧表示
    - 各行に [編集] [削除] アクション
    - 編集: インラインフォームで name/description/sortOrder/visibility を変更
    - 削除: 確認ダイアログ → DELETE /columns/:columnId

  新規追加タブ:
    - 種別選択: FORM_ITEM / CUSTOM
    - FORM_ITEM: フォーム・項目のセレクタ
    - CUSTOM: dataType・visibility・選択肢（SELECT/MULTI_SELECT の場合）
    → POST /columns
```

**API:**
- `POST /committee/mastersheet/columns` → `createMastersheetColumn()`
- `PATCH /committee/mastersheet/columns/:columnId` → `updateMastersheetColumn()`
- `DELETE /committee/mastersheet/columns/:columnId` → `deleteMastersheetColumn()`

**完了後**: `router.invalidate()` でテーブルを再取得。

---

### Phase 5-D: ColumnDiscoverDialog（カラム発見・閲覧申請）

**目的**: 他ユーザーが作成した PUBLIC カラムを一覧表示し、閲覧申請を送れる UI。

**対象ファイル:**
- `ColumnDiscoverDialog.tsx` — 新規作成
- `index.tsx` — ツールバーに「カラムを追加」ボタンを追加

**UI 構成:**
```
[カラムを追加] ボタン → ダイアログ
  - GET /columns/discover で全公開カラム一覧を取得
  - カラム名・作成者・種別を一覧表示
  - hasAccess=true: 「表示中」バッジ
  - pendingRequest=true: 「申請中」バッジ
  - それ以外: [閲覧申請] ボタン → POST /columns/:columnId/access-request
```

**API:**
- `GET /committee/mastersheet/columns/discover` → `discoverMastersheetColumns()`
- `POST /committee/mastersheet/columns/:columnId/access-request` → `createMastersheetAccessRequest()`

**閲覧申請の承認 UI** は別途（通知経由 or 専用ページ）で対応。

---

### Phase 5-E: CellHistoryPanel（編集履歴）

**目的**: セルを右クリック（またはアイコンクリック）で編集履歴を表示する。

**対象ファイル:**
- `CellHistoryPanel.tsx` — 新規作成（Popover またはサイドパネル）
- `FormItemCell.tsx` — 履歴アイコンを追加

**UI 構成:**
```
セル右クリック or アイコンクリック → パネル表示
  - GET /columns/:columnId/history/:projectId
  - 編集日時・編集者・変更前後の値を降順リスト表示
```

**API:**
- `GET /committee/mastersheet/columns/:columnId/history/:projectId` → `getMastersheetHistory()`

**実装上の注意:**
- 履歴取得は非同期（クリック時に fetch）なので TanStack Query または `useState` + `useEffect` で管理
- loader には含めない（パフォーマンス上の理由）

---

### Phase 5-F: ViewSwitcher（ビュー保存・URL 連動）

**目的**: フィルター・ソート・表示カラムの状態を保存・復元できる UI。

**対象ファイル:**
- `ViewSwitcher.tsx` — 新規作成
- `index.tsx` — URL search params でテーブル状態を管理
- `MastersheetTable.tsx` — `initialSorting` / `initialColumnVisibility` を props で受け取る

**Phase 5-F-1: URL 連動**
- TanStack Router の `validateSearch` で `{ sorting, filters, columns }` を URL クエリに保持
- ページリロード・URL 共有でも同じ表示状態を再現

**Phase 5-F-2: ビュー保存**
```
[ビュー保存] ボタン → 名前入力 → POST /views
[ビュー切替] ドロップダウン → GET /views で一覧 → 選択で状態を適用
[ビュー削除] → DELETE /views/:viewId
```

**API:**
- `GET /committee/mastersheet/views` → `listMastersheetViews()`
- `POST /committee/mastersheet/views` → `createMastersheetView()`
- `DELETE /committee/mastersheet/views/:viewId` → `deleteMastersheetView()`

**state のシリアライズ形式（DB 保存用）:**
```json
{
  "columnVisibility": { "colId1": false },
  "sorting": [{ "id": "colId2", "desc": true }],
  "columnFilters": [{ "id": "colId3", "value": "..." }]
}
```

---

## Phase 6: 配信設定モーダル統合

お知らせ・フォームの配信先選択 UI をマスターシートで実現する。

### 変更対象

- `apps/web/src/routes/committee/notices/$noticeId/` — 配信申請フローの企画選択部分
- `apps/web/src/routes/committee/forms/$formId/` — 同上

### 実装方針

既存の企画選択 UI を `rowSelection: true` のマスターシート UI に置き換える。

```typescript
<MastersheetTable
  features={{ rowSelection: true, columnFilter: true, sorting: true }}
  onSelectionChange={(selectedProjectIds) => setDeliveryTargets(selectedProjectIds)}
/>
```

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
