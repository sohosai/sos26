import { randomUUID } from "node:crypto";

/**
 * MIMEタイプから拡張子を取得する。
 * 対応するMIMEタイプがない場合は "bin" を返す。
 */
export function getExtension(mimeType: string): string {
	const map: Record<string, string> = {
		"image/jpeg": "jpg",
		"image/png": "png",
		"image/gif": "gif",
		"image/webp": "webp",
		"application/pdf": "pdf",
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document":
			"docx",
		"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
	};
	return map[mimeType] ?? "bin";
}

/**
 * S3オブジェクトキーを生成する。
 * 形式: {userId}/{uuid}.{ext}
 */
export function generateObjectKey(userId: string, mimeType: string): string {
	const ext = getExtension(mimeType);
	const uuid = randomUUID();
	return `${userId}/${uuid}.${ext}`;
}
