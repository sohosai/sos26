# UIコンポーネント設計規約

本プロジェクトでは、UIの一貫性・保守性・アクセシビリティを担保するため、
**Radix UI Themes** をUI基盤として採用する。

本規約は「UIライブラリに任せる責務」と「自作CSSで扱う責務」を明確に分離し、
中途半端な混在による設計崩壊を防ぐことを目的とする。

## 目次

- [UIコンポーネント設計規約](#uiコンポーネント設計規約)
	- [目次](#目次)
	- [基本方針](#基本方針)
		- [責務分離の原則](#責務分離の原則)
	- [コンポーネント一覧ページ](#コンポーネント一覧ページ)
	- [なぜラップするのか](#なぜラップするのか)
		- [1. UIの自由度を「意図的に制限」する](#1-uiの自由度を意図的に制限する)
		- [2. アクセシビリティ（a11y）事故を構造的に防ぐ](#2-アクセシビリティa11y事故を構造的に防ぐ)
		- [3. 横断的要件の注入点を一箇所に集約する](#3-横断的要件の注入点を一箇所に集約する)
		- [4. カスタムデザインを適用できる](#4-カスタムデザインを適用できる)
		- [ラップは「抽象化」ではなく「制約付き具体化」](#ラップは抽象化ではなく制約付き具体化)
	- [禁止事項](#禁止事項)
	- [ディレクトリ構造](#ディレクトリ構造)
		- [primitives と patterns の違い](#primitives-と-patterns-の違い)
	- [原子的コンポーネント（Primitives）](#原子的コンポーネントprimitives)
		- [対象コンポーネント](#対象コンポーネント)
		- [Wrapper 設計の原則](#wrapper-設計の原則)
			- [NG: 単なる props 転送](#ng-単なる-props-転送)
			- [OK: 制約と付加がある](#ok-制約と付加がある)
		- [Wrapper のドキュメントルール](#wrapper-のドキュメントルール)
		- [例: Button](#例-button)
		- [例: TextField](#例-textfield)
		- [例: Dialog](#例-dialog)
	- [Checkbox / RadioGroup の使い分け](#checkbox--radiogroup-の使い分け)
		- [一覧](#一覧)
		- [使い分けの指針](#使い分けの指針)
			- [Checkbox（単体）を使う場合](#checkbox単体を使う場合)
			- [CheckboxGroup を使う場合](#checkboxgroup-を使う場合)
			- [RadioGroup を使う場合](#radiogroup-を使う場合)
	- [Typography（Text / Heading）](#typographytext--heading)
		- [UI 部分（Radix Text / Heading を使用）](#ui-部分radix-text--heading-を使用)
		- [コンテンツ部分（通常の HTML 要素を使用）](#コンテンツ部分通常の-html-要素を使用)
		- [判断基準](#判断基準)
	- [レイアウト設計](#レイアウト設計)
		- [レスポンシブ](#レスポンシブ)
	- [ページ実装ルール](#ページ実装ルール)
	- [判断に迷ったときの指針](#判断に迷ったときの指針)

## 基本方針

### 責務分離の原則

UIは以下の3レイヤーに分けて設計する。

| レイヤー             | 内容                       | 実装手段               |
| -------------------- | -------------------------- | ---------------------- |
| 原子的コンポーネント | a11y / 挙動 / 状態管理     | Radix UI Themes        |
| レイアウト           | 配置・構造                 | 自作CSS（Flex / Grid） |
| デザイン値           | 色・余白・角丸・文字サイズ | Radix CSS Variables    |

## コンポーネント一覧ページ

開発環境では `/dev/ui/components` にアクセスすることで、実装済みの primitives / patterns コンポーネントを一覧で確認できる。

このページでは以下を確認できる：

- 各コンポーネントの見た目・バリエーション
- props の違いによる表示差異（intent, size, disabled, error など）
- 実際の操作感（loading 状態、フォーム入力など）

新しいコンポーネントを追加した際は、このページにもサンプルを追加すること。

## なぜラップするのか

Radix UI Themes が提供する既存コンポーネントを、原則として**自作 Wrapper 経由で利用する**。
これは抽象化それ自体を目的とするものではなく、UI設計上の責務を明確化し、長期的な破綻を防ぐための実務的判断である。

### 1. UIの自由度を「意図的に制限」する

Radix UI Themes は汎用ライブラリであり、1コンポーネントに対して多くの props と表現手段を提供する。
しかし、プロダクト単位ではその自由度は過剰になりやすい。

Wrapper は以下を担う：

- 使用可能な props・variant・size・color の**許可集合を限定**
- デフォルト値を統一し、画面ごとの差異を抑制
- 「やってはいけない使い方」を型・APIレベルで封じる

### 2. アクセシビリティ（a11y）事故を構造的に防ぐ

a11y は「気をつける」だけでは守れない。

- label を付け忘れる
- フォーカス管理を誤る
- 危険操作に確認が入らない

Wrapper は、正しい a11y 構造を**書かなくても成立する形で提供**し、
ページ実装者が誤った使い方をしにくい API を作る。

### 3. 横断的要件の注入点を一箇所に集約する

UIコンポーネントには、見た目以外の横断的要件が必ず発生する。

- loading と disabled の整合
- 二重送信・連打防止
- 権限による無効化
- analytics / tracking

これらをページごとに実装すると確実にばらつく。Wrapper は**横断要件の唯一の注入点**として機能する。

### 4. カスタムデザインを適用できる

Wrapper を介することで、Radix のデフォルトスタイルに対してプロジェクト固有のデザイン調整を一箇所で行える。

- className の付与によるスタイル拡張
- Radix の Design Token では表現できない細かな調整
- プロジェクト固有のアニメーションやトランジション

直接 Radix を使うと、デザイン調整がページごとに散らばり、統一性が失われる。

### ラップは「抽象化」ではなく「制約付き具体化」

Wrapper は以下を目的としない：

- 単なる props の転送
- Radix API の隠蔽そのもの
- 汎用ライブラリ化

> Radix が提供する「汎用的で正しいUI」を、プロダクトにとって「狭くて正しいUI」に落とす

この変換こそが Wrapper の役割である。

## 禁止事項

- UIライブラリと自作CSSを無秩序に混在させない
- 色・余白・角丸を `px` / HEX で直書きしない
- ページごとに独自ルールのUIを作らない
- 原子コンポーネントをページ内で直接 Radix から import しない
- **単なる props 転送だけの Wrapper を作らない**

## ディレクトリ構造

```
src/components/
├── primitives/          # Radix UI Themes のラッパー（単一責務）
│   ├── Button/
│   ├── Checkbox/
│   ├── IconButton/
│   ├── Select/
│   ├── Switch/
│   ├── TextField/
│   ├── TextArea/
│   └── index.ts         # 一括エクスポート
│
└── patterns/            # 複合コンポーネント（複数の primitives を組み合わせ）
    ├── CheckboxGroup/
    ├── RadioGroup/
    └── index.ts
```

### primitives と patterns の違い

| 種類           | 役割                                                 | 例                                    |
| -------------- | ---------------------------------------------------- | ------------------------------------- |
| **primitives** | Radix の単一コンポーネントをラップ。制約と付加を行う | Button, IconButton, TextField, Select, Checkbox, Switch |
| **patterns**   | 複数の primitives を組み合わせた複合コンポーネント   | RadioGroup, CheckboxGroup, FormDialog |

patterns は以下の場合に作成する：

- 同じ組み合わせが複数箇所で使われる
- 組み合わせに固有のロジックがある（例: 検索フォームの submit 処理）
- primitives だけでは表現できない UI パターン

## 原子的コンポーネント（Primitives）

### 対象コンポーネント

以下は**必ず Wrapper 経由**で使用する。

- Button / IconButton
- TextField / TextArea
- Select
- Checkbox / Switch
- CheckboxGroup / RadioGroup（patterns）
- Dialog
- DropdownMenu

### Wrapper 設計の原則

Wrapper を作る際は、必ず以下を検討する：

1. **何を制限するか** - Radix の機能のうち、使わせないもの
2. **何を付加するか** - プロジェクト固有の振る舞い
3. **どう a11y を保証するか** - 誤用を防ぐ構造

#### NG: 単なる props 転送

```tsx
// これは意味がない。作る価値がない。
function AppButton(props: ButtonProps) {
  return <Button {...props} />;
}
```

#### OK: 制約と付加がある

```tsx
// variant を意味のある名前に制限
// loading 状態を組み込み
// type="button" をデフォルト化
function Button({ intent, loading, ...props }) {
  // ...
}
```

### Wrapper のドキュメントルール

各 Wrapper には、実装冒頭に以下を**必ず明記**する：

1. **制限していること** - 意図的に使えなくしている機能
2. **付加している振る舞い** - 追加で提供する機能
3. **例外を許す場合の条件** - 制限を緩和する判断基準

---

### 例: Button

Radix の `Button` は `variant`, `size`, `color`, `highContrast`, `radius` など多くの props を持つ。
プロジェクトではこれを**意図（intent）ベース**に制約する。

```tsx
// src/components/primitives/Button/Button.tsx
import { Button as RadixButton } from "@radix-ui/themes";
import type { ComponentProps, MouseEvent, ReactNode } from "react";
import styles from "./Button.module.scss";

/**
 * Button - アプリケーション標準のボタン
 *
 * ## 制限していること
 * - variant/color: intent に集約（primary/secondary/danger/ghost）
 * - size: "1" | "2" のみ（"3", "4" は大きすぎるため不可）
 * - highContrast, radius: 指定不可（デザイン統一）
 *
 * ## 付加している振る舞い
 * - type: デフォルト "button"（フォーム誤送信防止）
 *
 * ## 例外を許す場合
 * - アイコンのみのボタンは IconButton を使う
 * - 特殊なレイアウトが必要な場合は patterns/ で対応
 */

type RadixButtonProps = ComponentProps<typeof RadixButton>;

const intentMap = {
  primary: { variant: "solid", color: undefined },
  secondary: { variant: "outline", color: undefined },
  danger: { variant: "solid", color: "red" },
  ghost: { variant: "ghost", color: undefined },
} as const satisfies Record<
  string,
  {
    variant: RadixButtonProps["variant"];
    color: RadixButtonProps["color"];
  }
>;

type ButtonProps = {
  children: ReactNode;
  intent?: keyof typeof intentMap;
  size?: "1" | "2";
  loading?: boolean;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
};

export function Button({
  children,
  intent = "primary",
  size = "2",
  loading = false,
  disabled = false,
  type = "button",
  onClick,
}: ButtonProps) {
  const { variant, color } = intentMap[intent];

  return (
    <RadixButton
      className={styles.button}
      variant={variant}
      color={color}
      size={size}
      loading={loading}
      disabled={disabled}
      type={type}
      onClick={onClick}
    >
      {children}
    </RadixButton>
  );
}
```

**ポイント:**
- `variant` と `color` を `intent` に集約し、意味のある選択肢だけを提供
- `loading` は Radix の組み込み機能を使用（スピナー表示と disabled を自動処理）
- CSS Modules でカスタムスタイルを適用

---

### 例: IconButton

Radix の `IconButton` を Button と同じ intent ベースで制約する。アイコンのみのボタンに使用する。

```tsx
// src/components/primitives/IconButton/IconButton.tsx

/**
 * IconButton - アプリケーション標準のアイコンボタン
 *
 * ## 制限していること
 * - variant/color: intent に集約（ghost/danger）
 * - size: "1" | "2" のみ（"3", "4" は大きすぎるため不可）
 * - highContrast, radius: 指定不可（デザイン統一）
 *
 * ## 付加している振る舞い
 * - type: デフォルト "button"（フォーム誤送信防止）
 * - ref 転送対応（Radix の Popover.Trigger 等と合成可能）
 */
```

```tsx
// 基本的な使い方
<IconButton onClick={handleEdit}>
  <IconPencil size={16} />
</IconButton>

// 削除用（赤色）
<IconButton intent="danger" onClick={handleDelete}>
  <IconTrash size={16} />
</IconButton>

// 小さいサイズ
<IconButton size="1" onClick={handleAction}>
  <IconPencil size={16} />
</IconButton>
```

**ポイント:**
- `intent` で意味を表現（`ghost` がデフォルト、`danger` で赤色）
- Button と同じパターンで統一感を保つ
- `aria-label` で用途を明示可能

---

### 例: TextField

Radix の `TextField` は入力欄だけを提供する。プロジェクトでは**label 必須**とし、エラー表示も統一する。

```tsx
// src/components/primitives/TextField/TextField.tsx
import { TextField as RadixTextField, Text } from "@radix-ui/themes";
import { useId } from "react";
import styles from "./TextField.module.scss";

/**
 * TextField - アプリケーション標準のテキスト入力
 *
 * ## 制限していること
 * - size: "2" のみ（統一）
 * - variant: "surface" 固定
 * - radius: 指定不可（デザイン統一）
 *
 * ## 付加している振る舞い
 * - label 必須（a11y 保証）
 * - error 時の統一的なスタイル + aria-invalid
 * - id 自動生成（label と input の紐付け）
 * - required マークの表示
 *
 * ## 例外を許す場合
 * - 検索バーなど label が視覚的に不要な場合は aria-label で対応
 */

type TextFieldProps = {
  label: string;
  error?: string;
  placeholder?: string;
  type?: "text" | "email" | "password" | "tel" | "url" | "number" | "search";
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  name?: string;
  autoComplete?: string;
};

export function TextField({
  label,
  error,
  placeholder,
  type = "text",
  value,
  defaultValue,
  onChange,
  required,
  disabled,
  name,
  autoComplete,
}: TextFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div className={styles.container}>
      <Text as="label" size="2" weight="medium" htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </Text>

      <RadixTextField.Root
        id={id}
        size="2"
        variant="surface"
        type={type}
        placeholder={placeholder}
        value={value}
        defaultValue={defaultValue}
        onChange={(e) => onChange?.(e.target.value)}
        required={required}
        disabled={disabled}
        name={name}
        autoComplete={autoComplete}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
      />

      {error && (
        <Text id={errorId} size="1" color="red" role="alert">
          {error}
        </Text>
      )}
    </div>
  );
}
```

**ポイント:**
- `label` を必須にすることで a11y 事故を構造的に防止
- `id` を自動生成し、label と input の紐付けを保証
- エラー表示を統一し、`aria-invalid` と `aria-describedby` を自動設定
- CSS Modules でカスタムスタイルを適用

---

### 例: Dialog

危険な操作には確認ダイアログを強制する。

```tsx
// src/components/primitives/Dialog/ConfirmDialog.tsx
import { AlertDialog, Button, Flex } from "@radix-ui/themes";
import type { ReactNode } from "react";

/**
 * ConfirmDialog - 確認ダイアログ
 *
 * ## 制限していること
 * - 自由なコンテンツ配置（title + description 構造を強制）
 *
 * ## 付加している振る舞い
 * - danger 時は確認ボタンが赤色に
 * - キャンセルボタンを必ず表示
 * - ESC / 背景クリックでキャンセル扱い
 *
 * ## 例外を許す場合
 * - フォームを含む複雑なダイアログは patterns/FormDialog を使う
 */

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  intent?: "default" | "danger";
  onConfirm: () => void;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "確認",
  cancelLabel = "キャンセル",
  intent = "default",
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Content maxWidth="400px">
        <AlertDialog.Title>{title}</AlertDialog.Title>
        <AlertDialog.Description>{description}</AlertDialog.Description>

        <Flex gap="3" mt="4" justify="end">
          <AlertDialog.Cancel>
            <Button variant="soft" color="gray">
              {cancelLabel}
            </Button>
          </AlertDialog.Cancel>
          <AlertDialog.Action>
            <Button
              variant="solid"
              color={intent === "danger" ? "red" : undefined}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </AlertDialog.Action>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
```

**ポイント:**
- `title` + `description` 構造を強制し、適切な情報提供を保証
- `intent="danger"` で視覚的な警告を自動適用
- AlertDialog により ESC / 背景クリックでの誤操作を防止

---

## Checkbox / RadioGroup の使い分け

選択系コンポーネントは用途に応じて使い分ける。

### 一覧

| コンポーネント  | 分類       | 用途                   |
| --------------- | ---------- | ---------------------- |
| `Checkbox`      | primitives | 単体の真偽値入力       |
| `CheckboxGroup` | patterns   | 複数選択可能なグループ |
| `RadioGroup`    | patterns   | 排他選択のグループ     |

### 使い分けの指針

#### Checkbox（単体）を使う場合

- 「利用規約に同意する」など、**単独の真偽値**を扱う
- 他の選択肢と関連しない独立したオン/オフ

```tsx
<Checkbox
  label="利用規約に同意する"
  checked={agreed}
  onCheckedChange={setAgreed}
/>
```

#### CheckboxGroup を使う場合

- 「興味のある分野」など、**複数選択可能な選択肢群**
- 選択した値を配列で管理する

```tsx
<CheckboxGroup label="興味のある分野" value={interests} onValueChange={setInterests}>
  <CheckboxGroupItem value="tech">テクノロジー</CheckboxGroupItem>
  <CheckboxGroupItem value="design">デザイン</CheckboxGroupItem>
  <CheckboxGroupItem value="business">ビジネス</CheckboxGroupItem>
</CheckboxGroup>
```

#### RadioGroup を使う場合

- 「お支払い方法」など、**排他的な選択肢群**
- グループ全体に対するラベルや required 表示が必要

```tsx
<RadioGroup label="お支払い方法" value={payment} onValueChange={setPayment}>
  <RadioGroupItem value="card">クレジットカード</RadioGroupItem>
  <RadioGroupItem value="bank">銀行振込</RadioGroupItem>
</RadioGroup>
```

Checkbox 単体は、本当に独立した 1 つの真偽値を扱う場合（同意チェックボックスなど）に限定する。
複数の選択肢がある場合は必ず Group 版を使用すること。

---

## Typography（Text / Heading）

UI 内のテキスト表示には Radix の `Text` / `Heading` コンポーネントを使用するが、**用途によって使い分ける**。

### UI 部分（Radix Text / Heading を使用）

以下のような「アプリケーション UI」に属するテキストは、Radix の Typography コンポーネントを使用する：

- ボタン、フォームラベル、エラーメッセージ
- ダイアログのタイトル・説明
- 設定画面、管理画面のテキスト
- ナビゲーション、メニュー項目

```tsx
import { Heading, Text } from "@radix-ui/themes";

<Heading size="5">設定</Heading>
<Text size="2" color="gray">アカウント設定を変更できます</Text>
```

**理由:**

- Radix の Design Token と統合され、テーマ切り替えに自動対応
- サイズ・色・ウェイトが一貫したスケールで管理される
- a11y に配慮した適切なコントラスト比

### コンテンツ部分（通常の HTML 要素を使用）

以下のような「コンテンツ」に属するテキストは、通常の HTML 要素（`<h1>`, `<p>`, `<article>` など）を使用してよい：

- 記事本文
- 利用規約、プライバシーポリシー
- ヘルプドキュメント
- マークダウンから生成されるコンテンツ

```tsx
<article className={styles.article}>
  <h1>利用規約</h1>
  <p>本規約は、当サービスの利用条件を定めるものです。</p>
</article>
```

**理由:**

- 長文コンテンツには独自のタイポグラフィ設計が必要な場合がある
- CMSやマークダウンから生成されるHTMLとの親和性
- SEO や構造化の観点で素の HTML が適切な場合がある

### 判断基準

| 用途              | 使用するもの        |
| ----------------- | ------------------- |
| UI ラベル・操作系 | `Text` / `Heading`  |
| フォーム周り      | `Text` / `Heading`  |
| ダイアログ        | `Text` / `Heading`  |
| 記事・規約        | `<h1>` / `<p>` など |
| マークダウン由来  | `<h1>` / `<p>` など |

---

## レイアウト設計

レイアウトは**自作CSS（Flex / Grid）で記述**する。Radix の Layout 系コンポーネントには依存しない。

```scss
.grid {
  display: grid;
  gap: var(--space-5);
  grid-template-columns: 1fr 1fr;
}

.stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
```

### レスポンシブ

- CSS の media query を使用
- ブレイクポイントはプロジェクト内で統一
- Radix の token と矛盾しない設計にする

## ページ実装ルール

- ページは**primitives の組み合わせ**として構築する
- ページ固有の装飾・構造は CSS に閉じ込める
- UIロジックはページではなく primitives / patterns に寄せる

```tsx
// src/routes/settings/index.tsx
import { Button, TextField } from "@/components/primitives";
import styles from "./settings.module.scss";

function Settings() {
  const [loading, setLoading] = useState(false);

  return (
    <div className={styles.container}>
      <h1>設定</h1>
      <form className={styles.form} onSubmit={handleSubmit}>
        <TextField label="ユーザー名" required />
        <TextField label="メールアドレス" type="email" required />
        <Button type="submit" loading={loading}>
          保存
        </Button>
      </form>
    </div>
  );
}
```

## 判断に迷ったときの指針

| 状況                             | 方針                           |
| -------------------------------- | ------------------------------ |
| a11y / 挙動が難しい              | primitives に寄せる            |
| 見た目・配置だけ                 | CSS で書く                     |
| 値に意味がある                   | CSS Variables を使う           |
| 複数の primitives を組み合わせる | patterns コンポーネント化      |
| Wrapper に制約も付加もない       | **作らない（直接使用を検討）** |
