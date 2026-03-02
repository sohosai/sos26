# マスターシート機能 計画書

> **ステータス**: 計画・検討段階（Draft）
> **作成日**: 2026-02-25
> **更新日**: 2026-03-02
> **ブランチ**: `feat/mastersheet`

## 1. 背景と課題

### 現状の問題

これまで雙峰祭の各局は、企画に関する情報を**局ごとにフォーム等で収集し、独自の Excel ファイル等で個別管理**してきた。これにより以下の問題が生じている。

- **情報のサイロ化**: 他局の Excel ファイルを閲覧できず、どの局がどんな情報を保持しているか把握できない
- **情報の分散**: 従来の SOS ではフォームごとの回答一覧は見れたが、複数フォームにまたがる情報を結合して確認するには結局 Excel に頼る必要があった
- **ステートの二重管理**: Excel ファイルは元データ（フォーム回答等）の更新が手動反映になるため、データの不整合が発生しやすい

### 解決の方向性

企画に関する情報を**一つのテーブル（シート）に統合的に集約**し、SOS 上で閲覧・編集・管理できるようにすることで、上記の問題を解消する。これがマスターシート機能である。

## 2. コンセプト

**マスターシートは、企画に関する情報を統合的に管理するためのカスタマイズ可能なシート（表）である。**

- 1 行 = 1 企画
- 企画の基本情報は初期カラムとしてデフォルトで表示される（非表示にもできる）
- それ以外のカラムはユーザーが自由に追加でき、カラムごとに権限を設定できる
- フォーム回答をカラムとして取り込むことで、情報の一元管理が可能になる

## 3. カラム体系

マスターシートのカラムは以下の 3 種類に分類される。

### 3.1 初期カラム（基本情報）

企画の基本情報として**初期状態で表示される**カラム。全ユーザーが閲覧可能。他のカラムと同様に表示/非表示を切り替えることができる。

| カラム名 | 元データ | 編集 |
|---------|---------|------|
| 企画番号 | `Project.number` | 不可 |
| 企画名 | `Project.name` | 不可 |
| 企画種別 | `Project.type` | 不可 |
| 団体名 | `Project.organizationName` | 不可 |
| 企画責任者 | `Project.owner` | 不可 |
| 副企画責任者 | `Project.subOwner` | 不可 |

### 3.2 フォーム由来カラム

フォーム機能の回答データをカラムとして取り込む。1 カラム = 1 つの `FormItem`（フォームの質問項目）に対応する。

#### カラムの追加フロー

1. 「フォームからカラムを追加」を選択
2. 閲覧権限のあるフォーム一覧から対象フォームを選択（自分が owner または collaborator のフォーム）
3. フォーム内の項目（`FormItem`）一覧から取り込みたい項目を選択
4. カラムが追加される（カラム名 = `FormItem.label`、説明 = フォーム名が自動設定）

#### FormItemType とマスターシート表示の対応

| `FormItemType` | 回答データフィールド | マスターシートでの表示 | セルコンポーネント |
|---|---|---|---|
| `TEXT` | `textValue: string?` | テキスト（短文） | `EditableCell` (`type: "text"`) |
| `TEXTAREA` | `textValue: string?` | テキスト（長文） | 専用コンポーネント（展開表示） |
| `NUMBER` | `numberValue: float?` | 数値 | `EditableCell` (`type: "number"`) |
| `SELECT` | `selectedOptions[]`（1 件） | 選択肢ラベル | `SelectCell` |
| `CHECKBOX` | `selectedOptions[]`（複数） | 選択肢ラベル（タグ表示） | `MultiSelectCell`（新規） |
| `FILE` | `fileUrl: string?` | ファイルリンク | `FileCell`（新規: リンク表示） |

#### データ取得経路

フォーム由来カラムの値は以下の経路で取得する。

