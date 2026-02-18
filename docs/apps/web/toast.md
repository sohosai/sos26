# トースト通知

ユーザーへのフィードバック（成功・エラー・情報）を表示するために **Sonner** を使用する。

## 目次

- [トースト通知](#トースト通知)
	- [目次](#目次)
	- [基本方針](#基本方針)
	- [セットアップ](#セットアップ)
	- [使い方](#使い方)
		- [基本](#基本)
		- [種別](#種別)
		- [Promise 連携](#promise-連携)
	- [使い分けの指針](#使い分けの指針)
	- [禁止事項](#禁止事項)

## 基本方針

- トースト通知は **操作結果のフィードバック** に使う（保存成功、エラー発生など）
- `alert()` や `console.error()` をユーザー向けフィードバックとして使わない
- 重要な確認が必要な場合はトーストではなく **ConfirmDialog** を使う
- Sonner の `toast()` 関数をコンポーネントからそのまま呼び出す（ラッパー不要）

## セットアップ

`<Toaster />` は `main.tsx` の `<Theme>` 内に配置済み。Radix UI の CSS Variables を引き継ぐため、`<Theme>` の内側に置く必要がある。

```tsx
// src/main.tsx
<Theme accentColor="indigo" grayColor="slate" panelBackground="solid">
  <RouterProvider router={router} />
  <Toaster />
</Theme>
```

## 使い方

### 基本

`sonner` から `toast` をインポートして呼び出すだけで使える。Provider や Context は不要。

```tsx
import { toast } from "sonner";

function handleSave() {
  try {
    await saveData();
    toast.success("保存しました");
  } catch {
    toast.error("保存に失敗しました");
  }
}
```

### 種別

用途に応じて適切な種別を使い分ける。

| 種別 | 関数 | 用途 |
|------|------|------|
| 成功 | `toast.success()` | 操作が正常に完了した |
| エラー | `toast.error()` | 操作が失敗した |
| 情報 | `toast.info()` | 補足情報を伝える |
| 警告 | `toast.warning()` | 注意を促す |

```tsx
toast.success("保存しました");
toast.error("エラーが発生しました");
toast.info("新しいバージョンがあります");
toast.warning("この操作は取り消せません");
```

### Promise 連携

非同期処理の状態（実行中→成功/失敗）を自動で表示できる。

```tsx
toast.promise(saveData(), {
  loading: "保存中...",
  success: "保存しました",
  error: "保存に失敗しました",
});
```

## 使い分けの指針

| 状況 | 使うもの |
|------|----------|
| 操作の成功・失敗を伝える | `toast.success()` / `toast.error()` |
| 補足的な情報を伝える | `toast.info()` / `toast.warning()` |
| 非同期処理の進捗を見せる | `toast.promise()` |
| ユーザーの確認が必要な操作 | **ConfirmDialog**（トーストではない） |
| フォームのバリデーションエラー | **TextField の error prop**（トーストではない） |

## 禁止事項

- `alert()` や `window.confirm()` をユーザー向けフィードバックに使わない
- `console.error()` だけでエラーを握りつぶさない（ユーザーに見えるフィードバックを返す）
- フォームのバリデーションエラーをトーストで表示しない（フィールドの `error` prop を使う）
- トーストに長文を入れない（1〜2文で簡潔に）
