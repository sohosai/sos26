# フォーム編集履歴リファクタ

> **目的**: フォーム設問の編集（企画の提出・実委の編集）を append-only の `FormItemEditHistory` で統一管理し、旧 Override 関連テーブルを廃止する
> **ブランチ**: `refactor/cell-history`（main から切る）
> **マージ先**: main → feat/mastersheet にマージ
> **仕様書**: `docs/mastersheet-spec.md` §2, §7, §8, 付録 を参照

---

## 背景

現状の課題:

1. **現在値と履歴が別テーブル**: `MastersheetOverride`（現在値）と `MastersheetEditHistory`（履歴）の二重管理
2. **FormAnswer に履歴がない**: 企画の提出・再提出時に旧回答が全削除→再作成され、変更の追跡ができない
3. **STALE_OVERRIDE が分かりにくい**: 再提出時にオーバーライドを残す仕様がユーザーの混乱を招く
4. **レコード削除が発生する**: オーバーライドの「削除」が必要で、監査上の不安がある
5. **マスターシート固有の設計**: 編集履歴がマスターシートに閉じており、フォーム回答画面で活用できない

設計方針:

- `FormItemEditHistory`（append-only）で企画の提出と実委の編集を統一管理
- キーは `formItemId × projectId`（マスターシートカラム非依存）
- 最新レコードの value が表示値。レコードがなければ `FormAnswer` にフォールバック
- `FormAnswer` は企画者の提出時のみ上書き。実委の編集では変更しない
- レコードの削除・更新は行わない
- CUSTOM カラムは実委人のみが編集するため履歴不要（`MastersheetCellValue` をそのまま維持）
- 表示値はマスターシート・フォーム回答画面など全画面で統一

---

## 作業内容

### 1. スキーマ変更

#### 1.1 FormItemEditHistory テーブルを新設

```prisma
model FormItemEditHistory {
  id         String                      @id @default(cuid())
  formItemId String
  formItem   FormItem                    @relation(fields: [formItemId], references: [id], onDelete: Cascade)
  projectId  String
  project    Project                     @relation(fields: [projectId], references: [id])
  textValue  String?
  numberValue Float?
  fileUrl    String?
  selectedOptions FormItemEditHistorySelectedOption[]
  actorId    String
  actor      User                        @relation(fields: [actorId], references: [id])
  trigger    FormItemEditHistoryTrigger
  createdAt  DateTime                    @default(now())

  @@index([formItemId, projectId, createdAt(sort: Desc)])
  @@index([actorId])
}

model FormItemEditHistorySelectedOption {
  id              String               @id @default(cuid())
  editHistoryId   String
  editHistory     FormItemEditHistory  @relation(fields: [editHistoryId], references: [id], onDelete: Cascade)
  formItemOptionId String
  formItemOption  FormItemOption       @relation(fields: [formItemOptionId], references: [id])

  @@unique([editHistoryId, formItemOptionId])
}

enum FormItemEditHistoryTrigger {
  PROJECT_SUBMIT
  PROJECT_RESUBMIT
  COMMITTEE_EDIT
}
```

#### 1.2 廃止するテーブル

- `MastersheetOverride` — 実委編集の現在値テーブル。FormItemEditHistory で代替
- `MastersheetOverrideSelectedOption` — 選択肢の中間テーブル。`FormItemEditHistorySelectedOption` で代替
- `MastersheetEditHistory` — 旧履歴テーブル。FormItemEditHistory に統合

#### 1.3 リレーション更新

**MastersheetColumn:**

```diff
- overrides      MastersheetOverride[]
- editHistory    MastersheetEditHistory[]
```

**FormItem:**

```diff
+ editHistory    FormItemEditHistory[]
```

#### 1.4 共有スキーマ（packages/shared）

セル状態 enum から `DRAFT` と `STALE_OVERRIDE` を削除:

```typescript
export const mastersheetCellStatusSchema = z.enum([
  "NOT_DELIVERED",
  "NOT_ANSWERED",
  "SUBMITTED",
  "COMMITTEE_EDITED",
]);
```

セルスキーマから `isStale` を削除。

履歴レスポンススキーマを追加:

```typescript
export const formItemEditHistorySchema = z.object({
  id: z.string(),
  value: z.string().nullable(),
  actor: z.object({ id: z.string(), name: z.string() }),
  trigger: z.enum([
    "PROJECT_SUBMIT",
    "PROJECT_RESUBMIT",
    "COMMITTEE_EDIT",
  ]),
  createdAt: z.coerce.date(),
});
```

---

### 2. API 変更

#### 2.1 表示値の取得（共通ロジック）

マスターシート・フォーム回答画面で共通して使う表示値取得ロジック:

