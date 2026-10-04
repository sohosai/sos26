# 企画情報管理（実委）機能 仕様書

## 1. 概要

企画が「企画情報」画面で登録した公開情報（`ProjectPublicInfo`）を、実委人が一覧で確認し、項目ごとに非表示・修正できるようにする。非表示・修正の結果は公開API（`/openapi`）に反映される。

## 2. 用語定義

| 用語 | 説明 |
|------|------|
| 登録値 | `ProjectPublicInfo` に保存されている値。企画が保存した値、または実委人が修正した値 |
| 非表示 | 実委人が項目を公開APIに出さないようにすること。登録値は変えない |
| 修正 | 実委人が登録値を書き換えること |
| 公開値 | 公開APIが返す値。登録値に非表示を適用したもの |
| 編集可否設定 | 既存のマップアプリ設定（`MapAppSetting`）。企画側が各項目を編集できるかを全企画一律で切り替える |

## 3. 対象項目

| 項目 | キー | 非表示 | 修正 | 非表示時の公開値 |
|------|------|:---:|:---:|------|
| 紹介文 | `description` | o | o | `null` |
| アイコン | `iconFileId` | o | x | `null` |
| 掲載画像 | `mapImageFileIds` | o（1枚ごと） | x | 配列から除外 |
| Webサイト | `websiteUrls` | o | o | `[]` |
| X | `xIds` | o | o | `[]` |
| Instagram | `instagramIds` | o | o | `[]` |
| YouTube | `youtubeIds` | o | o | `[]` |
| 開店・閉店状態 | `openStatus` | x | x | — |
| 在庫状態 | `stockStatus` | x | x | — |

- 開店・閉店状態と在庫状態は企画が当日に随時更新する運用上の状態のため対象外とする。
- SNSリンクは各サービス最大 `PROJECT_SNS_LINKS_MAX_COUNT`（2）件の配列で、非表示はサービス単位で行う。2件のうち1件だけを公開したくない場合は、修正でその1件を取り除く。
- 企画名・団体名・企画区分・実施場所は `Project` の値であり、既存の企画編集（`PROJECT_EDIT`）で変更する。
- 修正の値は、企画が登録するときと同じ検証（文字数・URL形式・ID形式）を通す。紹介文は空文字（未設定に戻す）、SNSリンクは空配列も受け付ける。

## 4. 非表示と修正の性質

### 4.1 非表示

- 項目（掲載画像は1枚）に付けるフラグで、登録値は変えない。
- 企画が登録値を変えても、実委人が解除するまで非表示のまま続く。
- 掲載画像の非表示はファイル単位で、企画が新たに追加した画像には及ばない。

### 4.2 修正

- 実委人が登録値を直接書き換える。修正前の値は残さない。
- どの項目を誰がいつ修正したかを記録し、企画側・実委側の画面に「実行委員会が修正」と表示する。
- 企画がその項目の値を変えて保存すると、修正の記録は消え、以後は企画の値として扱う。

### 4.3 企画側の編集可否との関係

非表示・修正は企画側の編集可否に影響しない。企画側で項目を編集できるかどうかは、これまでどおり編集可否設定だけで決まる。修正した内容を企画に変えさせたくない場合は、編集可否設定でその項目の編集を止める。

## 5. 公開APIへの反映

### 5.1 公開値の導出

```
非表示が設定されている → 非表示時の公開値（3章の表）
それ以外               → 登録値
```

掲載画像は、非表示の画像を除いた残りを元の並び順のまま返す。

### 5.2 区別できないこと

公開APIのレスポンスは、非表示・修正の有無によって形を変えない。

- 非表示の項目は、企画が未入力の項目と同じ値（`null`、空配列、または配列からの除外）になる。
- 修正は登録値そのものの変更のため、企画が最初からその値を登録した場合と同じになる。
- OpenAPI のスキーマ・説明文にも非表示・修正に関する記述を載せない。

### 5.3 キャッシュ

次の操作の後に `bumpPublicApiCacheVersion()` を呼び、公開APIのキャッシュを即時に破棄する。

- 非表示の設定・解除
- 修正

### 5.4 公開API以外への影響

非表示は公開APIにだけ適用する。企画側サイドバーの企画アイコン（`GET /projects` の `iconFileId`）は、アイコンを非表示にしても登録値を使う。

## 6. 権限

| 操作 | 必要な権限 |
|------|------|
| 企画情報一覧の閲覧（非表示・修正の状態を含む） | 実委人であること |
| 非表示の設定・解除、修正 | `MAP_APP_SETTING_EDIT` |

## 7. データモデル

### 7.1 項目単位の非表示・修正の記録

```prisma
enum ProjectPublicInfoField {
  DESCRIPTION
  ICON
  WEBSITE_URLS
  X_IDS
  INSTAGRAM_IDS
  YOUTUBE_IDS
}

enum ProjectPublicInfoModerationKind {
  HIDDEN    // 非表示
  CORRECTED // 修正の記録
}

model ProjectPublicInfoModeration {
  id                  String            @id @default(cuid())
  projectPublicInfoId String
  projectPublicInfo   ProjectPublicInfo @relation(fields: [projectPublicInfoId], references: [id], onDelete: Cascade)

  field ProjectPublicInfoField
  kind  ProjectPublicInfoModerationKind

  updatedById String
  updatedBy   User   @relation(fields: [updatedById], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([projectPublicInfoId, field, kind])
}
```

