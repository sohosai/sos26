/**
 * マルチパートアップロードのチャンクサイズ（5MB = S3 の最小パートサイズ）。
 */
export const MULTIPART_CHUNK_SIZE = 5 * 1024 * 1024;

/**
 * このファイルサイズを超えたらマルチパートアップロードを使う。
 */
export const MULTIPART_THRESHOLD = MULTIPART_CHUNK_SIZE;

/**
 * ファイルサイズに応じてマルチパートアップロードを使うべきか判定する。
 */
export function shouldUseMultipart(fileSize: number): boolean {
	return fileSize > MULTIPART_THRESHOLD;
}
