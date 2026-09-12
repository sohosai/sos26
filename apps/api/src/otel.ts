import { context, trace } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { resourceFromAttributes } from "@opentelemetry/resources";
import type { ReadableSpan, SpanExporter } from "@opentelemetry/sdk-trace-base";
import {
	BasicTracerProvider,
	BatchSpanProcessor,
	TraceIdRatioBasedSampler,
} from "@opentelemetry/sdk-trace-base";
import { PrismaInstrumentation } from "@prisma/instrumentation";
import { env } from "./lib/env";

/**
 * 分散トレーシング（OpenTelemetry + New Relic）の初期化
 *
 * 詳細な設計・検証結果は docs/observability-spec.md を参照。
 *
 * - NEW_RELIC_LICENSE_KEY が未設定の場合、計装は初期化しない（OTEL-006）。
 * - Bun は Node の自動計装（モジュールパッチ方式）が使えないため、
 *   HTTP サーバスパンは @hono/otel ミドルウェア、DB スパンは
 *   @prisma/instrumentation による明示的計装で構成する（C-01）。
 * - Sentry (@sentry/bun) は内部で OpenTelemetry のグローバル状態を
 *   占有するため、Sentry.init() 側で skipOpenTelemetrySetup: true を
 *   指定した上で、この初期化を Sentry の初期化後に行うこと（C-04）。
 */

/**
 * New Relic へ送信する直前に、スパン属性からクエリ文字列を除去する SpanExporter ラッパー
 *
 * OTEL-105: files ルートはアクセストークンをクエリパラメータ `token` で受け取るため、
 * @hono/otel が付与する `url.full` をそのまま送信するとトークンが外部に流出する。
 *
 * SpanProcessor.onEnd() 内での Span.setAttribute() は、スパン終了後は
 * isRecording() が false になるため無効化される（サイレントに無視される）。
 * そのため SpanProcessor ではなく、実際の送信直前である SpanExporter.export() で
 * ReadableSpan.attributes（plain object）を直接書き換える（docs/observability-spec.md §5）。
 */
export function withUrlQuerySanitizer(delegate: SpanExporter): SpanExporter {
	return {
		export(spans: ReadableSpan[], resultCallback) {
			for (const span of spans) {
				const url = span.attributes["url.full"];
				if (typeof url === "string") {
					const queryIndex = url.indexOf("?");
					if (queryIndex !== -1) {
						(span.attributes as Record<string, unknown>)["url.full"] =
							url.slice(0, queryIndex);
					}
				}
			}
			delegate.export(spans, resultCallback);
		},
		shutdown: () => delegate.shutdown(),
		forceFlush: () => delegate.forceFlush?.() ?? Promise.resolve(),
	};
}

let provider: BasicTracerProvider | undefined;

if (env.NEW_RELIC_LICENSE_KEY) {
	const resource = resourceFromAttributes({
		"service.name": env.OTEL_SERVICE_NAME,
		"service.version": env.OTEL_SERVICE_VERSION,
		"deployment.environment.name": env.OTEL_DEPLOYMENT_ENVIRONMENT,
	});

	const exporter = withUrlQuerySanitizer(
		new OTLPTraceExporter({
			url: "https://otlp.nr-data.net/v1/traces",
			headers: { "api-key": env.NEW_RELIC_LICENSE_KEY },
		})
	);

	const contextManager = new AsyncLocalStorageContextManager();
	contextManager.enable();
	context.setGlobalContextManager(contextManager);

	provider = new BasicTracerProvider({
		resource,
		sampler: new TraceIdRatioBasedSampler(env.OTEL_TRACES_SAMPLER_ARG),
		spanProcessors: [new BatchSpanProcessor(exporter)],
	});
	trace.setGlobalTracerProvider(provider);

	// OTEL-002: Prisma Client のトレーシングフックを有効化する。
	// lib/prisma.ts で PrismaClient がインスタンス化される前に登録する必要があるため、
	// otel.ts は index.ts の先頭（他のモジュールの import より前）で読み込むこと。
	registerInstrumentations({
		instrumentations: [new PrismaInstrumentation()],
		tracerProvider: provider,
	});
}

/**
 * 外部 I/O（OTEL-003）を計装するための Tracer
 *
 * NEW_RELIC_LICENSE_KEY 未設定時は no-op のスパンを返すため、
 * 呼び出し側で有効/無効を分岐する必要はない（OTEL-006）。
 */
export const tracer = trace.getTracer(env.OTEL_SERVICE_NAME);

/**
 * プロセス終了時にバッファ中のスパンを可能な範囲で送信する
 */
export async function shutdownOtel(): Promise<void> {
	await provider?.shutdown();
}