```
FormItem (カラムが参照する質問項目)
  ↓ formItemId
FormAnswer (各企画の回答値)
  ↑ formResponseId
FormResponse (1 配信につき最大 1 件)
  ↑ formDeliveryId
FormDelivery (企画への配信)
  ↑ formAuthorizationId
FormAuthorization (承認済みの配信)
  ↓ projectId
Project (= マスターシートの行)
```

1 企画につき 1 フォームの配信は 1 回のみ（`FormDelivery` は事実上 1 企画 × 1 フォームで 1 件）のため、その `FormDelivery` に紐づく `FormResponse`（存在すれば）をそのまま参照する。

#### セルの状態と表示

| 状態 | 条件 | 表示 |
|------|------|------|
| **未配信** | 該当企画への `FormDelivery` が存在しない | 空セル（灰色背景） |
| **未回答** | `FormDelivery` はあるが `FormResponse` がない | 「未回答」ラベル |
| **下書き** | `FormResponse` はあるが `submittedAt` が null | 回答値を薄字で表示 + 「下書き」バッジ |
| **提出済み** | `submittedAt` が非 null | 回答値を通常表示 |
| **オーバーライド済み** | `MastersheetOverride` が存在し `isStale = false` | オーバーライド値を表示 + 上書きアイコン |
| **要確認** | `MastersheetOverride` が存在し `isStale = true` | オーバーライド値を表示 + 警告アイコン（「元データが更新されました」） |

### 3.3 自由追加カラム

ユーザーが任意に作成できるカラム。

- カラムの型を指定して作成する
- 作成時に説明テキストを設定できる
- 各セルの値を型に従って自由に編集できる

#### 対応する型

初期実装では以下の 4 型に対応する。

| 型 | 説明 | 対応する既存セルコンポーネント |
|---|------|--------------------------|
| テキスト | 自由入力 | `EditableCell` (`type: "text"`) |
| 数値 | 数値入力 | `EditableCell` (`type: "number"`) |
| 単一選択 | 選択肢から 1 つ選ぶ | `SelectCell` |
| 複数選択 | 選択肢から複数選ぶ | 新規作成が必要（`MultiSelectCell`） |

## 4. 権限モデル

### 4.1 権限の種類

カラムには以下の公開範囲を設定できる。

| 公開範囲 | 説明 |
|---------|------|
| **private** | 作成者本人のみ閲覧・編集可能 |
| **public** | 公開範囲を指定して共有可能 |

public の場合、以下の粒度で閲覧対象を指定する（`ViewerScope` enum を使用、お問い合わせ機能と共用）。

| 対象 | 説明 |
|------|------|
| 全員 | 全実委人が閲覧可能 |
| 特定の局 | 指定した局（`Bureau`）のメンバーが閲覧可能 |
| 特定の個人 | 指定したユーザーのみ閲覧可能 |

### 4.2 フォーム由来カラムの権限

フォーム由来カラムはフォーム側の閲覧権限をそのまま引き継ぐ。マスターシート側で独自の権限設定は行わない。

フォーム機能の権限モデルでは、**フォームの回答を閲覧できるのは Form の owner および collaborator のみ**である。したがって:

- フォーム由来カラムの閲覧可否 = 対象フォームの owner または collaborator であるか
- §5.2 のカラム一覧には、フォーム由来カラムも表示される（閲覧権限がなくてもカラム名・フォーム名は見える）
- §5.3 の閲覧申請が承認された場合、**フォームの collaborator（読み取り専用）として追加する**ことで権限を付与する

### 4.3 閲覧権限と編集権限

閲覧権限と編集権限は分離せず、**閲覧できるユーザーは編集も可能**とする（共同編集モデル）。

- 権限管理をシンプルに保てる
- 編集履歴（§7.3）により、誰がいつ何を変更したかを追跡できる
- 誤った編集があった場合も履歴から復元が可能

## 5. カラムの表示と選択

### 5.1 表に表示するカラムの選択

