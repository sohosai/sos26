# Push 通知（API 側）

本ドキュメントでは、API（Hono）側における
Web Push 通知の Subscription 管理および送信処理をまとめます。

---
## 1. 関連ファイル

- ルーティング
  - `apps/api/src/routes/push.ts`
- Push 送信実装
  - `apps/api/src/lib/push/send.ts`
  - `apps/api/src/lib/push/client.ts`
- Push ユースケース
  - `apps/api/src/lib/push/usecases/*`
- Prisma schema
  - `apps/api/prisma/schema.prisma`
- 共通 endpoint / schema
  - `packages/shared/src/endpoints/push.ts`
  - `packages/shared/src/schemas/push.ts`

---

## 2. API 一覧

### `POST /push/subscribe`

- 認証: 必須（`requireAuth`）
- 入力: `subscription`（endpoint, keys, expirationTime）
- 処理:
  - `endpoint` をキーに `PushSubscription` を upsert
  - `UserPushSubscription` を upsert してユーザーと紐付け
  - 再登録時は `deletedAt` を `null` に戻す

### `POST /push/unsubscribe`

- 認証: 必須（`requireAuth`）
- 入力: `endpoint`
- 処理:
  - 対象 `endpoint` のユーザー紐付けを削除
  - その `PushSubscription` を参照するユーザーが 0 件なら
    `PushSubscription.deletedAt` を設定（論理削除）

### `POST /push/send`

- 認証: 必須（`requireAuth`）
- 入力: `users[]`, `payload`
- 処理:
  - `deletedAt = null` の購読のみ取得
  - バッチ単位で送信
  - `404 / 410` や期限切れを検知した購読を `deletedAt` で無効化


---

## 3. Push Payload 定義

- 必須
  - `title`
- 主な任意項目
  - `body`
  - `icon`, `badge`, `image`
  - `lang`, `tag`, `dir`
  - `renotify`, `requireInteraction`, `silent`
  - `timestamp`, `vibrate`
  - `actions`（最大2件）
  - `data`（任意の追加情報。例: `url`）

`/push/send` は上記の payload をそのまま push service に渡し、
Service Worker 側で `showNotification()` の options として利用します。

---

## 4. データベース設計

Subscription は `PushSubscription` テーブル、`UserPushSubscription`テーブル（中間テーブル）で管理します。

- endpoint は端末ごと、ブラウザごとにユニークな値
- user と N:N の関係
	- 同じ端末での複数アカウントでのログインに対応するため
- `isActive` で有効・無効を管理
- `expiresAt` で有効期限を管理可能
  - ただ、これを使用しないブラウザも存在する

---

## 5. 環境変数（API）

以下の環境変数が必要です。

`ADMIN_MAIL=admin@example.com`
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
