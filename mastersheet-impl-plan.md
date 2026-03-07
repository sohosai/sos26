# マスターシート 実装計画

## 完了

- [x] Phase 3 — API 実装（Hono ルート）
- [x] Phase 4 — DataTable 拡張（SelectCell / MultiSelectCell / rowSelection など）
- [x] Phase 5-A — コアテーブル表示 + CUSTOM セル編集
- [x] Phase 5-B — FORM_ITEM セルインライン編集（FormItemCell）
- [x] Phase 5-C — ColumnManagerDialog（カラム追加 / 編集 / 削除）
- [x] Phase 5-D — ColumnDiscoverDialog（カラムを探す・閲覧申請）
- [x] Phase 5-F — ViewSwitcher + URL ソート / 表示状態同期

## 未着手

- [ ] **Phase 5-E — 編集履歴パネル**
  セルをクリックしたとき `GET /committee/mastersheet/columns/:columnId/history/:projectId` から
  編集履歴を取得して表示する。

- [ ] **FORM_ITEM セルのステータス表示**
  OVERRIDDEN / STALE_OVERRIDE などのステータスを視覚的に伝える UI を検討・実装する。
  バッジ・ドットインジケーターを試したがどちらもしっくりこなかった。別の表現方法を考える。