ユーザーが表に表示するカラムを選択できる。選択可能なカラムは以下の通り。

- 初期カラム（企画の基本情報）
- 自分が作成した private カラム
- 閲覧権限のある public カラム

> 既存の DataTable の `columnVisibility` 機能をベースに、権限に基づくフィルタリングを追加する形で実装できる。

### 5.2 カラムの一覧・発見

**public カラムの全一覧**と**自分が作成した private カラム**を表示する機能を設ける。他ユーザーの private カラムは一覧にも表示されない（存在自体が見えない）。

- 閲覧権限がある public カラム → カラム名 + 内容が確認でき、表への追加が可能
- **閲覧権限がない public カラム → カラム名のみ表示される**
- 自分が作成した private カラム → カラム名 + 内容が確認でき、表への追加が可能
- いずれの場合も、カラム名・作成者・説明を一覧で表示する

これにより「どの局がどんな情報を持っているか」を把握できるようになり、情報のサイロ化を防ぐ。

### 5.3 閲覧申請

閲覧権限がない public カラムに対して**閲覧申請**を行える。

- 申請ボタンを押すと、カラムの管理者に通知が届く
- 管理者が承認すると、申請者はそのカラムの閲覧・表への追加が可能になる

カラムの管理者は以下のように決定する。

- **自由追加カラム**: 作成者＝管理者
- **フォーム由来カラム**: フォームのオーナー＝管理者

## 6. カラムフィルター

### 6.1 概要

各カラムに対して個別のフィルター条件を設定でき、**複数カラムのフィルターを同時に適用**できる。フィルターは AND 条件で結合される（すべてのフィルター条件を満たす行のみ表示）。

既存のグローバル検索（全カラム横断のテキスト検索）とは独立して動作し、併用も可能。

### 6.2 カラムの型ごとのフィルター

| カラムの型 | フィルター方式 | 説明 |
|-----------|-------------|------|
| テキスト | 部分一致検索 | 入力した文字列を含む行を表示 |
| 数値 | 範囲指定 | 最小値・最大値を指定して絞り込み |
| 単一選択 | 複数値選択 | チェックボックスで表示したい値を複数選択 |
| 複数選択 | 複数値選択 | 選択肢のうち指定した値を含む行を表示 |
| 企画種別（初期） | 複数値選択 | `ProjectType` の値から複数選択 |

### 6.2.1 フォーム由来カラムの状態フィルター

フォーム由来カラムには、値フィルターに加えて**セルの状態**でも絞り込めるフィルターを設ける。

- 状態フィルターと値フィルターは AND で結合される
- デフォルトは全状態チェック済み（= フィルターなし）
- 選択した状態のいずれかに該当する行を表示（状態間は OR）

| 状態 | 説明 |
|------|------|
| 未配信 | `FormDelivery` が存在しない |
| 未回答 | `FormDelivery` はあるが `FormResponse` がない |
| 下書き | `FormResponse` はあるが `submittedAt` が null |
| 提出済み | `submittedAt` が非 null かつオーバーライドなし |
| オーバーライド済み | `MastersheetOverride` が存在し `isStale = false` |
| 要確認 | `MastersheetOverride` が存在し `isStale = true` |

### 6.3 UI

カラムヘッダーにフィルターアイコンを配置し、クリックするとポップオーバーでフィルター条件の入力 UI を表示する。

```
┌──────────────┬──────────────────┬────────────────┐
│ 企画番号      │ 企画名 🔽 ▼      │ 企画種別 🔽 ▼   │
├──────────────┼──────────────────┼────────────────┤
│              │  ┌────────────┐  │                │
│              │  │ 検索...     │  │                │
│              │  └────────────┘  │                │
│              │                  │                │
└──────────────┴──────────────────┴────────────────┘
 🔽 = ソート   ▼ = フィルター

▼ クリック時のポップオーバー（選択型の例）:
┌────────────────────┐
│ ☑ ステージ企画      │
│ ☑ 食品企画          │
│ ☐ 物品販売          │
│ ☑ 展示企画          │
│                    │
│ [クリア] [適用]     │
└────────────────────┘
```

