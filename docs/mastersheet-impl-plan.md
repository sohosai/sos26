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
    ├── MastersheetTable.tsx      # DataTable ラッパー（動的カラム生成）
    ├── ColumnManagerDialog.tsx   # カラム追加・設定 UI
    ├── ColumnDiscoverDialog.tsx  # カラム一覧・発見・閲覧申請
    ├── CellHistoryPanel.tsx      # 編集履歴パネル
    └── ViewSwitcher.tsx          # ビュー切替 UI
```

### データ取得

TanStack Router の `loader` で `GET /committee/mastersheet/data` を1リクエストで全取得。

### カラム定義の動的生成

```typescript
// 初期カラム（固定）
const baseColumns: ColumnDef[] = [
  { id: "number", header: "企画番号" },
  { id: "name", header: "企画名" },
  { id: "type", header: "企画種別" },
  { id: "organizationName", header: "団体名" },
  { id: "owner", header: "企画責任者" },
  { id: "subOwner", header: "副企画責任者" },
];

// 動的カラム（API から権限フィルタ済みで返ってくる）
const dynamicColumns: ColumnDef[] = columns.map(col => ({
  id: col.id,
  header: col.name,
  cell: resolveCell(col),  // 型・状態に応じたセルコンポーネントを返す
  meta: { editable: canEdit(col), type: col.dataType, ... },
}));
```

### セル編集フロー

1. セルをダブルクリック → EditableCell/SelectCell が編集モードに
2. 確定 → `onCellEdit` コールバック → PUT `/cells/...` or `/overrides/...`
3. 成功 → ローカルデータを更新（楽観的更新）

### セル状態の表示

フォーム由来カラムのセルは状態に応じた表示:

| 状態 | 表示 |
|------|------|
| 未配信 | 灰色背景 |
| 未回答 | 「未回答」ラベル |
| 下書き | 薄字 + 「下書き」バッジ |
| 提出済み | 通常表示 |
| オーバーライド済み | オーバーライド値 + 上書きアイコン |
| 要確認 | オーバーライド値 + 警告アイコン |

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
