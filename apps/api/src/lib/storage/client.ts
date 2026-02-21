import { S3Client } from "@aws-sdk/client-s3";
import { env } from "../env";

let client: S3Client | null = null;

/**
 * S3互換ストレージクライアントの初期化。
 * アプリ起動時に1回だけ呼ばれることを想定。
 */
export function initStorage() {
	if (client) return;

	client = new S3Client({
		endpoint: env.S3_ENDPOINT,
		region: env.S3_REGION,
		credentials: {
			accessKeyId: env.S3_ACCESS_KEY_ID,
			secretAccessKey: env.S3_SECRET_ACCESS_KEY,
		},
		forcePathStyle: true,
	});
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
