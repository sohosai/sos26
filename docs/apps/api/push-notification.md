# Push 通知（API 側）

本ドキュメントでは、API（Hono）側における
Web Push 通知の Subscription 管理および送信処理をまとめます。

---

## 1. API 側の役割

API 側の責務は以下です。

- Push Subscription を受け取り DB に保存する
- 対象ユーザーの Subscription を取得する
- Web Push 通知を送信する

---

## 2. 関連ファイル

- ルーティング
  - `apps/api/src/routes/push.ts`
- Push 送信処理
  - `apps/api/src/lib/push/send.ts`
  - `apps/api/src/lib/push/client.ts`
- 時刻変換ユーティリティ
  - `apps/api/src/lib/push/timeConvert.ts`
- Prisma schema
  - `apps/api/prisma/schema.prisma`
- 共通 schema
  - `packages/shared/src/schemas/push.ts`

---

## 3. Push Subscription 登録 API

### エンドポイント

`POST /push/subscribe`

---

### 処理概要

- リクエスト body を schema でバリデーション
- Subscription の `endpoint` を一意キーとして upsert
- 既存データがあれば更新、新規であれば作成
- `expirationTime` は DateTime に変換して保存

---

### 保存される主な情報

- userId
- endpoint
- p256dh
- auth
- isActive
- expiresAt

---

## 4. Push 通知送信 API

### エンドポイント

`POST /push/send`

---

### 処理フロー

1. userId 配列と payload を受け取る
2. 対象ユーザーの有効な Subscription を取得
3. すべての Subscription に対して同時に送信処理を行う

送信処理は `sendPush()` を利用します。

---

### 補足仕様

- userId が空配列の場合は何もせず成功を返す
- Subscription が存在しない場合も成功を返す

---

## 5. Push Payload 定義

Push 通知の payload は shared schema で定義されています。

- title（必須）
- body（任意）

以上は最低限の内容であるため、その他の情報を付与することも可能。
詳しくは以下を参照
https://developer.mozilla.org/en-US/docs/Web/API/Notification/Notification

---

## 6. データベース設計

Subscription は `PushSubscription` テーブルで管理します。

- endpoint はユニーク
- user と 1:N の関係
- `isActive` で有効・無効を管理
- `expiresAt` で有効期限を管理可能
  - ただ、これを使用しないブラウザも存在する

---

## 7. 環境変数（API）

以下の環境変数が必要です。

`ADMIN_MAIL=mailto:admin@example.com`
`VAPID_PUBLIC_KEY=xxxxxxxxxxxxxxxxxxxx`
`VAPID_PRIVATE_KEY=xxxxxxxxxxxxxxxxxxxx`
`PUSH_SEND_BATCH_SIZE=50`

- ADMIN_MAIL
  - Push Service が問題発生時に使用する連絡先
- VAPID_PUBLIC_KEY
  - Web 側に配布する公開鍵
- VAPID_PRIVATE_KEY
  - API 側のみで保持する秘密鍵
- PUSH_SEND_BATCH_SIZE
	- PUSH通知同時送信のバッチサイズ

VAPID_PUBLIC_KEYとVAPID_PRIVATE_KEYは
`bun web-push generate-vapid-keys`で作成。
