# 配信先指定モード 仕様書

## 1. 概要

お知らせ・フォームの配信先を指定する方法として、従来の「個別指定」に加え「カテゴリ指定」モードを追加した。カテゴリ指定では企画区分（ProjectType）と実施場所（ProjectLocation）を条件として指定し、条件に合致する企画に動的に配信する。

---

## 2. 用語定義

| 用語 | 説明 |
|------|------|
| **カテゴリ指定** | 企画区分・実施場所を条件として配信先を指定するモード。条件に合致する企画すべてに配信される |
| **個別指定** | 従来の方式。マスターシートUIから企画を個別に選択して配信先を指定する |
| **企画区分（ProjectType）** | `NORMAL`（通常企画）、`FOOD`（食品企画）、`STAGE`（ステージ企画） |
| **実施場所（ProjectLocation）** | `INDOOR`（屋内）、`OUTDOOR`（屋外）、`STAGE`（ステージ） |
| **遅延 Delivery 生成** | カテゴリ指定時に、企画がアクセスしたタイミングで Delivery レコードを作成する仕組み |

---

## 3. 配信先指定モード

### 3.1 DeliveryMode enum

| 値 | 説明 |
|----|------|
| `INDIVIDUAL` | 個別指定。承認リクエスト作成時に Delivery レコードを作成 |
| `CATEGORY` | カテゴリ指定。フィルタ条件を Authorization に保存し、Delivery は遅延生成 |

### 3.2 カテゴリ指定の条件

- **企画区分**（`filterTypes`）: 0個以上選択可能
- **実施場所**（`filterLocations`）: 0個以上選択可能
- **制約**: `filterTypes` と `filterLocations` を合わせて **1つ以上** の選択が必要
- **マッチング**: OR 結合。選択された企画区分のいずれか **または** 選択された実施場所のいずれかに合致すれば配信対象

### 3.3 マッチングロジックの例

| filterTypes | filterLocations | 配信対象 |
|------------|----------------|---------|
| `[NORMAL, FOOD]` | `[]` | 通常企画 OR 食品企画 |
| `[]` | `[INDOOR, OUTDOOR]` | 屋内 OR 屋外の企画 |
| `[FOOD]` | `[INDOOR]` | 食品企画 OR 屋内の企画 |
| `[STAGE]` | `[STAGE]` | ステージ企画 OR ステージ実施の企画 |

---

## 4. データモデル

### 4.1 DB スキーマ（追加フィールド）

`NoticeAuthorization` と `FormAuthorization` に以下を追加:

```prisma
deliveryMode     DeliveryMode      @default(INDIVIDUAL)
filterTypes      ProjectType[]
filterLocations  ProjectLocation[]
```

### 4.2 Zod スキーマ

`deliveryTargetSchema`（`packages/shared/src/schemas/common.ts`）:

```typescript
z.discriminatedUnion("mode", [
  { mode: "CATEGORY", projectTypes: ProjectType[], projectLocations: ProjectLocation[] },
  { mode: "INDIVIDUAL", projectIds: string[] },
])
```

承認リクエストの `projectIds` フィールドは `deliveryTarget` に置き換え。

---

## 5. 動作フロー

### 5.1 承認リクエスト作成時

#### 個別指定モード

1. フロントエンドから `deliveryTarget: { mode: "INDIVIDUAL", projectIds: [...] }` を送信
2. バックエンドで企画の存在確認
3. Authorization レコードを `deliveryMode: INDIVIDUAL` で作成
4. Delivery レコードを企画ごとに作成（従来と同じ）

#### カテゴリ指定モード

1. フロントエンドから `deliveryTarget: { mode: "CATEGORY", projectTypes: [...], projectLocations: [...] }` を送信
2. Authorization レコードを `deliveryMode: CATEGORY` で作成、`filterTypes` / `filterLocations` を保存
3. **Delivery レコードは作成しない**

### 5.2 企画側のアクセス時（遅延 Delivery 生成）

企画がお知らせ一覧・詳細・既読、フォーム一覧にアクセスした際:

1. カテゴリモード × APPROVED × 配信時刻到来済み × 未削除の Authorization を検索
2. 企画の `type` / `location` が条件に合致するかチェック（OR 結合）
3. まだ Delivery レコードがなければ `upsert` で作成
4. 通常の Delivery ベースのクエリを実行

これにより:
- **承認後に登録された企画**も、初回アクセス時に Delivery が生成され配信される
- 既存の既読管理・フォーム回答のロジックは変更不要

---

## 6. フロントエンド

### 6.1 UI

公開申請ダイアログ（お知らせ・フォーム共通）に `SegmentedControl` でモード切替を追加:

- **カテゴリ指定**（デフォルト・左タブ）: 企画区分と実施場所のチェックボックス群を表示
- **個別指定**（右タブ）: 従来のマスターシートUI（`ProjectSelectDialog`）

### 6.2 バリデーション

- カテゴリ指定: 企画区分・実施場所を合わせて1つ以上選択で送信可能
- 個別指定: 1件以上の企画を選択で送信可能

---

## 7. 関連ファイル

| レイヤー | ファイル | 内容 |
|---------|---------|------|
| DB | `apps/api/prisma/schema.prisma` | `DeliveryMode` enum、Authorization 拡張 |
| Shared | `packages/shared/src/schemas/common.ts` | `deliveryModeSchema`, `deliveryTargetSchema` |
| Shared | `packages/shared/src/schemas/notice.ts` | Notice Authorization に新フィールド追加 |
| Shared | `packages/shared/src/schemas/form.ts` | Form Authorization に新フィールド追加 |
| API | `apps/api/src/routes/committee-notice.ts` | カテゴリモード対応（承認リクエスト作成） |
| API | `apps/api/src/routes/committee-form.ts` | 同上 |
| API | `apps/api/src/routes/project-notice.ts` | 遅延 Delivery 同期（`syncCategoryNoticeDeliveries`） |
| API | `apps/api/src/routes/project-form.ts` | 遅延 Delivery 同期（`syncCategoryFormDeliveries`） |
| Web | `apps/web/.../PublishRequestDialog.tsx` | お知らせ公開申請ダイアログ |
| Web | `apps/web/.../FormPublishRequestDialog.tsx` | フォーム公開申請ダイアログ |

---

## 8. 後方互換性

- `deliveryMode` のデフォルト値は `INDIVIDUAL` であるため、既存の Authorization レコードはすべて個別指定として扱われる
- `filterTypes` / `filterLocations` は配列型で、デフォルトは空配列
- 企画側の読み取りロジックは Delivery レコードベースのまま変更なし
