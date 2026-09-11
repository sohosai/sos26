import { S3Client } from "@aws-sdk/client-s3";
import { SpanStatusCode } from "@opentelemetry/api";
import { tracer } from "../../otel";
import { env } from "../env";

let client: S3Client | null = null;

/**
 * S3互換ストレージクライアントの初期化。
 * アプリ起動時に1回だけ呼ばれることを想定。
 */
export function initStorage() {
	if (client) return;

	// env.S3_ENDPOINT はスキームを補完済みの完全なURL（env スキーマ側で正規化）
	client = new S3Client({
		endpoint: env.S3_ENDPOINT,
		region: env.S3_REGION,
		credentials: {
			accessKeyId: env.S3_ACCESS_KEY_ID,
			secretAccessKey: env.S3_SECRET_ACCESS_KEY,
		},
		forcePathStyle: true,
	});

	// OTEL-003: S3 互換オブジェクトストレージへの呼び出しを計装する。
	// SDK の middleware stack に一度だけ登録することで、presign.ts / multipart.ts など
	// 個々の呼び出し箇所を変更せずに全操作をスパンとして記録できる。
	client.middlewareStack.add(
		(next, context) => async args => {
			const commandName = context.commandName ?? "S3Command";
			return tracer.startActiveSpan(`s3.${commandName}`, async span => {
				try {
					return await next(args);
				} catch (e) {
					span.recordException(e as Error);
					span.setStatus({ code: SpanStatusCode.ERROR });
					throw e;
				} finally {
					span.end();
				}
			});
		},
		{ step: "initialize", name: "otelTracingMiddleware" }
	);
}

/**
 * 初期化済みの S3Client を取得する。
 * initStorage() を先に呼び出す必要がある。
 */
export function getStorageClient(): S3Client {
	if (!client) {
		throw new Error(
			"Storage client is not initialized. Call initStorage() first."
		);
	}
	return client;
}
