# ルーティング

このプロジェクトでは TanStack Router によるファイルベースルーティングを採用しています。

## 目次

- [ルーティング](#ルーティング)
	- [目次](#目次)
	- [ページの作成](#ページの作成)
		- [ディレクトリ構造](#ディレクトリ構造)
		- [ページの雛形](#ページの雛形)
	- [コンポーネントのインポート](#コンポーネントのインポート)
	- [検索パラメータ（クエリパラメータ）](#検索パラメータクエリパラメータ)
		- [スキーマの定義](#スキーマの定義)
			- [`default()` と `catch()` の違い](#default-と-catch-の違い)
		- [パラメータの読み取り](#パラメータの読み取り)
		- [パラメータの更新](#パラメータの更新)

## ページの作成

開発サーバーを起動している時 (`bun run dev`) に、`src/routes` 配下に `page-name/index.tsx` を作成すると、自動的にルートが生成されます。

### ディレクトリ構造

```
src/routes/
├── index.tsx           # / (ホーム)
├── about/
│   └── index.tsx       # /about
└── profile/
    └── index.tsx       # /profile
```

### ページの雛形

```tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/page-name")({
  component: PageName,
  head: () => ({
    meta: [
      {
        title: "ページタイトル",
      },
      {
        name: "description",
        content: "ページの説明",
      },
    ],
  }),
});

function PageName() {
  return (
    <div>
      <h1>ページ名</h1>
    </div>
  );
}
```

## ページ固有コンポーネントのコロケーション

ページでしか使わないコンポーネント（ダイアログ、サイドバーなど）は、ルートファイルと同階層に `-components/` ディレクトリを作成して配置できます。

```
src/routes/committee/notice/
├── index.tsx                      # ルートファイル
├── index.module.scss
├── -components/                   # "-" プレフィクスでルート生成から除外
│   ├── CreateNoticeDialog.tsx
│   └── CreateNoticeDialog.module.scss
└── $noticeId/
    ├── index.tsx
    ├── index.module.scss
    └── -components/
        ├── NoticeDetailSidebar.tsx
        └── PublishRequestDialog.tsx
```

### なぜ `-` プレフィクスなのか

TanStack Router はデフォルトで `routeFileIgnorePrefix: "-"` が設定されており、`-` で始まるファイル・ディレクトリはルート生成の対象外になります。

`_` プレフィクスは TanStack Router で**レイアウトルート**を意味する予約トークンのため、コンポーネント配置には使えません。

### 判断基準

| コンポーネントの性質 | 配置場所 |
|---|---|
| 複数ページで再利用する | `src/components/primitives/` or `patterns/` |
| 特定のページでしか使わない | `src/routes/.../-components/` |

## コンポーネントのインポート

エイリアス (`@/*`) を使用してコンポーネントをインポートできます。

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/Button";

export const Route = createFileRoute("/example")({
  component: Example,
});

function Example() {
  return (
    <div>
      <h1>サンプルページ</h1>
      <Button onClick={() => alert("clicked")}>クリック</Button>
    </div>
  );
}
```

## 検索パラメータ（クエリパラメータ）

TanStack Router では、URL の検索パラメータ（`?q=test&page=1` の部分）を型安全に扱えます。実装例は `src/routes/search/index.tsx` を参照してください。

### スキーマの定義

Zod を使って検索パラメータのスキーマを定義し、`validateSearch` に渡します。

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// 検索パラメータのスキーマ定義
const searchSchema = z.object({
  q: z.string().optional().catch(undefined),
  page: z.number().int().positive().default(1).catch(1),
});

export const Route = createFileRoute("/search/")({
  validateSearch: searchSchema, // スキーマを渡す
  component: SearchPage,
});
```

#### `default()` と `catch()` の違い

| メソッド | 役割 | 例 |
|---------|------|-----|
| `.default(value)` | 値が `undefined` の場合にデフォルト値を設定 | `?page=` → `page: 1` |
| `.catch(value)` | バリデーションエラー時にフォールバック値を設定 | `?page=abc` → `page: 1` |

**推奨パターン**: `.default(value).catch(value)` を組み合わせることで、値がない場合も不正な場合も安全に処理できます。

```tsx
const searchSchema = z.object({
  // 省略可能な文字列（undefined を許容）
  q: z.string().optional().catch(undefined),

  // 必須の正の整数、デフォルト1、不正な値も1にフォールバック
  page: z.number().int().positive().default(1).catch(1),

  // 列挙型の例
  sort: z.enum(["asc", "desc"]).default("asc").catch("asc"),
});
```

| URL | `q` | `page` | 説明 |
|-----|-----|--------|------|
| `/search` | `undefined` | `1` | パラメータなし → default |
| `/search?q=test&page=2` | `"test"` | `2` | 正常な値 |
| `/search?page=-1` | `undefined` | `1` | 負の数 → catch |
| `/search?page=abc` | `undefined` | `1` | 文字列 → catch |

### パラメータの読み取り

コンポーネント内では `Route.useSearch()` フックを使って型安全にパラメータを取得できます。

```tsx
function SearchPage() {
  // 型が自動的に推論される
  const { q, page } = Route.useSearch();

  return (
    <div>
      <h1>検索ページ</h1>
      <p>検索キーワード: {q ?? "なし"}</p>
      <p>ページ: {page}</p>
    </div>
  );
}
```

`/search?q=test&page=2` にアクセスすると、`q` には `"test"`、`page` には `2` が入ります。

### パラメータの更新

`Link` コンポーネントの `search` プロップを使って、検索パラメータを更新できます。

```tsx
import { Link } from "@tanstack/react-router";

function SearchPage() {
  const { q, page } = Route.useSearch();

  return (
    <div>
      {/* 新しい検索パラメータを指定 */}
      <Link to="/search" search={{ q: "新しいキーワード", page: 1 }}>
        新しい検索
      </Link>

      {/* 前の値を引き継いで一部だけ更新 */}
      <Link to="/search" search={(prev) => ({ ...prev, page: (prev.page ?? 1) + 1 })}>
        次のページ
      </Link>
    </div>
  );
}
```

`useNavigate` フックを使ってプログラム的にナビゲーションすることも可能です。

```tsx
import { useNavigate } from "@tanstack/react-router";

function SearchForm() {
  const navigate = useNavigate();

  const handleSearch = (keyword: string) => {
    navigate({
      to: "/search",
      search: { q: keyword, page: 1 },
    });
  };

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      handleSearch(e.currentTarget.keyword.value);
    }}>
      <input name="keyword" type="text" />
      <button type="submit">検索</button>
    </form>
  );
}
```

詳細は [TanStack Router - Search Params](https://tanstack.com/router/latest/docs/framework/react/guide/search-params) を参照してください。
