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

## 2. 関連ファイル

- Service Worker
  - `apps/web/public/sw.js`
- Push API クライアント
  - `apps/web/src/lib/api/push.ts`
- テスト UI
  - `apps/web/src/routes/pushNotification/index.tsx`

---

## 3. Push 通知の有効化フロー

### 3.1 Service Worker の登録

Service Worker は以下のように登録します。

`navigator.serviceWorker.register("/sw.js")`

---

### 3.2 Push Subscription の生成

Service Worker 登録後、Push Subscription を生成します。

```ts
registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: env.VITE_VAPID_PUBLIC_KEY })
```

- `applicationServerKey` には VAPID 公開鍵を指定します
- 初回はブラウザの通知許可ダイアログが表示されます

---

### 3.3 Subscription を API に送信

生成した Subscription は API の `/push/subscribe` に送信します。

`callBodyApi(pushSubscribeEndpoint, { userId, subscription })`

- Subscription は `subscription.toJSON()` したものを送信します
- DB への保存処理は API 側で行われます

---

## 4. Push API クライアント

Push 通知関連の API 呼び出しは
`apps/web/src/lib/api/push.ts` にまとめています。

- `enablePush(userId)`
  - Service Worker を登録
  - Push Subscription を生成
  - `/push/subscribe` API を呼び出す
- `sendPush(param)`
  - `/push/send` API を呼び出す（主にテスト用）

---

## 5. Service Worker の通知表示

Service Worker では `push` イベントを受け取り、
payload の内容をもとに通知を表示します。

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
