# DataTable コンポーネント

`DataTable` は、TanStack React Table をベースにした汎用テーブルコンポーネント（patterns）。
ソート・検索・カラム表示切替・セル選択・コピー・CSV出力・インライン編集を、フィーチャーフラグで柔軟に有効/無効できる。

## 目次

- [DataTable コンポーネント](#datatable-コンポーネント)
	- [目次](#目次)
	- [インポート](#インポート)
	- [基本的な使い方](#基本的な使い方)
	- [Props](#props)
		- [DataTableProps](#datatableprops)
		- [DataTableFeatures](#datatablefeatures)
	- [カラム定義](#カラム定義)
		- [基本のカラム](#基本のカラム)
		- [ColumnMeta](#columnmeta)
	- [セルコンポーネント](#セルコンポーネント)
		- [DateCell](#datecell)
		- [EditableCell](#editablecell)
		- [NameCell](#namecell)
		- [SelectCell](#selectcell)
		- [TagCell](#tagcell)
	- [ユースケース別の設定例](#ユースケース別の設定例)
		- [フル機能テーブル](#フル機能テーブル)
		- [読み取り専用テーブル](#読み取り専用テーブル)
		- [編集可能だが選択・コピー無効](#編集可能だが選択コピー無効)
		- [初期ソート・検索を指定](#初期ソート検索を指定)
	- [機能詳細](#機能詳細)
		- [ソート](#ソート)
		- [グローバル検索](#グローバル検索)
		- [カラム表示切替](#カラム表示切替)
		- [セル選択](#セル選択)
		- [コピー（Ctrl+C / Cmd+C）](#コピーctrlc--cmdc)
		- [CSV出力](#csv出力)
		- [インライン編集](#インライン編集)
		- [バリデーション](#バリデーション)
	- [アクションカラム（display カラム）](#アクションカラムdisplay-カラム)
	- [デモページ](#デモページ)

## インポート

```tsx
import {
	DataTable,
	DateCell,
	EditableCell,
	NameCell,
	SelectCell,
	TagCell,
} from "@/components/patterns";
```

カラム定義には TanStack React Table の `createColumnHelper` を使用する。

```tsx
import { createColumnHelper } from "@tanstack/react-table";
```

## 基本的な使い方

```tsx
type User = {
	id: number;
	name: string;
	email: string;
};

const columnHelper = createColumnHelper<User>();

const columns = [
	columnHelper.accessor("id", { header: "ID" }),
	columnHelper.accessor("name", { header: "名前" }),
	columnHelper.accessor("email", { header: "メールアドレス" }),
];

function UserTable() {
	const [users, setUsers] = useState<User[]>([...]);

	return <DataTable data={users} columns={columns} />;
}
```

デフォルトでは全機能（ソート・検索・カラム表示切替・選択・コピー・CSV出力）が有効。

## Props

### DataTableProps

| Prop | 型 | デフォルト | 説明 |
|------|-----|-----------|------|
| `data` | `T[]` | (必須) | テーブルに表示するデータ配列 |
| `columns` | `ColumnDef<T, any>[]` | (必須) | TanStack Table のカラム定義 |
| `features` | `DataTableFeatures` | 全て `true` | 有効にする機能のフラグ |
| `initialSorting` | `SortingState` | `[]` | 初期ソート状態 |
| `initialGlobalFilter` | `string` | `""` | 初期検索文字列 |
| `onCellEdit` | `(row: T, columnId: string, value: unknown) => void` | - | セル編集時のコールバック。`row` は編集された行の元データオブジェクト |

### DataTableFeatures

各フィーチャーは個別に有効/無効を切り替えられる。指定しないフィーチャーはデフォルト `true`。

| フラグ | デフォルト | 説明 |
|--------|-----------|------|
| `sorting` | `true` | ヘッダークリックでソート |
| `globalFilter` | `true` | テキスト検索ボックス |
| `columnVisibility` | `true` | カラム表示/非表示の切替 |
| `selection` | `true` | セルのクリック/ドラッグ選択 |
| `copy` | `true` | 選択セルの Ctrl+C コピー（TSV形式） |
| `csvExport` | `true` | CSV出力ボタン |

## カラム定義

### 基本のカラム

`createColumnHelper<T>()` でヘルパーを作り、`accessor` でカラムを定義する。

```tsx
const columnHelper = createColumnHelper<User>();

const columns = [
	// シンプルなテキスト表示（編集不可）
	columnHelper.accessor("id", { header: "ID" }),

	// EditableCell（編集可能）
	columnHelper.accessor("name", {
		header: "名前",
		cell: EditableCell,
		meta: { editable: true },
	}),

	// EditableCell（編集不可の表示セル）
	columnHelper.accessor("id", {
		header: "ID",
		cell: EditableCell,
		meta: { editable: false },
	}),
];
```

`cell` を指定しない場合は、値がそのままテキストとして表示される。

### ColumnMeta

TanStack Table の `meta` フィールドでセルの振る舞いを制御する。

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| `editable` | `boolean` | セルを編集可能にするか |
| `type` | `"text" \| "number"` | 入力の型（デフォルト: `"text"`） |
| `options` | `string[]` | SelectCell で使う選択肢リスト |
| `schema` | `ZodType` | EditableCell でのバリデーションスキーマ |
| `dateFormat` | `"date" \| "datetime"` | DateCell の表示形式（デフォルト: `"date"`） |
| `tagColors` | `Record<string, string>` | TagCell のタグ→Radix カラー名マッピング |

## セルコンポーネント

### DateCell

日付表示セル。`Date` オブジェクトを `YYYY/MM/DD` または `YYYY/MM/DD HH:mm` 形式で表示する。読み取り専用。

```tsx
// 日付のみ（デフォルト）
columnHelper.accessor("date", {
	header: "開催日",
	cell: DateCell,
}),

// 日時
columnHelper.accessor("createdAt", {
	header: "登録日時",
	cell: DateCell,
	meta: { dateFormat: "datetime" },
}),
```

### EditableCell

テキスト/数値のインライン編集セル。

- ダブルクリックまたは文字入力で編集モードに入る
- Enter で確定、Escape でキャンセル
- Zod スキーマによるバリデーションに対応

```tsx
columnHelper.accessor("age", {
	header: "年齢",
	cell: EditableCell,
	meta: {
		editable: true,
		type: "number",
		schema: z.coerce.number().int().min(0).max(150),
	},
}),

columnHelper.accessor("email", {
	header: "メールアドレス",
	cell: EditableCell,
	meta: {
		editable: true,
		schema: z.email(),
	},
}),
```

### NameCell

アバター付きの名前表示セル。boring-avatars で自動生成されるアバターを表示する。読み取り専用。

```tsx
columnHelper.accessor("name", {
	header: "名前",
	cell: NameCell,
}),
```

### SelectCell

ドロップダウンによる選択セル。`meta.options` で選択肢を定義する。

```tsx
columnHelper.accessor("department", {
	header: "部署",
	cell: SelectCell,
	meta: {
		editable: true,
		options: ["営業部", "開発部", "人事部", "総務部"],
	},
}),
```

`editable: false` の場合はテキスト表示のみになる。

### TagCell

タグ表示セル。`string[]` を受け取り、Radix Badge で複数のタグを表示する。読み取り専用。`meta.tagColors` でタグごとの色を指定できる（未指定のタグは `"gray"`）。色には [Radix Colors](https://www.radix-ui.com/colors) のカラー名（`"blue"`, `"green"`, `"red"`, `"orange"`, `"purple"` など）を使用する。

```tsx
columnHelper.accessor("tags", {
	header: "タグ",
	cell: TagCell,
	meta: {
		tagColors: {
			式典: "blue",
			全体: "green",
			ステージ: "purple",
		},
	},
}),
```

## ユースケース別の設定例

### フル機能テーブル

全機能を有効にし、セル編集にも対応する場合。`features` を省略するとデフォルトで全て有効。

```tsx
<DataTable
	data={users}
	columns={userColumns}
	onCellEdit={(row, columnId, value) => {
		setUsers(prev =>
			prev.map(r => (r === row ? { ...r, [columnId]: value } : r))
		);
	}}
/>
```

### 読み取り専用テーブル

ソートと検索のみ有効。

```tsx
<DataTable
	data={logData}
	columns={logColumns}
	features={{
		selection: false,
		copy: false,
		columnVisibility: false,
		csvExport: false,
	}}
/>
```

### 編集可能だが選択・コピー無効

```tsx
<DataTable
	data={products}
	columns={productColumns}
	features={{ selection: false, copy: false }}
	onCellEdit={(row, columnId, value) => {
		setProducts(prev =>
			prev.map(r => (r === row ? { ...r, [columnId]: value } : r))
		);
	}}
/>
```

### 初期ソート・検索を指定

```tsx
<DataTable
	data={taskData}
	columns={taskColumns}
	initialSorting={[{ id: "priority", desc: true }]}
	initialGlobalFilter="進行中"
	features={{ selection: false, copy: false }}
/>
```

## 機能詳細

### ソート

テーブルヘッダーをクリックすると昇順 → 降順 → ソート解除の順でトグルする。ヘッダーには `↑`（昇順）、`↓`（降順）、`↑↓`（未ソート）のインジケーターが表示される。

### グローバル検索

テーブル上部の検索ボックスに入力すると、全カラムを対象にフィルタリングされる。

### カラム表示切替

「表示カラム」ボタンのポップオーバーから、各カラムの表示/非表示を切り替えられる。

### セル選択

- クリック: 単一セル選択
- Shift+クリック: 矩形範囲選択
- Ctrl/Cmd+クリック: 選択の追加/解除
- ドラッグ: 範囲選択
- Escape: 選択解除
- テーブル外クリック: 選択解除

選択中のセル数が下部に表示される。

### コピー（Ctrl+C / Cmd+C）

選択中のセルを TSV（タブ区切り）形式でクリップボードにコピーする。Excel やスプレッドシートに直接貼り付け可能。

### CSV出力

「CSV出力」ボタンで、現在表示中のデータを `table.csv` としてダウンロードする。BOM 付き UTF-8 で出力されるため、Excel で直接開いても文字化けしない。

### インライン編集

`EditableCell` または `SelectCell` を使用し、`onCellEdit` コールバックを渡すことで有効になる。
`onCellEdit` 内で state を更新することでデータが反映される。

### バリデーション

`EditableCell` は `meta.schema` に Zod スキーマを指定することで、確定時にバリデーションを実行する。エラーがあるとセル下部にエラーメッセージが表示され、有効な値を入力するまで編集モードから抜けられない。

```tsx
meta: {
	editable: true,
	type: "number",
	schema: z.coerce.number().int().min(0).max(150),
}
```

## アクションカラム（display カラム）

TagCell や DateCell は読み取り専用のため、編集が必要な場合はテーブル外の UI（Dialog など）で対応する。
`columnHelper.display()` で表示専用のカラムを追加し、行ごとのアクションボタンを配置するパターンが使える。

```tsx
const eventColumnHelper = createColumnHelper<Event>();

const eventColumns = [
	eventColumnHelper.accessor("title", { header: "イベント名" }),
	eventColumnHelper.accessor("tags", {
		header: "タグ",
		cell: TagCell,
		meta: { tagColors: TAG_COLORS },
	}),
	// アクションカラム
	eventColumnHelper.display({
		id: "actions",
		header: "",
		cell: ({ row }) => (
			<IconButton
				variant="ghost"
				size="1"
				onClick={() => openEditor(row.original)}
			>
				<IconPencil size={16} />
			</IconButton>
		),
	}),
];
```

**ポイント:**

- `display()` はデータに紐づかない表示専用カラム（ソート・フィルタの対象外）
- 編集ロジックはテーブルの外（親コンポーネント側）で管理する
- セルコンポーネント自体に編集責務を持たせず、関心を分離する
- `/dev/table/` のサンプル5（イベント一覧）で Dialog によるタグ編集の実装例を確認できる

## デモページ

開発環境で `/dev/table/` にアクセスすると、5種類のサンプルテーブルを確認できる。

1. ユーザー管理 - フル機能（ソート、検索、編集、カラム表示切替、CSV出力）
2. 商品一覧 - 編集可能、選択・コピー無効
3. ログ - 読み取り専用（ソート・検索のみ）
4. タスク一覧 - 初期ソート・検索付き
5. イベント一覧 - DateCell・TagCell・アクションカラムによるタグ編集 Dialog
