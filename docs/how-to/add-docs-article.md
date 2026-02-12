# ドキュメント記事の追加手順

`/docs` ページに表示されるユーザー向けドキュメント記事を追加する手順です。

## 概要

記事は Markdown ファイルで管理し、Vite の `?raw` インポートで文字列として読み込み、`react-markdown` でレンダリングしています。

```
apps/web/src/content/docs/
├── index.ts              # 記事マニフェスト（ここに登録）
├── getting-started.md    # 記事ファイル（Markdown）
├── project-guide.md
└── committee-guide.md
```

## 手順

### 1. Markdown ファイルを作成

`apps/web/src/content/docs/` に `.md` ファイルを作成します。

```md
# 記事タイトル

本文をMarkdownで記述します。GFM（テーブル、チェックリスト等）に対応しています。
```

### 2. マニフェストに登録

`apps/web/src/content/docs/index.ts` を編集します。

**インポートを追加:**

```ts
import myArticle from "./my-article.md?raw";
```

**`articles` 配列にエントリを追加:**

```ts
export const articles: DocArticle[] = [
  // ...既存の記事
  {
    slug: "my-article",       // URLパス（/docs/my-article）
    title: "記事タイトル",      // サイドバーに表示される名前
    category: "general",      // カテゴリ（下記参照）
    content: myArticle,
  },
];
```

### 3. 完了

dev サーバーを起動して `/docs/my-article` にアクセスし、表示を確認します。

## カテゴリ

| 値 | 表示名 | 対象 |
|---|--------|------|
| `"general"` | 全体 | 全ユーザー共通の記事 |
| `"project"` | 企画人向け | 企画参加者向けの記事 |
| `"committee"` | 実委人向け | 実行委員向けの記事 |

カテゴリはサイドバーのセクション分けに使われます。記事がないカテゴリは自動的に非表示になります。

## 注意事項

- `slug` は URL に使われるため、半角英数字とハイフンのみを使用してください
- `slug` は全記事でユニークにしてください
- 同一カテゴリ内の表示順は `articles` 配列の並び順で決まります
