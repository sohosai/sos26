# ファイルプレビュー機能（Web）

このドキュメントは、`apps/web` のファイルプレビュー機能の実装・対応形式・既知の制約を整理したものです。

## 対象コンポーネント

- `FileUploadFieldWithPreview`
  - ファイル入力とプレビュー導線（アイコンボタン）を提供するラッパー
- `FilePreviewDialog`
  - プレビュー表示用のダイアログ
- ビューア実装
  - `PdfViewer`（PDF）
  - `ExcelViewer`（Excel）
  - `WordViewer`（Word）

関連ファイル:

- `apps/web/src/components/form/EachField/FileUploadFieldWithPreview.tsx`
- `apps/web/src/components/filePreview/FilePreviewDialog.tsx`
- `apps/web/src/components/filePreview/Pdfviewer.tsx`
- `apps/web/src/components/filePreview/ExcelViewer.tsx`
- `apps/web/src/components/filePreview/Wordviewer.tsx`

## 画面上の基本フロー

1. `FileUploadField` でファイルを選択する
2. `FileUploadFieldWithPreview` のプレビューボタン（アイコン）を押す
3. `FilePreviewDialog` が開く
4. 拡張子に応じて適切なビューアが表示される

## 拡張子ごとの分岐

`FilePreviewDialog` はファイル拡張子で表示を分岐しています。

- `pdf` → `PdfViewer`
- `xls`, `xlsx` → `ExcelViewer`
- `docx` → `WordViewer`
- `png`, `jpg`, `jpeg`, `gif`, `webp`, `svg` → `<img>` で表示
- 上記以外 → 「非対応の形式です」

## 各ビューアの仕様

## PDF (`PdfViewer`)

- ライブラリ: `react-pdf`
- `pdfjs.GlobalWorkerOptions.workerSrc` を `vite` 環境向けに指定
- ページ送り UI（前/次）あり
- 読み込み中・エラー文言を表示

### 補足

- 現在は 1 ページずつ表示する構成です。
- ズーム、サムネイル、全ページ連続表示は未実装です。

## Excel (`ExcelViewer`)

- ライブラリ: `exceljs`
- ファイルを読み込み、シート単位で表示
- セルの主要スタイルを再現
  - フォント（太字、斜体、下線、サイズ、文字色）
  - 背景色
  - 罫線
  - 水平/垂直位置
  - 折り返し
- 結合セルを `rowSpan` / `colSpan` で再現
- 画像、描画オブジェクトをオーバーレイで表示

### 補足

- シートが複数ある場合はタブで切り替えます。
- 大きなファイルでは表示に時間がかかる場合があります。

## Word (`WordViewer`)

- ライブラリ: `docx-preview`
- `file.arrayBuffer()` を `renderAsync` に渡して HTML 描画
- 読み込み中・失敗時の文言を表示

### 補足

- 現在は `docx` のみ対応です（`doc` は非対応）。

## 既知の制約・注意点

- プレビューはブラウザ上での簡易表示であり、ネイティブアプリと完全一致は保証しません。
- 巨大ファイル・複雑なレイアウト（特に Excel/Word）は描画負荷が高くなる場合があります。

## 開発用ルート

- `/dev/filePreview`
  - ファイルアップロードとプレビューの手動確認用
