# フォーム詳細ページ タブ化リファクタリング

## 背景

現状の実委側フォーム関連ページは階層が4段で深すぎる。

```
フォーム一覧 (テーブル)
  └─ フォーム詳細 (2カラム + サイドバー)
       └─ 回答一覧 (テーブル)
            └─ 回答詳細 (フォーム項目表示)
```

「テーブル → 詳細 → テーブル → 詳細」の繰り返しで、今どこの階層にいるかわかりにくい。

## ゴール

フォーム詳細ページにタブを導入し、実質 **2階層** に減らす。

```
フォーム一覧
  └─ フォーム詳細
       ├─ [内容] タブ: フォームプレビュー + サイドバー
       └─ [回答] タブ: 回答一覧テーブル → 行クリックでダイアログ表示
```

## 変更方針

### 1. フォーム詳細ページにタブを追加

**対象:** `apps/web/src/routes/committee/forms/$formId/index.tsx`

- Radix UI の `Tabs` コンポーネントを使用
- タブ2つ: 「内容」「回答」
- サイドバーはタブの外（共通）に置く
  - サイドバーの「回答を確認する」ボタンは不要になるので削除
- レイアウトイメージ:

```
┌─────────────────────────────────────────┐
│ ← フォーム一覧    ステータスバッジ       │
│ フォームタイトル                         │
│ 説明文                                   │
├─────────────────────────────────────────┤
│ [内容]  [回答]                           │
├──────────────────────────┬──────────────┤
│                          │              │
│  タブコンテンツ           │  サイドバー   │
│  (内容 or 回答一覧)      │  (共通)      │
│                          │              │
└──────────────────────────┴──────────────┘
```

### 2.「内容」タブ

現在のフォーム詳細ページのメインコンテンツ部分をそのまま移動。

- フォーム項目プレビュー (`FormItemsPreview`)
- メタ情報（作成日・更新日）

### 3.「回答」タブ

現在の `answers/index.tsx` のテーブル部分を移植。

- DataTable（企画名・提出日時・各設問の回答値・アクション）
- 回答がない場合の空状態メッセージ
- タブの「回答」ラベルに件数バッジを付けると分かりやすい（例: `回答 (5)`）
- 表示条件: フォームが PUBLISHED or EXPIRED の場合のみ表示可能（それ以外はタブ自体を非表示 or disabled）

### 4. 回答詳細をダイアログ化

現在の `answers/$answerId/index.tsx` をダイアログコンポーネントに変換。

- 回答一覧テーブルの行クリック or アクションボタンで開く
- ダイアログ内に表示する内容:
  - 企画名・提出日時
  - 各設問のラベル + 回答値（`AnswerField` を disabled で表示）
- 既存の `AnswerDialog` コンポーネント（企画側）を参考にできる

### 5. ルーティング変更

**削除するルート:**
- `apps/web/src/routes/committee/forms/$formId/answers/index.tsx`
- `apps/web/src/routes/committee/forms/$formId/answers/$answerId/index.tsx`
- 対応する `.module.scss` ファイル

**変更するルート:**
- `apps/web/src/routes/committee/forms/$formId/index.tsx` — タブ化

**ルート削除後:**
- `routeTree.gen.ts` の再生成が必要（`bun run dev` で自動生成される）

### 6. サイドバーの変更

**対象:** `apps/web/src/routes/committee/forms/$formId/-components/FormDetailSidebar.tsx`

- 「回答を確認する」ボタン（回答一覧へのリンク）を削除
- タブで直接アクセスできるため不要

### 7. フォーム一覧のアクションメニュー

**対象:** `apps/web/src/routes/committee/forms/index.tsx`

- 「回答を確認する」アクション → フォーム詳細の回答タブへ直接遷移するように変更
  - 遷移先: `/committee/forms/$formId?tab=answers`
  - URLクエリパラメータでタブの初期選択を制御

### 8. loader の変更

現在のフォーム詳細ページの loader に回答データの取得を追加。

```typescript
loader: async ({ params }) => {
  const [formRes, membersRes, responsesRes] = await Promise.all([
    getFormDetail(params.formId),
    listCommitteeMembers(),
    listFormResponses(params.formId).catch(() => ({ responses: [] })),
  ]);
  // ...
};
```

- 回答一覧の取得は権限エラー（owner/collaborator でない場合）を catch して空配列にする
- 回答タブが非表示の場合は取得自体をスキップしてもよい（パフォーマンス最適化）

## 影響範囲

| ファイル | 変更内容 |
|---------|---------|
| `routes/committee/forms/$formId/index.tsx` | タブ化、loader に回答取得追加 |
| `routes/committee/forms/$formId/index.module.scss` | タブ用スタイル追加 |
| `routes/committee/forms/$formId/-components/FormDetailSidebar.tsx` | 回答確認ボタン削除 |
| `routes/committee/forms/$formId/-components/AnswerDetailDialog.tsx` | **新規作成**: 回答詳細ダイアログ |
| `routes/committee/forms/$formId/answers/index.tsx` | **削除** |
| `routes/committee/forms/$formId/answers/index.module.scss` | **削除** |
| `routes/committee/forms/$formId/answers/$answerId/index.tsx` | **削除** |
| `routes/committee/forms/$formId/answers/$answerId/index.module.scss` | **削除** |
| `routes/committee/forms/index.tsx` | アクションメニューの遷移先変更 |
| `routeTree.gen.ts` | 自動再生成 |
