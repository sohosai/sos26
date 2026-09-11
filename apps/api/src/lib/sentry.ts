import * as Sentry from "@sentry/bun";
import { env } from "./env";

if (env.SENTRY_DSN) {
	Sentry.init({
		dsn: env.SENTRY_DSN,
		environment: env.SENTRY_ENVIRONMENT,
		tracesSampleRate: 1.0,
		// OpenTelemetry (New Relic 向け) のグローバル TracerProvider / ContextManager と
		// 同一プロセスで共存させるための設定。
		// Sentry は内部で OpenTelemetry を使用しており、これを指定しない場合
		// Sentry が先にグローバル状態を占有し、後続の ../otel.ts での登録が
		// 例外を出さずに黙って無視される（New Relic へスパンが一切送信されなくなる）。
		// 詳細: docs/observability-spec.md C-04, §11.2
		skipOpenTelemetrySetup: true,
	});
}
