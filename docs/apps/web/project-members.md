# 企画メンバー管理（Project Members）

このドキュメントは、`feat/add-member-pages` 系の変更で追加・整理された「企画メンバー管理」の仕様と実装方針をまとめたものです。

対象範囲:

- Web の画面/ルーティング（`/project/*`）
- API の企画メンバー関連エンドポイント（`/project/*`）
- Shared のスキーマ/エンドポイント定義

---

## 目次

- [概要](#概要)
- [画面仕様（Web）](#画面仕様web)
  - [ルーティング構成](#ルーティング構成)
  - [ProjectContext と選択企画](#projectcontext-と選択企画)
  - [メンバー一覧ページ](#メンバー一覧ページ)
  - [招待ダイアログ](#招待ダイアログ)
- [権限制御](#権限制御)
- [API 仕様（要点）](#api-仕様要点)
  - [一覧取得](#一覧取得)
  - [削除](#削除)
  - [副責任者任命](#副責任者任命)
  - [招待コード再生成](#招待コード再生成)
- [役職と制約](#役職と制約)
- [データ整合性（DB）](#データ整合性db)
- [実装メモ（運用時の注意）](#実装メモ運用時の注意)

---

## 概要

このブランチでは、企画参加者の運用に必要な以下の機能が整備されています。

1. 企画メンバー一覧の表示
2. 招待コードによる参加導線
3. メンバー削除（責任者/副責任者）
4. 副責任者の任命（責任者のみ）
5. 招待コード再生成（責任者のみ）
6. 選択中の企画を Context で保持

---

## 画面仕様（Web）

### ルーティング構成

企画領域は `/project` 配下に集約され、サイドバーの「メンバー管理」は `/project/members` に遷移します。

- `/project` : 企画トップ
- `/project/members` : メンバー管理

### ProjectContext と選択企画

`/project` レイアウトで `listMyProjects()` をロードし、`selectedProjectId` を state で管理した上で、選択中の企画を`ProjectContext` で子ルートに配布します。※親ルートでは使用できないので注意

- 画面側は `ProjectContext` から現在の企画を参照
- API 呼び出し時のみ `project.id` を使う
- ルート自体はシンプルな固定パスを維持

ex.
```tsx
import { useContext } from "react";
import { ProjectContext } from "@/lib/project/context";

const project = useContext(ProjectContext);
console.log(project);
```
```json
{
    "id": "cmlpxonsd0001wq4cmv09ngvu",
    "name": "パン",
    "namePhonetic": "ぱん",
    "organizationName": "Conakry",
    "organizationNamePhonetic": "こなくり",
    "type": "STAGE",
    "ownerId": "cmljhypuc0001v77wm394twuq",
    "subOwnerId": "cmlq7pbzi0007wq4cz1ca1713",
    "inviteCode": "XS5Q0H",
    "createdAt": "2026-02-17T01:37:51.460Z",
    "updatedAt": "2026-02-17T07:00:00.725Z",
    "deletedAt": null
}
```
### メンバー一覧ページ

`/project/members` は以下を表示します。

- 名前
- メールアドレス
- 役職タグ（責任者/副責任者/メンバー）
- 参加日
- （権限がある場合のみ）メンバー操作ボタン

メンバー操作のルール:

- OWNER の行にはアクションなし（ボタンも配置しない）
- SUB_OWNER が未設定のときのみ「副責任者に指名」を MEMBER の行に表示
- MEMBER 行には「削除」を表示

また、現在ユーザーが `owner` または `subOwner` の企画であれば、一番左の列にメンバー操作ボタンが表示されます。一般メンバーは閲覧のみで操作はできません。

### 招待ダイアログ

「メンバーを追加」ボタンから招待ダイアログを開き、招待コードを表示・コピーできます。

- コピーはクリップボードへ書き込み
- 責任者のみ「再生成」ボタンを表示
- 再生成時は確認ダイアログを出したうえで API 実行

---