- フィルターが適用されているカラムはアイコンの色やバッジで視覚的に区別する
- ツールバーに「適用中のフィルター」をまとめて表示し、個別にクリアできるようにする

### 6.4 ビュー（フィルターパターンの保存）

Excel のシートのように、フィルター条件・表示カラム・ソート順などのテーブル状態を**ビュー**として名前をつけて保存できる。

- ビューの実体はクエリパラメータとして表現される（URL で再現可能）
- 複数のビューを保持でき、切り替えはクエリパラメータの操作で実現する
- ビューの例: 「食品企画一覧」「未回答企画」「ステージ企画（当日スケジュール順）」

```
/committee/mastersheet?view=food-projects
  → 内部的にはフィルター・ソート・表示カラムのクエリパラメータに展開される

保存されたビュー:
┌──────────────────────────────────────────┐
│ ▼ ビュー切替                              │
│ ┌──────────────────────────────────────┐ │
│ │ ● 食品企画一覧                        │ │
│ │ ○ 未回答企画                          │ │
│ │ ○ ステージ企画（当日スケジュール順）    │ │
│ │                                      │ │
│ │ [+ 現在の条件を保存]                   │ │
│ └──────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

### 6.5 技術的な方針

- TanStack Table の `columnFilters` ステートと `getFilteredRowModel()` を活用する
- 現在の DataTable は `globalFilter` のみ使用しているが、`columnFilters` を追加で管理する
- DataTable の `features` に `columnFilter?: boolean` を追加し、マスターシート以外の既存テーブルには影響しないようにする
- カラムの型ごとにカスタムフィルター関数（`filterFn`）を定義する
- テーブル状態（フィルター・ソート・表示カラム）をクエリパラメータにシリアライズ/デシリアライズする
- ビューの保存・管理はバックエンド（DB）で永続化する

## 7. セルの編集

### 7.1 自由追加カラムの編集

設定された型に従って内容を編集できる。既存の `EditableCell` や `SelectCell` を活用する。

### 7.2 フォーム由来カラムの編集

企画人がフォームで回答した内容を、実委人がマスターシート上で修正できるようにする。

- **ユースケース**: 企画側から連絡があり、回答内容を修正する必要がある場合

#### データモデル: オーバーライド方式

フォームの元回答（`FormAnswer`）は直接変更せず、マスターシート側に**オーバーライド層**を設ける。

- マスターシートでセルを編集すると、オーバーライド値として保存される
- 元の `FormAnswer` データには一切影響しない
- オーバーライドにも編集履歴（§7.3）が適用される

#### オーバーライドのデータ構造

`MastersheetOverride` テーブルは `FormAnswer` と同じ値フィールド構造を持つ。

```
MastersheetOverride {
  columnId     → MastersheetColumn  // どのカラムのオーバーライドか（FORM_ITEM 型のカラムを指す）
  projectId    → Project            // どの企画に対するオーバーライドか
  textValue    String?              // TEXT, TEXTAREA 用
  numberValue  Float?               // NUMBER 用
  fileUrl      String?              // FILE 用
  selectedOptions []                // SELECT, CHECKBOX 用（FormItemOption を参照）
  editorId     → User              // 誰が上書きしたか
  isStale      Boolean @default(false)  // 企画側の回答が再提出されて古くなった場合 true
}
@@unique([columnId, projectId])  // 1 企画 × 1 カラムにつき最大 1 件
```

- SELECT/CHECKBOX のオーバーライドは、元の `FormItemOption` の選択肢から選ぶ（新しい選択肢は追加できない）
- オーバーライドを「元に戻す」操作はレコードの削除で実現する
- 企画側が回答を再提出した際、そのフォームに紐づく全 `MastersheetOverride` の `isStale` を `true` にする

#### 表示の使い分け

| 表示箇所 | 上書きなし | 上書きあり（isStale=false） | 上書きあり（isStale=true） |
|---------|----------|--------------------------|--------------------------|
| **マスターシート** | 元データを表示 | オーバーライド値を表示 + 上書きアイコン | オーバーライド値を表示 + 警告アイコン（元データが更新された旨） |
| **フォーム回答画面** | 元データを表示 | オーバーライド値を表示しつつ、上書きされている旨を明示。元データも確認できる | 同左 |

### 7.3 編集履歴

誰がどのセルを何から何に変更したかの履歴を保持する。

- **記録データ**: 編集者、対象セル（行 × カラム）、変更前の値、変更後の値、変更日時
- **表示方法（案）**: セルを選択すると、そのセルの編集履歴がパネルやポップオーバーで表示される

```
┌─────────────────────────────────────────────────────┐
│  企画A  │ カラムX                                     │
│─────────┼───────────────────────────────────────────│
│  編集履歴                                             │
│  ┌─────────────────────────────────────────────────┐│
│  │ 2026/02/25 14:30  田中太郎                      ││
│  │ 「未定」→「確定済み」                              ││
│  ├─────────────────────────────────────────────────┤│
│  │ 2026/02/20 10:00  佐藤花子                      ││
│  │ （初回入力）「未定」                               ││
│  └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

