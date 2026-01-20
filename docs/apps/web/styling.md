# スタイリング規約

本プロジェクトでは **CSS Modules (SCSS)** と **Radix CSS Variables** を組み合わせて使用する。

## 目次

- [スタイリング規約](#スタイリング規約)
	- [目次](#目次)
	- [基本方針](#基本方針)
	- [カスケードレイヤー](#カスケードレイヤー)
		- [レイヤー構成](#レイヤー構成)
		- [CSS Modules とレイヤー](#css-modules-とレイヤー)
		- [なぜ CSS Modules で @layer を使わないか](#なぜ-css-modules-で-layer-を使わないか)
		- [注意点](#注意点)
	- [Theme の設定](#theme-の設定)
		- [配置ルール](#配置ルール)
		- [設定項目](#設定項目)
		- [色の扱い](#色の扱い)
	- [CSS Variables（Design Token）](#css-variablesdesign-token)
		- [使用義務](#使用義務)
		- [Space（余白）スケール](#space余白スケール)
		- [使用例](#使用例)
	- [CSS Modules の利用](#css-modules-の利用)
		- [ファイル命名規則](#ファイル命名規則)
		- [使い方](#使い方)
		- [CSS Modules の利点](#css-modules-の利点)
	- [禁止例](#禁止例)

## 基本方針

- デザイン値（色・余白・角丸・文字サイズ・影）は**必ず CSS Variables 経由**で指定する
- レイアウトは自作 CSS（Flex / Grid）で記述する
- CSS Modules でスコープを分離する
- light / dark モードの分岐は CSS 側で書かない（Radix に任せる）

## カスケードレイヤー

本プロジェクトでは **CSS Cascade Layers**（`@layer`）を使用して、ベーススタイルの優先順位を明示的に管理している。

### レイヤー構成

```css
@layer reset, radix;

@import "./reset.css" layer(reset);
@import "./global.scss" layer(reset);
@import "@radix-ui/themes/styles.css" layer(radix);
```

| レイヤー | 用途                             | 優先度 |
| -------- | -------------------------------- | ------ |
| `reset`  | リセット CSS、グローバルスタイル | 低     |
| `radix`  | Radix UI Themes のスタイル       | 中     |

### CSS Modules とレイヤー

**CSS Modules では `@layer` を使用しない。**

レイヤーなしのスタイルは、すべてのレイヤーよりも優先度が高くなる。これにより、CSS Modules のスタイルが Radix のスタイルを確実に上書きできる。

```scss
// ComponentName.module.scss
// @layer を使わない
.button {
  cursor: pointer;
}
```

### なぜ CSS Modules で @layer を使わないか

CSS Modules は Vite によって個別にバンドルされるため、`index.css` のレイヤー宣言と同期できない。
レイヤーなしで記述することで、読み込み順序に関係なく Radix より優先される。

### 注意点

- グローバルに適用したいスタイルは `reset` レイヤーに配置
- Radix のスタイルは `main.tsx` ではなく `index.css` 内で読み込む（レイヤー制御のため）
- 新しいレイヤーを追加する場合は `@layer` 宣言の順序を慎重に検討すること

## Theme の設定

### 配置ルール

`<Theme>` は**アプリのルート（body直下）に1つだけ配置**する。
CSS Variables は Theme 配下でのみ有効であるため、Theme 外に UI を描画してはならない。

```tsx
// src/main.tsx
import { Theme } from "@radix-ui/themes";

createRoot(rootElement).render(
  <StrictMode>
    <Theme accentColor="indigo" grayColor="slate">
      <RouterProvider router={router} />
    </Theme>
  </StrictMode>
);
```

### 設定項目

| 項目 | 説明 | 例 |
|------|------|-----|
| `accentColor` | アクセントカラー | `"indigo"`, `"blue"`, `"green"` |
| `grayColor` | グレースケール | `"slate"`, `"gray"`, `"mauve"` |
| `radius` | 角丸のスケール | `"small"`, `"medium"`, `"large"` |
| `scaling` | UIのスケーリング | `"90%"`, `"100%"`, `"110%"` |
| `appearance` | ライト/ダーク | `"light"`, `"dark"`, `"inherit"` |

### 色の扱い

- `accentColor` / `grayColor` は **Radix 提供のもの**を使用
- HEX 値を直接指定しない
- カスタム `accentColor` は原則禁止（Design System 自作レベルのため）

利用可能な色は [Radix Colors](https://www.radix-ui.com/colors) を参照。

## CSS Variables（Design Token）

### 使用義務

以下の値は**必ず CSS Variables 経由**で指定する。

| 種類 | 変数例 |
|------|--------|
| 色 | `var(--accent-9)`, `var(--gray-11)` |
| 余白 | `var(--space-1)` 〜 `var(--space-9)` |
| 角丸 | `var(--radius-1)` 〜 `var(--radius-6)` |
| 文字サイズ | `var(--font-size-1)` 〜 `var(--font-size-9)` |
| 影 | `var(--shadow-1)` 〜 `var(--shadow-6)` |

### Space（余白）スケール

| 変数 | 値 |
|------|-----|
| `--space-1` | 4px |
| `--space-2` | 8px |
| `--space-3` | 12px |
| `--space-4` | 16px |
| `--space-5` | 24px |
| `--space-6` | 32px |
| `--space-7` | 40px |
| `--space-8` | 48px |
| `--space-9` | 64px |

### 使用例

```scss
.container {
  padding: var(--space-4);
  border-radius: var(--radius-3);
  background-color: var(--gray-2);
  color: var(--gray-12);
}

.title {
  font-size: var(--font-size-5);
  font-weight: var(--font-weight-bold);
  margin-bottom: var(--space-3);
}

.card {
  box-shadow: var(--shadow-2);
  border: 1px solid var(--gray-6);
}
```

## CSS Modules の利用

### ファイル命名規則

コンポーネントのスタイルは `.module.scss` 拡張子を使用する。

```
ComponentName.module.scss
```

### 使い方

```tsx
// ComponentName.tsx
import styles from "./ComponentName.module.scss";

export function ComponentName() {
  return <div className={styles.container}>コンテンツ</div>;
}
```

```scss
// ComponentName.module.scss
.container {
  padding: var(--space-4);
  background-color: var(--gray-2);

  &:hover {
    background-color: var(--gray-3);
  }
}
```

### CSS Modules の利点

- **スコープの分離**: クラス名の衝突を防ぐ
- **SCSS機能**: ネスト、変数、ミックスインなどが使用可能
- **型安全**: TypeScriptでクラス名の補完が効く

## 禁止例

以下は本プロジェクトで**禁止**する。

```scss
// NG: px / HEX での直書き
.bad {
  padding: 12px;           // NG: var(--space-3) を使う
  color: #333;            // NG: var(--gray-12) を使う
  border-radius: 6px;     // NG: var(--radius-2) を使う
  background: #2563eb;    // NG: var(--accent-9) を使う
}

// NG: ダークモード分岐
.bad-dark {
  background: white;

  @media (prefers-color-scheme: dark) {
    background: black;    // NG: CSS Variables に任せる
  }
}
```

```scss
// OK: CSS Variables を使用
.good {
  padding: var(--space-3);
  color: var(--gray-12);
  border-radius: var(--radius-2);
  background-color: var(--accent-9);
}
```
