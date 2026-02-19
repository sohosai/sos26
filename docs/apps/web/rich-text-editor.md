# RichTextEditor

[Tiptap](https://tiptap.dev/) ベースのリッチテキストエディタコンポーネント。
`TextArea` の代替として、書式付きテキスト入力が必要な場面で使用する。

## 設計方針

- **primitives の `TextArea` と同じ Props パターン**（label / error / required / value / onChange）を踏襲し、置き換えが容易
- **出力は HTML 文字列**。`onChange` で渡される値は `editor.getHTML()` の結果
- ツールバーの各ボタンは primitives の `IconButton` を使用し、デザインを統一
- リンク挿入は Radix `Popover` + `TextField` でインライン UI を提供

## 配置場所

```
apps/web/src/components/patterns/RichTextEditor/
├── index.ts
├── RichTextEditor.tsx
└── RichTextEditor.module.scss
```

`@/components/patterns` から re-export されているため、他の patterns と同様にインポートできる。

```tsx
import { RichTextEditor } from "@/components/patterns";
```

## Props

```tsx
type RichTextEditorProps = {
  label: string;        // 必須（a11y: aria-label に使用）
  error?: string;       // エラーメッセージ
  placeholder?: string; // プレースホルダー
  value?: string;       // HTML 文字列（制御コンポーネントとして使用）
  onChange?: (html: string) => void;
  required?: boolean;   // 必須マーク表示
};
```

## 使い方

```tsx
import { RichTextEditor } from "./RichTextEditor";

const [body, setBody] = useState("");

<RichTextEditor
  label="本文"
  placeholder="お知らせの本文を入力"
  value={body}
  onChange={setBody}
  required
/>
```

### フォームリセット

`value` に空文字列 `""` をセットすると、エディタの内容がクリアされる。

```tsx
const handleSubmit = () => {
  // ...
  setBody("");  // エディタがクリアされる
};
```

### 空判定

`value` は HTML 文字列なので、テキストが空かどうかの判定には HTML タグを除去する必要がある。

```tsx
const isEmpty = !body.replace(/<[^>]*>/g, "").trim();
```

## HTML のサニタイズ（表示側）

RichTextEditor の出力は HTML 文字列であり、表示時に `dangerouslySetInnerHTML` を使用する。
**保存された HTML をそのまま描画すると XSS 脆弱性になるため、表示前に必ず [DOMPurify](https://github.com/cure53/DOMPurify) でサニタイズする。**

```tsx
import DOMPurify from "dompurify";
import { useMemo } from "react";

// サニタイズ結果を useMemo でキャッシュ
const sanitizedBody = useMemo(
  () => (body ? DOMPurify.sanitize(body) : null),
  [body]
);

// 表示
{sanitizedBody && (
  <div
    // biome-ignore lint/security/noDangerouslySetInnerHtml: サニタイズ済みHTML
    dangerouslySetInnerHTML={{ __html: sanitizedBody }}
  />
)}
```

### 注意事項

- `DOMPurify.sanitize()` はデフォルトで `<script>`, `onerror` 等の危険な要素・属性を除去する
- RichTextEditor が生成する HTML（太字・リスト・リンク等）は全てサニタイズ後も保持される
- 新しい Tiptap 拡張を追加して特殊な HTML 属性を出力する場合、DOMPurify の `ALLOWED_ATTR` / `ALLOWED_TAGS` の調整が必要になる可能性がある
- サニタイズは**表示側（フロントエンド）**で行う。APIはHTML文字列をそのまま保存・返却する

## 対応フォーマット

| 機能 | ツールバー | キーボードショートカット |
|------|:---:|---|
| 太字 | IconBold | `Cmd+B` |
| 斜体 | IconItalic | `Cmd+I` |
| 取り消し線 | IconStrikethrough | `Cmd+Shift+S` |
| リンク | IconLink（Popover で URL 入力） | - |
| 箇条書き | IconList | - |
| 番号リスト | IconListNumbers | - |
| 引用 | IconQuote | - |
| 元に戻す / やり直す | -（ツールバーなし） | `Cmd+Z` / `Cmd+Shift+Z` |

## Tiptap 設定

StarterKit をベースに、不要な機能を無効化している。

```tsx
StarterKit.configure({
  heading: false,
  codeBlock: false,
  code: false,
  horizontalRule: false,
})
```

### 拡張機能

| パッケージ | 用途 |
|---|---|
| `@tiptap/starter-kit` | Bold, Italic, Strike, BulletList, OrderedList, Blockquote, History |
| `@tiptap/extension-link` | リンク（`target="_blank"`, `rel="noopener noreferrer"` 固定） |
| `@tiptap/extension-placeholder` | プレースホルダー表示 |

## 機能追加する場合

### ツールバーにボタンを追加

`Toolbar` コンポーネント内に `IconButton` を追加する。アクティブ状態の切り替えパターンは既存ボタンを参照。

```tsx
<IconButton
  size="1"
  intent={editor.isActive("bold") ? "secondary" : "ghost"}
  onClick={() => editor.chain().focus().toggleBold().run()}
  aria-label="太字"
>
  <IconBold size={16} />
</IconButton>
```

### 新しい Tiptap 拡張を追加

1. パッケージをインストール（例: `bun add @tiptap/extension-underline`）
2. `useEditor` の `extensions` 配列に追加
3. ツールバーにボタンを追加

## スタイリング

- エディタ外枠: `border: 1px solid var(--gray-a7)` + `border-radius: var(--radius-2)`
- focus-within: `outline: 2px solid var(--accent-8)`
- ツールバー: `background: var(--gray-a2)`, `data-accent-color="gray"` でアイコンをグレー系に統一
- エディタ本体: `font-size: var(--font-size-2)` で `TextArea` size="2" と統一
- リッチコンテンツ（a, ul, ol, blockquote）: Radix CSS 変数でスタイリング
