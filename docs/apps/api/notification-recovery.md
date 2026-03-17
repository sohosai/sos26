# 配信通知の同期（内部エンドポイント運用）

予約配信される申請・お知らせは、承認時ではなく配信時刻到達時に企画側へ表示されます。
このタイミングは通常の承認API呼び出しと分離されるため、通知（メール / Push）の送信漏れを防ぐために内部同期エンドポイントを定期実行します。

## 対象

以下の「配信済みだが通知未送信」のレコードを対象に通知を送信します。

- 申請
  - `FormAuthorization.status = APPROVED`
  - `scheduledSendAt <= now`
  - `deliveryNotifiedAt IS NULL`
- お知らせ
  - `NoticeAuthorization.status = APPROVED`
  - `deliveredAt <= now`
  - `deliveryNotifiedAt IS NULL`

## エンドポイント

- Method: `POST`
- Path: `/internal/notifications/sync`
- Header: `x-notification-password: <NOTIFICATION_SYNC_PASSWORD>`

成功時レスポンス例:

```json
{
  "success": true,
  "notified": {
    "forms": 2,
    "notices": 1
  },
  "pending": {
    "forms": 0,
    "notices": 0
  }
}
```

## 動作

1. 通知未送信の承認済み配信を検索
2. 配信対象企画を解決
   - `INDIVIDUAL`: 既存 Delivery を使用
   - `CATEGORY`: フィルタ条件で企画を再評価
3. Delivery レコードを不足分だけ作成（`createMany + skipDuplicates`）
4. 企画メンバー（責任者 / 副責任者 / 一般メンバー）へメール・Pushを送信
5. 成功した Authorization の `deliveryNotifiedAt` を更新

## 設定

`apps/api/.env` に以下を設定します。

```env
NOTIFICATION_SYNC_PASSWORD=change-this-to-a-long-random-string
```

## 実行例

```bash
curl -X POST "https://api.example.com/internal/notifications/sync" \
  -H "x-notification-password: ${NOTIFICATION_SYNC_PASSWORD}"
```

## 定期実行（例）

以下のいずれかで 1〜5 分間隔の実行を推奨します。

- GitHub Actions schedule
- Cloud Scheduler / EventBridge / cron
- 監視基盤からの定期HTTP呼び出し

例（cron）:

```cron
*/3 * * * * curl -fsS -X POST "https://api.example.com/internal/notifications/sync" -H "x-notification-password: ${NOTIFICATION_SYNC_PASSWORD}" >/dev/null
```

## 注意事項

- 本エンドポイントは内部運用専用です。
- パスワードは十分長いランダム文字列を使用し、定期的にローテーションしてください。
- パスワード不一致時は `401 UNAUTHORIZED` を返します。