## 8. マスターシートからの操作

マスターシートの行（企画）を選択して、その企画を対象に各種操作を行える機能。配信設定ではマスターシートを使った配信先選択が**初期実装から必須**となる。

### 8.1 想定する操作

- 選択した企画にお知らせを配信する
- 選択した企画にフォームを配信する

### 8.2 利点

マスターシートにはソート・絞り込み検索機能があるため、条件に合致する企画を効率的に選択して配信先に指定できる。例えば「食品企画のうち、カラム X が未回答の企画」などの条件でフィルタして一括選択できる。

### 8.3 UI の方針

お知らせ・フォームの**配信先選択ダイアログ内にマスターシートと同等の UI を埋め込む**。

- マスターシートページとほぼ同じテーブル UI（フィルター・ソート・カラム表示切替）を表示する
- 行（企画）を選択して配信先に指定できる
- 既存の配信フローの中で完結する

## 9. 技術方針

### 9.1 フロントエンド

- 既存の **DataTable コンポーネント**を基盤としてカスタマイズする
- DataTable が既に提供する以下の機能を活用する:
  - セルの選択・ドラッグ選択（`useSelection`）
  - 選択セルのコピー（`useCopyToClipboard`、TSV 形式）
  - グローバル検索（`globalFilter`）
  - カラム表示/非表示の切替（`columnVisibility`）
  - ソート（`sorting`）
  - CSV エクスポート（`csvExport`）
  - セル編集（`EditableCell`, `SelectCell`）
- 追加で必要な機能:
  - 権限に基づくカラムの動的生成
  - カラム追加/管理 UI
  - カラムフィルター（§6 参照）
  - セル選択時の編集履歴表示
  - 行の複数選択（配信先選択用）
  - カラムの説明表示（ヘッダーホバー時の Tooltip。フィルター・ソート UI との兼ね合いで変更の可能性あり）

### 9.2 バックエンド

- ルート: `/committee/mastersheet/*`（既にルートパスは確保済み）

#### DB スキーマ（案）

