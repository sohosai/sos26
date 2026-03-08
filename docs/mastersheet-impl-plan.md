# マスターシート機能 残タスク

> **仕様書**: [docs/mastersheet-spec.md](./mastersheet-spec.md)
> **テスト計画**: [docs/mastersheet-test-plan.md](./mastersheet-test-plan.md)
> **ブランチ**: `feat/mastersheet`

---

## 実装状況

| Phase | 内容 | 状態 |
|-------|------|------|
| Phase 0 | Enum リネーム (ViewerScope, ApprovalStatus) | ✅ |
| Phase 1 | DB スキーマ (カラム・セル・ビュー・FormItemEditHistory) | ✅ |
| Phase 2 | shared パッケージ (型定義・エンドポイント) | ✅ |
| Phase 3 | API エンドポイント | ✅ |
| Phase 4 | DataTable 拡張 (columnFilter, rowSelection, MultiSelectCell 等) | ✅ |
| Phase 5-A | コアテーブル表示 + CUSTOM セル編集 | ✅ |
| Phase 5-B | FORM_ITEM SELECT/CHECKBOX 型の編集 | ✅ |
| Phase 5-C | アクセス申請の承認 UI | ⬜ |
| Phase 5-D | ColumnDiscoverDialog（カラム発見・アクセス申請） | ✅ |
| Phase 5-E | CellHistoryPanel（編集履歴パネル） | ⬜ |
| Phase 5-F | ビュー保存 | ✅ |
| Phase 6 | 配信設定モーダル統合 | ⬜ |

---

## 残タスク

### 1. アクセス申請の承認 UI（Phase 5-C）

**目的**: 自分が作成したカラム / 自分がオーナーのフォームに届いたアクセス申請を確認・承認/却下できるようにする。

**対象ファイル**:
- `apps/web/src/routes/committee/mastersheet/-components/ColumnPanel.tsx`

**実装方針**:

`GET /committee/mastersheet/data` のレスポンスの `columns` に `pendingAccessRequests` フィールドを追加する:

```typescript
pendingAccessRequests?: Array<{
  id: string;
  requester: { id: string; name: string };
  createdAt: string;
}>;
```

自分が作成したカラムのみ含める（他人のカラムは `[]`）。

ColumnPanel 内の自分のカラムカードに「N件の申請」バッジを表示し、クリックで展開。各申請に [承認] [却下] ボタン。

**API（実装済み）**:
- `GET /committee/mastersheet/access-requests` — 自分が承認権限を持つ PENDING 申請一覧
- `PATCH /committee/mastersheet/access-requests/:requestId` — 承認/却下

---

### 2. CellHistoryPanel（編集履歴パネル）（Phase 5-E）

**目的**: セルの編集履歴（誰がいつ何を変えたか）を確認できる UI。

**対象ファイル**:
- `CellHistoryPanel.tsx` — 新規作成（Popover）
- `FormItemCell.tsx` — 履歴アイコン（`IconHistory`）を追加

**UI 構成**:
```
FormItemCell のホバー時に履歴アイコンを表示
アイコンクリック → Popover
  ヘッダー: 「編集履歴」
  リスト（降順）:
    ┌─────────────────────────────────────────┐
    │ 田中太郎  2026/02/25 14:30  [提出]       │
    │ 値: 「確定済み」                          │
    ├─────────────────────────────────────────┤
    │ 佐藤花子  2026/02/20 10:00  [実委編集]    │
    │ 値: 「未定」                              │
    └─────────────────────────────────────────┘
  履歴なし: 「編集履歴はありません」
```

**実装方針**:
- `useState` で open/loading/data を管理（loader には含めない）
- Popover open 時に `GET /committee/mastersheet/columns/:columnId/history/:projectId` を fetch
- レスポンスの `trigger` に応じたラベルを表示（PROJECT_SUBMIT → 「提出」、PROJECT_RESUBMIT → 「再提出」、COMMITTEE_EDIT → 「実委編集」）

**API（実装済み）**:
- `GET /committee/mastersheet/columns/:columnId/history/:projectId`

---

### 3. 配信設定モーダル統合（Phase 6）

**目的**: お知らせ・フォームの配信先選択 UI をマスターシートで実現する。

**変更対象**:
- `apps/web/src/routes/committee/notices/$noticeId/` — 配信申請フローの企画選択部分
- `apps/web/src/routes/committee/forms/$formId/` — 同上

**実装方針**:

既存の企画選択 UI を `rowSelection: true` のマスターシート UI に置き換える。

```typescript
<MastersheetTable
  features={{ rowSelection: true, columnFilter: true, sorting: true }}
  onSelectionChange={(selectedProjectIds) => setDeliveryTargets(selectedProjectIds)}
/>
```

DataTable の `rowSelection` 機能は Phase 4 で実装済み。
