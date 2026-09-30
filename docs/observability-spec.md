# 分散トレーシング（OpenTelemetry + New Relic）仕様書

## 1. 目的

本番環境のレスポンス遅延について、「どのエンドポイントの、どのクエリ／どの外部呼び出しに何ミリ秒かかっているか」をコードを変更せずに事後分析できるようにする。

## 2. 背景

| 項目 | 現状 |
|------|------|
| API ランタイム | Bun 1.2.10 上の Hono（`Bun.serve`） |
| 既存 APM | Sentry（`@sentry/bun` / `@sentry/react`） |
| DB | Prisma 6 + PostgreSQL（`apps/api/src/lib/prisma.ts` に集約） |
| デプロイ環境 | `dev` / `zoo` / `prod` の3面（ローカル・未設定時は `development`） |

Sentry のパフォーマンス計測は導入済みだが、Bun 上では自動計装が効かず、DB クエリや外部 API 呼び出しの内訳が取得できない。「遅い」という観測はできても原因の切り分けができない状態。

## 3. 設計上の制約

- **Bun では Node 向けの自動計装（`@opentelemetry/auto-instrumentations-node`）が動作しない**。`require-in-the-middle` によるモジュールパッチに依存しており、Bun のモジュール解決系では安定しないため。Hono on Bun も `node:http` ではなく `Bun.serve` 上で動くため、そもそもサーバスパンを自動計装で取れない。
  → 自動計装に頼らず、ミドルウェア＋手動スパンで明示的に計装する。
- OpenTelemetry Collector は導入せず、アプリケーションから New Relic（`https://otlp.nr-data.net`）へ直接送信する。
- Sentry と同一プロセス上で共存させる必要がある。`Sentry.init()` は OpenTelemetry のグローバル TracerProvider を先に占有するため、素朴に共存させるとスパンが1件も New Relic に届かない。New Relic 有効時（`NEW_RELIC_LICENSE_KEY` 設定時）のみ `skipOpenTelemetrySetup: true` を指定することで回避する（`Sentry.captureException()` によるエラー収集は維持されるが、Sentry 側のパフォーマンス計測は失われる＝実質エラー収集専用になる）。New Relic 未使用の環境（ローカル開発など）では skip せず、Sentry 単体のパフォーマンス計測を維持する。

## 4. アーキテクチャ

```
apps/api/src/otel.ts     ← index.ts の先頭で import（Sentry.init() の直後）
  ├ Resource         : service.name / service.version / deployment.environment.name
  ├ ContextManager   : AsyncLocalStorageContextManager
  ├ SpanProcessor    : BatchSpanProcessor（非同期バッチ送信）
  └ SpanExporter     : SanitizingExporter（属性サニタイズ）で OTLPTraceExporter をラップ
```

```
GET /project/:projectId/forms          (HTTPサーバスパン: @hono/otel)
├─ firebase.verifyIdToken              (手動スパン)
├─ prisma:query Form.findMany          (Prisma自動計装)
├─ prisma:query FormAnswer.findMany
└─ s3.getSignedUrl                     (手動スパン)
```

| 計装対象 | 手段 |
|---------|------|
| HTTP サーバスパン | `@hono/otel` ミドルウェア（ルートパターン化されたスパン名を生成、パスパラメータは含めない） |
| DB スパン | `@prisma/instrumentation` |
| 外部 I/O（S3・SendGrid・Web Push・Firebase） | `lib/storage` `lib/emails` `lib/push` `lib/firebase.ts` の各境界に手動スパンを付与 |
| エラー記録 | 予期しない例外は `@hono/otel` が `c.error` とレスポンスステータス（500）を見てアクティブスパンを自動で `ERROR` にする。`AppError` / `ZodError` などの業務上想定内のエラーは `error-handler.ts` が `c.error` をクリアすることで対象外とする（正常系の一部のため） |

## 5. セキュリティ

以下をスパン属性に含めない。

- 認証情報（`Authorization` ヘッダ、ID トークン、API キー、署名付き URL の署名部分）
- リクエスト／レスポンスボディ、個人情報（メールアドレス・氏名）
- データベースクエリのバインド値（SQL の文構造のみ記録）

`apps/api/src/routes/files.ts` はアクセストークンをクエリパラメータ `token` で受け取る。`@hono/otel` は既定でクエリ文字列を含む URL をそのまま `url.full` に記録するため、対処しなければファイルアクセストークンが New Relic に送信されてしまう。`SpanExporter.export()` に渡される直前で `attributes` を書き換え、クエリ文字列を除去する（`SpanProcessor.onEnd()` 側での書き換えは `span.end()` 後に無効化されるため機能しない）。

送信失敗・送信先への疎通不能はリクエスト処理に影響させない（エクスポータ内で破棄）。テレメトリ送信はリクエスト処理と同期させない。

## 6. 環境変数

すべて任意。`NEW_RELIC_LICENSE_KEY` が未設定の場合、計装は初期化されず、外部送信も初期化コストも一切発生しない（ローカル開発・CI・テストではこの状態になる）。

| 変数名 | 説明 | デフォルト値 |
|--------|------|-------------|
| `NEW_RELIC_LICENSE_KEY` | New Relic のライセンスキー。設定時のみ計装が有効化される | なし |
| `OTEL_SERVICE_NAME` | サービス識別子 | `sos26-api` |
| `OTEL_SERVICE_VERSION` | デプロイされたコードの git SHA | `unknown` |
| `OTEL_DEPLOYMENT_ENVIRONMENT` | `dev` / `zoo` / `prod` | `development` |
| `OTEL_TRACES_SAMPLER_ARG` | サンプリング率（0.0〜1.0） | `1.0` |

`NEW_RELIC_LICENSE_KEY` は GitHub Secrets 経由で注入し、リポジトリ・イメージには含めない。

## 7. 受け入れ基準

- DB アクセスを伴うエンドポイントへリクエストすると、ルートパターン名のスパンの子として DB クエリのスパンが記録され、ウォーターフォールとして遅延内訳が確認できる
- 予期しない例外が発生したリクエストは span status = `ERROR` として記録される
- dev/prod いずれのスパンにも `service.name` / `service.version`（git SHA） / `deployment.environment.name` が正しく付与される（`development` にならない）
- `NEW_RELIC_LICENSE_KEY` 未設定時は外部送信が一切発生せず、起動・応答は従来どおり成功し `bun run test:run` が通る
- 送信先へ疎通できない状態でもリクエストは正常に処理される
- スパン属性に認証トークン・リクエストボディ・メールアドレス・クエリパラメータ値が含まれない

## 8. 参考リンク

- [New Relic OTLP endpoint](https://docs.newrelic.com/docs/opentelemetry/best-practices/opentelemetry-otlp/)
- [New Relic OTLP troubleshooting](https://docs.newrelic.com/docs/opentelemetry/best-practices/opentelemetry-otlp-troubleshooting/)
- [`@hono/otel`](https://www.npmjs.com/package/@hono/otel)
- [Bun: Native OpenTelemetry tracing (PR #39965)](https://github.com/oven-sh/bun/pull/39965)
- [Sentry: Using Your Existing OpenTelemetry Setup (Bun)](https://docs.sentry.io/platforms/javascript/guides/bun/opentelemetry/custom-setup/)