```prisma
// ─── カラム定義 ───

enum MastersheetColumnType {
  FORM_ITEM   // フォーム由来
  CUSTOM      // 自由追加
}

enum MastersheetDataType {
  TEXT
  NUMBER
  SELECT
  MULTI_SELECT
}

enum MastersheetColumnVisibility {
  PRIVATE
  PUBLIC
}

model MastersheetColumn {
  id          String @id @default(cuid())
  type        MastersheetColumnType

  // 共通
  name        String                        // 表示名（フォーム由来: FormItem.label から自動設定）
  description String?                       // 説明（フォーム由来: フォーム名を自動設定）
  sortOrder   Int                           // 表示順
  createdById String
  createdBy   User @relation(...)

  // フォーム由来カラムの場合
  formItemId  String?                       // → FormItem.id
  formItem    FormItem? @relation(...)

  // 自由追加カラムの場合
  dataType    MastersheetDataType?          // CUSTOM の場合のみ使用
  visibility  MastersheetColumnVisibility?  // CUSTOM の場合のみ使用（FORM_ITEM はフォーム側の権限）

  // リレーション
  viewers     MastersheetColumnViewer[]     // PUBLIC の閲覧範囲
  options     MastersheetColumnOption[]     // SELECT/MULTI_SELECT の選択肢
  cellValues  MastersheetCellValue[]
  overrides   MastersheetOverride[]
  editHistory MastersheetEditHistory[]
  accessRequests MastersheetAccessRequest[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

// ─── 自由追加カラムの選択肢 ───

model MastersheetColumnOption {
  id        String @id @default(cuid())
  columnId  String
  column    MastersheetColumn @relation(...)
  label     String
  sortOrder Int
  // セル値は label ではなく id で参照する（ラベル変更時の不整合を防ぐ）
}

// ─── 自由追加カラムの値 ───

model MastersheetCellValue {
  id          String @id @default(cuid())
  columnId    String
  column      MastersheetColumn @relation(...)
  projectId   String
  project     Project @relation(...)

  textValue   String?
  numberValue Float?
  // SELECT/MULTI_SELECT は中間テーブル（MastersheetCellSelectedOption）で管理

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([columnId, projectId])
}

// ─── フォーム回答のオーバーライド ───

model MastersheetOverride {
  id          String @id @default(cuid())
  columnId    String
  column      MastersheetColumn @relation(...)
  projectId   String
  project     Project @relation(...)

  textValue   String?             // TEXT, TEXTAREA
  numberValue Float?              // NUMBER
  fileUrl     String?             // FILE
  // SELECT/CHECKBOX は中間テーブル（MastersheetOverrideSelectedOption）で管理

  isStale     Boolean @default(false)  // 企画側が再提出した場合に true になる

  editorId    String
  editor      User @relation(...)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([columnId, projectId])
}

// ─── カラムの公開範囲（自由追加カラム用） ───

// InquiryViewerScope → ViewerScope にリネーム（Inquiry・マスターシート共用）

model MastersheetColumnViewer {
  id          String @id @default(cuid())
  columnId    String
  column      MastersheetColumn @relation(...)

  scope       ViewerScope                    // ALL, BUREAU, INDIVIDUAL（汎用 enum）
  bureauValue Bureau?                       // scope = BUREAU の場合
  userId      String?                       // scope = INDIVIDUAL の場合
}

// ─── 閲覧申請 ───

model MastersheetAccessRequest {
  id          String @id @default(cuid())
  columnId    String
  column      MastersheetColumn @relation(...)
  requesterId String
  requester   User @relation(...)

  status      ApprovalStatus                // PENDING, APPROVED, REJECTED（汎用 enum）
  decidedAt   DateTime?

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

// ─── 編集履歴 ───

model MastersheetEditHistory {
  id          String @id @default(cuid())
  columnId    String
  column      MastersheetColumn @relation(...)
  projectId   String
  project     Project @relation(...)

  oldValue    String?                       // JSON シリアライズ
  newValue    String?                       // JSON シリアライズ

  editorId    String
  editor      User @relation(...)

  createdAt   DateTime @default(now())
}

// ─── ビュー（保存されたフィルターパターン） ───

model MastersheetView {
  id          String @id @default(cuid())
  name        String
  createdById String
  createdBy   User @relation(...)

  // テーブル状態を JSON で保存
  // { columns: string[], filters: {...}, sorting: {...} }
  state       String                        // JSON

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

#### API エンドポイント（案）

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/committee/mastersheet/data` | マスターシートのデータ取得（カラム定義 + 全企画の値） |
| POST | `/committee/mastersheet/columns` | カラム追加（自由追加 or フォーム由来） |
| PATCH | `/committee/mastersheet/columns/:columnId` | カラム設定変更（名前・説明・権限・順序） |
| DELETE | `/committee/mastersheet/columns/:columnId` | カラム削除 |
| PUT | `/committee/mastersheet/cells/:columnId/:projectId` | セル値の更新（自由追加カラム） |
| PUT | `/committee/mastersheet/overrides/:columnId/:projectId` | オーバーライド値の設定（フォーム由来カラム） |
| DELETE | `/committee/mastersheet/overrides/:columnId/:projectId` | オーバーライドの取消（元データに戻す） |
| GET | `/committee/mastersheet/columns/:columnId/history/:projectId` | セルの編集履歴取得 |
| GET | `/committee/mastersheet/columns/discover` | カラム一覧（発見用、権限外も名前のみ表示） |
| POST | `/committee/mastersheet/columns/:columnId/access-request` | 閲覧申請 |
| PATCH | `/committee/mastersheet/access-requests/:requestId` | 閲覧申請の承認/却下 |
| GET | `/committee/mastersheet/views` | 保存済みビュー一覧 |
| POST | `/committee/mastersheet/views` | ビュー保存 |
| DELETE | `/committee/mastersheet/views/:viewId` | ビュー削除 |