```typescript
// formItemId × projectId ごとに最新の履歴を取得
const allHistory = await prisma.formItemEditHistory.findMany({
  where: { formItemId: { in: formItemIds }, projectId: { in: projectIds } },
  orderBy: { createdAt: "desc" },
});
const latestByCell = new Map<string, FormItemEditHistory>();
for (const h of allHistory) {
  const key = `${h.formItemId}:${h.projectId}`;
  if (!latestByCell.has(key)) latestByCell.set(key, h);
}

// 表示値: 履歴があれば履歴の値、なければ FormAnswer
function getDisplayValue(formItemId, projectId, formAnswer) {
  const history = latestByCell.get(`${formItemId}:${projectId}`);
  if (history) return history; // textValue, numberValue, fileUrl, selectedOptions を持つ
  return formAnswer; // FormAnswer の値（なければ null）
}
```

#### 2.2 committee-mastersheet.ts

**GET /data — 表示値取得ロジック**

現在: `MastersheetOverride` を直接クエリ → Map に格納

変更後: `FormItemEditHistory` から各セルの最新レコードを取得し、表示値を導出

```typescript
// FORM_ITEM カラムに紐づく formItemId を収集
const formItemIds = formItemColumns.map(c => c.formItemId).filter(Boolean);

// 最新の履歴を取得
const allHistory = await prisma.formItemEditHistory.findMany({
  where: { formItemId: { in: formItemIds } },
  orderBy: { createdAt: "desc" },
});
const latestByCell = new Map<string, FormItemEditHistory>();
for (const h of allHistory) {
  const key = `${h.formItemId}:${h.projectId}`;
  if (!latestByCell.has(key)) latestByCell.set(key, h);
}
```

**computeCellStatus の変更**

```typescript
function computeCellStatus(deliveryId, response, latestHistory) {
  if (!deliveryId) return "NOT_DELIVERED";
  if (!response?.submittedAt && !latestHistory) return "NOT_ANSWERED";
  if (latestHistory?.trigger === "COMMITTEE_EDIT") return "COMMITTEE_EDITED";
  return "SUBMITTED";
}
// NOT_ANSWERED は編集不可。SUBMITTED 以降のみ編集可能。
```

**PUT /overrides → 実委編集の History append**

現在: `MastersheetOverride` を upsert + `MastersheetEditHistory` に記録

変更後: `FormItemEditHistory` に `COMMITTEE_EDIT` を追加

```typescript
// columnId → formItemId の解決が必要
const column = await tx.mastersheetColumn.findUniqueOrThrow({
  where: { id: columnId },
  select: { formItemId: true },
});

const history = await tx.formItemEditHistory.create({
  data: {
    formItemId: column.formItemId,
    projectId,
    textValue,
    numberValue,
    fileUrl,
    actorId: userId,
    trigger: "COMMITTEE_EDIT",
  },
});
if (selectedOptionIds?.length) {
  await tx.formItemEditHistorySelectedOption.createMany({
    data: selectedOptionIds.map(optionId => ({
      editHistoryId: history.id,
      formItemOptionId: optionId,
    })),
  });
}
```

**DELETE /overrides → 廃止**

実委の編集を「取り消す」機能は提供しない（全ての変更は履歴として残る）。
もし元の値に戻す場合は、FormAnswer の値で再度 COMMITTEE_EDIT を行う。

**GET /history — 参照先変更**

`MastersheetEditHistory` → `FormItemEditHistory` に変更。trigger フィールドも返す。
columnId ではなく formItemId で検索。

#### 2.3 project-form.ts（フォーム回答の提出）

POST/PATCH `/:formDeliveryId/response` の `submit=true` 時に、`FormItemEditHistory` への記録を追加する。

```
1. 該当フォームの全 FormItem を取得
2. 各 FormItem について FormItemEditHistory レコードを追加
   - 初回提出: trigger=PROJECT_SUBMIT, value=回答値
   - 再提出: trigger=PROJECT_RESUBMIT, value=新回答値
   - actorId=回答者（企画メンバー）
3. FormAnswer を上書き（現状通り）
```

初回 or 再提出の判定:

```typescript
const isResubmit = !!existingResponse?.submittedAt;
const trigger = isResubmit ? "PROJECT_RESUBMIT" : "PROJECT_SUBMIT";

// 各設問について履歴レコードを追加
for (const answer of answers) {
  const history = await tx.formItemEditHistory.create({
    data: {
      formItemId: answer.formItemId,
      projectId,
      textValue: answer.textValue,
      numberValue: answer.numberValue,
      fileUrl: answer.fileUrl,
      actorId: userId,
      trigger,
    },
  });
  if (answer.selectedOptionIds?.length) {
    await tx.formItemEditHistorySelectedOption.createMany({
      data: answer.selectedOptionIds.map(optionId => ({
        editHistoryId: history.id,
        formItemOptionId: optionId,
      })),
    });
  }
}
```

