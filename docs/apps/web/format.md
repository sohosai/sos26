# 日付フォーマット

`apps/web/src/lib/format.ts` で提供する日付フォーマットユーティリティの仕様です。

## `formatDate`

```ts
formatDate(date: Date, format: "date" | "datetime"): string
```

`Date` オブジェクトを表示用文字列に変換します。

| format | 出力例 | 用途 |
|---|---|---|
| `"date"` | `2026-02-20` | 日付のみの表示 |
| `"datetime"` | `2026-02-20 11:30` | 日時の表示（お知らせ作成日時、配信日時など） |

### 使い方

```tsx
import { formatDate } from "@/lib/format";

formatDate(notice.createdAt, "datetime"); // "2026-02-20 11:30"
formatDate(notice.createdAt, "date");     // "2026-02-20"
```

### タイムゾーン

`Date` オブジェクトのローカルタイムゾーン（実行環境のタイムゾーン）で表示されます。配信日時の入力時は JST（`+09:00`）で `Date` を生成しています。

### DataTable での利用

`DataTable` の `DateCell` コンポーネントは内部でこの `formatDate` を使用しています。