### 9.3 ページ配置

実委人専用の機能として `/committee/mastersheet/` に配置する。企画側には公開しない。

## 10. 未決定事項まとめ

今後の議論・決定が必要な項目を整理する。

### 決定済み

| # | 項目 | 決定内容 |
|---|------|---------|
| 1 | フォーム由来カラムの閲覧申請 → collaborator 追加 | **許容する**。フォーム管理画面からも回答が閲覧可能になる副作用は、情報共有の促進の観点から問題ない |
| 2 | TEXTAREA の表示方法 | セル内は先頭 N 文字を**省略表示**、**クリックで展開** |
| 3 | FILE 型カラムの編集 | 初期実装では FILE 型の**オーバーライドは非対応**（閲覧のみ） |
| 5 | ビューの共有 | 保存済みビューは**作成者のみ**。ビューの実体はクエリパラメータなので、URL を共有すれば他ユーザーも同じ表示を再現でき、「現在の条件を保存」で自分のビューとして保存できる |
| 6 | マスターシートデータの取得方式 | **1 リクエストで全取得**。企画数は最大 400 件程度で十分現実的 |
| 7 | 初期カラムの編集可否 | **編集不可のまま**。企画情報の変更は企画情報編集ページ（別途実装予定）で行い、そちらが正（SSOT） |
| 4 | ViewerScope enum | `InquiryViewerScope` を **`ViewerScope` に汎用リネーム**し、Inquiry・マスターシートで共用する。実装時に既存コードのリネーム作業が必要 |
| 8 | ApprovalStatus enum | `FormAuthorizationStatus` を **`ApprovalStatus` に汎用リネーム**し、FormAuthorization・マスターシート閲覧申請で共用する。実装時に既存コードのリネーム作業が必要 |

### 未決定

現在未決定の項目はありません。

### 実装時のリネーム作業

| 対象 | 変更前 | 変更後 | 影響範囲 |
|------|--------|--------|---------|
| enum | `InquiryViewerScope` | `ViewerScope` | Prisma schema, Inquiry 関連コード, shared schemas |
| enum | `FormAuthorizationStatus` | `ApprovalStatus` | Prisma schema, FormAuthorization 関連コード, shared schemas |