**注意**: 現行の `mastersheetOverride.updateMany({ isStale: true })` は廃止。History への append で代替される。

#### 2.4 委員会側フォーム回答画面・企画側回答確認画面

FormAnswer の値を直接表示している箇所を、`FormItemEditHistory` の最新値を優先するように変更。

```typescript
// 表示値の導出
const latestHistory = await prisma.formItemEditHistory.findFirst({
  where: { formItemId, projectId },
  orderBy: { createdAt: "desc" },
});

const displayValue = latestHistory
  ? latestHistory // textValue, numberValue, fileUrl, selectedOptions を持つ
  : formAnswer;   // FormAnswer にフォールバック
```

---

### 3. フロント変更

- `STALE_OVERRIDE` / `DRAFT` / `OVERRIDDEN` の分岐を削除、`COMMITTEE_EDITED` を追加
- セルの `isStale` 参照を削除
- レスポンス形状の変更に追従（latestHistory ベース）
- 履歴表示に trigger ラベルを追加（任意）
- 委員会側フォーム回答画面: FormItemEditHistory の最新値を表示
- 企画側回答確認画面: FormItemEditHistory の最新値を表示

---

## 作業チェックリスト

- [ ] `FormItemEditHistory` + `FormItemEditHistorySelectedOption` テーブル + enum 作成のマイグレーション
- [ ] `MastersheetOverride`, `MastersheetOverrideSelectedOption`, `MastersheetEditHistory` 削除のマイグレーション
- [ ] 共有スキーマ更新（DRAFT/STALE_OVERRIDE/OVERRIDDEN 削除、COMMITTEE_EDITED 追加、isStale 削除、History 型追加）
- [ ] 表示値取得の共通ロジック作成
- [ ] committee-mastersheet.ts: GET /data の表示値取得を FormItemEditHistory ベースに変更
- [ ] committee-mastersheet.ts: 実委編集を FormItemEditHistory append に変更
- [ ] committee-mastersheet.ts: NOT_ANSWERED 時の編集を拒否するバリデーション追加
- [ ] committee-mastersheet.ts: DELETE overrides エンドポイントを廃止
- [ ] committee-mastersheet.ts: GET /history の参照先変更
- [ ] committee-mastersheet.ts: computeCellStatus 簡素化
- [ ] project-form.ts: 提出時に FormItemEditHistory 記録を追加
- [ ] project-form.ts: 旧 `mastersheetOverride.updateMany({ isStale: true })` を削除
- [ ] 委員会側フォーム回答画面: FormItemEditHistory の最新値を表示
- [ ] 企画側フォーム回答確認画面: FormItemEditHistory の最新値を表示
- [ ] フロント: STALE_OVERRIDE/DRAFT/OVERRIDDEN 関連コードの削除、COMMITTEE_EDITED 追加
- [ ] フロント: レスポンス形状の変更に追従
- [ ] 型チェック・テスト通過確認

---

## 影響範囲

| ファイル | 変更内容 | 規模 |
|---------|---------|------|
| `apps/api/prisma/schema.prisma` | 3テーブル廃止、1テーブル+1enum 新設。FormItem にリレーション追加 | 中 |
| `packages/shared/src/schemas/mastersheet.ts` | 状態 enum 変更、isStale 削除、History 型追加 | 小 |
| `apps/api/src/routes/committee-mastersheet.ts` | Override CRUD → History append。GET /data ロジック変更 | **大** |
| `apps/api/src/routes/project-form.ts` | 提出時に History 記録追加。Override stale 処理削除 | 中 |
| 委員会側フォーム回答画面 | FormItemEditHistory の最新値を表示 | 中 |
| 企画側フォーム回答確認画面 | FormItemEditHistory の最新値を表示 | 中 |
| `apps/web/.../FormItemCell.tsx` | isStale 参照削除、レスポンス型変更 | 小 |
| `apps/web/.../MastersheetTable.tsx` | レスポンス形状の変更 | 小 |
| `apps/web/.../FormCellStatusBadge.tsx` | DRAFT/STALE_OVERRIDE/OVERRIDDEN 削除、COMMITTEE_EDITED 追加 | 小 |
| API クライアント・エンドポイント定義 | 型変更 | 小 |

---

## 注意事項

- このリファクタは main にマージ後、feat/mastersheet にマージされる
- feat/mastersheet 側で STALE_OVERRIDE / OVERRIDDEN の UI 実装がある場合、マージ後に COMMITTEE_EDITED に置き換える
- マイグレーションは開発環境のみ（本番未デプロイのため破壊的変更可）
- `FormItemEditHistory` は FormItem に紐づくため、マスターシートカラムが存在しない FormItem にも対応可能
- committee-mastersheet.ts では columnId → formItemId の解決が必要（MastersheetColumn.formItemId を参照）
