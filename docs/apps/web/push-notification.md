# Push 通知（Web 側）

本ドキュメントでは、ブラウザ（Web）側における
Web Push 通知の登録および送信テストの実装概要をまとめます。

---

## 1. Web 側の役割

Web 側の責務は以下です。

- Service Worker を登録する
- Push Subscription を生成する
- Subscription を API に送信する
- （開発用）Push 通知送信 API を呼び出す

---

## 1. 関連ファイル

- Push API クライアント
  - `apps/web/src/lib/api/push.ts`
- Push 許可・ローカル状態管理
  - `apps/web/src/lib/push.ts`
- 設定画面（通知 ON/OFF）
  - `apps/web/src/routes/settings/index.tsx`
- Service Worker
  - `apps/web/public/sw.js`
---
## 2. 通知許可（Permission）

通知許可は `Notification.permission` を参照します。

- `granted`: 通知可能
- `denied`: ユーザーに拒否されている
- `default`: 未選択（ダイアログ表示可能）

実装上の注意:

- ブラウザの仕様上、アプリコードから `denied` を解除することはできません。
- そのため「通知 OFF」は、許可状態の変更ではなく **購読解除（unsubscribe）** と
  **サーバー登録解除** で実現します。

---

## 3. Push ON フロー

`enablePush()`（`apps/web/src/lib/api/push.ts`）で次を実施します。

1. `navigator.serviceWorker.register("/sw.js")`
2. `registration.pushManager.subscribe(...)`
3. `subscription.toJSON()` を `/push/subscribe` に送信

送信 payload は共通 schema（`@sos26/shared`）を使います。
subscribe時には、VAPID 公開鍵がひつようです。
---

## 4. Push OFF フロー

`disablePush()`（`apps/web/src/lib/api/push.ts`）で次を実施します。

1. `pushManager.getSubscription()` で現在購読を取得
2. `subscription.unsubscribe()` を実行
3. `subscription.endpoint` を `/push/unsubscribe` に送信

この順により、ブラウザ側・サーバー側の両方で通知停止を同期します。


---

## 5. 設定画面の挙動

`/settings` のトグルでは:

- ON
  - 許可確認 → 購読 → ローカル状態更新
- OFF
  - 購読解除 API 呼び出し → ローカル状態更新
  - 同期失敗時は warning toast を表示


---

## 6. Service Worker の通知表示
`apps/web/public/sw.js` では `push` イベントを受けて
`self.registration.showNotification(...)` を呼び出します。

- `data.title` を通知タイトルとして使用
- `data.body` を通知本文として使用

通知表示は `self.registration.showNotification()` を利用します。

---

## 6. 開発用テスト UI

`/pushNotification` ルートにテスト用 UI があります。

- ① Push通知を有効化
  - Push Subscription の登録を行う
- ② 通知内容入力
  - title / body を入力
- ③ 通知送信
  - API 経由で自分自身に通知を送信

---

## 7. 環境変数（Web）

以下の環境変数が必要です。

`VITE_VAPID_PUBLIC_KEY=xxxxxxxxxxxxxxxxxxxx`

- API 側で生成した VAPID 公開鍵を設定してください
