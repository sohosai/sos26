# 配信先指定モード 仕様書

## 1. 概要

お知らせ・申請の配信先を指定する方法として、従来の「個別指定」に加え「カテゴリ指定」モードを追加した。カテゴリ指定では企画区分（ProjectType）と実施場所（ProjectLocation）を条件として指定し、条件に合致する企画に動的に配信する。

---

## 2. 用語定義

| 用語 | 説明 |
|------|------|
| **カテゴリ指定** | 企画区分・実施場所を条件として配信先を指定するモード。条件に合致する企画すべてに配信される |
| **個別指定** | 従来の方式。マスターシートUIから企画を個別に選択して配信先を指定する |
| **企画区分（ProjectType）** | `NORMAL`（普通企画）、`FOOD`（食品企画）、`STAGE`（ステージ企画） |
| **実施場所（ProjectLocation）** | `INDOOR`（屋内）、`OUTDOOR`（屋外）、`STAGE`（ステージ） |
| **Delivery の同期** | 企画の作成時と企画区分・実施場所の変更時に、カテゴリ指定の Delivery を企画の現在の属性に合わせて作成・削除する処理 |

---

## 3. 配信先指定モード

### 3.1 DeliveryMode enum

| 値 | 説明 |
|----|------|
| `INDIVIDUAL` | 個別指定。承認リクエスト作成時に Delivery レコードを作成 |
| `CATEGORY` | カテゴリ指定。フィルタ条件を Authorization に保存し、承認時に Delivery を作成 |

### 3.2 カテゴリ指定の条件

- **企画区分**（`filterTypes`）: 0個以上選択可能
- **実施場所**（`filterLocations`）: 0個以上選択可能
- **両方未選択**: 全企画に配信される
- **マッチング**: AND 結合。選択された企画区分のいずれか **かつ** 選択された実施場所のいずれかに合致すれば配信対象（片方のみ指定した場合は、指定した条件のみで絞り込み）

### 3.3 マッチングロジックの例

| filterTypes | filterLocations | 配信対象 |
|------------|----------------|---------|
| `[]` | `[]` | **全企画** |
| `[NORMAL, FOOD]` | `[]` | 普通企画 OR 食品企画 |
| `[]` | `[INDOOR, OUTDOOR]` | 屋内 OR 屋外の企画 |
| `[FOOD]` | `[INDOOR]` | 食品企画 AND 屋内の企画（両方を満たす企画のみ） |
| `[STAGE]` | `[STAGE]` | ステージ企画 AND ステージ実施の企画（両方を満たす企画のみ） |

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
3. この時点では Delivery レコードを作成しない（[5.2](#52-カテゴリ指定の-delivery-の作成と削除) を参照）

### 5.2 カテゴリ指定の Delivery の作成と削除

| 時機 | 処理 | 実装 |
|------|------|------|
| 承認時 | 条件に合致する企画すべてに Delivery を作成する | `ensureFormDeliveriesForAuthorization` / `ensureNoticeDeliveriesForAuthorization` |
| 企画の作成時、企画区分・実施場所の変更時 | その企画の Delivery を同期する | `syncCategoryDeliveriesForProject` |
| 配信通知の送信時 | 条件に合致する企画のうち、Delivery が無い企画に作成する | `apps/api/src/routes/internal-notification.ts` |

同期では、企画の現在の `type` / `location` に合わせて次の処理を行う。

1. 配信時刻を過ぎていない Authorization のうち、条件に合致しなくなったものの Delivery を削除する
2. 条件に合致する APPROVED の Authorization について、まだ Delivery が無ければ作成する

配信時刻を過ぎた Delivery は、あとで条件に合致しなくなっても削除しない。

Delivery は配信時刻より前に存在する。企画側の取得と権限の判定では、Authorization が `APPROVED` で配信時刻が到来していることも確認する。

---

## 6. フロントエンド

### 6.1 UI

公開申請ダイアログ（お知らせ・申請共通）に `SegmentedControl` でモード切替を追加:

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
| API | `apps/api/src/routes/committee-notice.ts` | カテゴリモード対応（承認リクエスト作成、承認時の Delivery 作成） |
| API | `apps/api/src/routes/committee-form.ts` | 同上 |
| API | `apps/api/src/lib/project-delivery-targets.ts` | 配信対象の解決、Delivery の作成と同期 |
| API | `apps/api/src/routes/internal-notification.ts` | 配信通知の送信 |
| Web | `apps/web/.../PublishRequestDialog.tsx` | お知らせ公開申請ダイアログ |
| Web | `apps/web/.../FormPublishRequestDialog.tsx` | 申請公開申請ダイアログ |

---

## 8. 後方互換性

- `deliveryMode` のデフォルト値は `INDIVIDUAL` であるため、既存の Authorization レコードはすべて個別指定として扱われる
- `filterTypes` / `filterLocations` は配列型で、デフォルトは空配列
- 企画側の読み取りロジックは Delivery レコードベースのまま変更なし