- `HIDDEN` のレコードがあれば非表示。解除はレコードの削除。
- `CORRECTED` のレコードは修正時に作成（再修正時は更新）し、企画がその項目の値を変えて保存したときに削除する。
- 1つの項目に `HIDDEN` と `CORRECTED` が同時にあってよい。
- `ICON` は `HIDDEN` のみ。

### 7.2 掲載画像の非表示

`ProjectPublicMapImage` に列を追加する。

```prisma
model ProjectPublicMapImage {
  // 既存の列
  isHidden Boolean @default(false)
}
```

企画が掲載画像を保存し直す（並べ替え・追加・削除）と `ProjectPublicMapImage` は作り直されるが、保存後も残っている画像は同じファイルIDの `isHidden` を引き継ぐ。企画が削除した画像の非表示状態は画像とともに消える。

### 7.3 企画情報が未登録の企画

`ProjectPublicInfo` が無い企画は公開APIに出ないため、非表示・修正はできない。一覧には「未入力」として表示する。

## 8. 落選・企画中止・企画辞退の企画

`deletionStatus` が `null` でない企画（落選・企画中止・企画辞退）の扱い。

| 対象 | 扱い |
|------|------|
| 公開API | 返さない（既存の絞り込みのまま） |
| 企画情報一覧 | 表示しない |
| 非表示・修正 | API では有効な企画と同じく操作できる（画面は一覧に出ないため操作できない） |
| 企画側の編集 | できない（既存の制限のまま） |
| 非表示・修正の記録 | 残す。有効に戻すと、そのまま公開APIに反映される |

論理削除（`deletedAt`）された企画は一覧に表示しない。

## 9. 実委側画面

### 9.1 企画情報一覧

- パス: `/committee/public-info`
- サイドバー: 「企画情報一覧」（全実委人に表示）

有効な企画を企画番号順にカードで並べ、各企画の登録値を表示する。

- 非表示の項目には「非表示」、修正の記録がある項目には「修正」のバッジを付ける。バッジにマウスを乗せると、操作した実委人と日時を表示する。
- 非表示のアイコン・掲載画像は、画像に「非表示」を重ねて表示する。
- `MAP_APP_SETTING_EDIT` を持つ実委人には、企画情報を登録済みの企画のカードに「非表示・修正」ボタンを表示し、押すと詳細ダイアログを開く。

### 9.2 詳細ダイアログ

項目ごとに次を並べる。

- 登録値
- 非表示・修正の状態と、操作した実委人・日時
- 操作
  - 非表示にする / 非表示を解除する
  - 修正する（入力欄を開き、保存で登録値を書き換える）
  - 掲載画像は1枚ごとに非表示・解除を切り替える

## 10. 企画側画面（`/project/public-info`）

入力欄の編集可否は編集可否設定だけで決まる。非表示・修正は項目に次の表示を加える。

| 状態 | バッジ | 注記 |
|------|------|------|
| 非表示 | 「非公開」 | この項目は実行委員会により非公開になっています。変更しても公開されません。詳しくはお問い合わせからご連絡ください。 |
| 修正 | 「実行委員会が修正」 | この項目は実行委員会が修正しました。 |

- 修正の表示は、企画がその項目を変えて保存すると消える。
- 掲載画像は、非表示の画像のサムネイルに「非公開」を重ねて表示する。
- 保存時は、画面を開いたときの値から変更した項目だけを送る。画面を開いている間に実委人が修正した項目を、開く前の値で上書きしないため。

## 11. API

### 11.1 実委側

`GET /committee/projects/public-infos` は実委人であれば呼べる。それ以外は `MAP_APP_SETTING_EDIT` が必要。

| メソッド | パス | 内容 |
|------|------|------|
| GET | `/committee/projects/public-infos` | 有効な企画の一覧（企画・登録値・非表示と修正の記録・掲載画像の非表示状態） |
| PUT | `/committee/public-info/:projectId/hidden/:field` | 項目を非表示にする |
| DELETE | `/committee/public-info/:projectId/hidden/:field` | 項目の非表示を解除する |
| PATCH | `/committee/public-info/:projectId` | 修正。body は `description` / `websiteUrls` / `xIds` / `instagramIds` / `youtubeIds` のうち変更する項目 |
| PUT | `/committee/public-info/:projectId/map-images/:fileId` | 掲載画像の非表示を切り替える。body: `{ isHidden: boolean }` |

- 非表示・修正の操作は、操作後の企画1件分を一覧と同じ形で返す。
- `:field` は `ProjectPublicInfoField` の値。
- 企画情報が未登録、または指定した画像がその企画の掲載画像でない場合は 404。

### 11.2 企画側

`GET /project/:projectId/public-info` のレスポンスに次を加える。

```ts
{
  publicInfo: ProjectPublicInfo | null; // 登録値
  hiddenFields: ProjectPublicInfoField[];
  correctedFields: ProjectPublicInfoField[];
  hiddenMapImageFileIds: string[];
}
```

`PUT /project/:projectId/public-info` は、送られてきた項目のうち値が登録値と異なるものについて、`CORRECTED` の記録を削除する。
