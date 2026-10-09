import { randomUUID } from "node:crypto";
import { fileTypeRegistry } from "@sos26/shared";

/**
 * MIMEタイプから拡張子を取得する。
 * 対応するMIMEタイプがない場合は "bin" を返す。
 */
export function getExtension(mimeType: string): string {
	const entry = fileTypeRegistry.find(entry =>
		entry.mimeTypes.some(type => type === mimeType)
	);
	return entry?.extensions[0].slice(1) ?? "bin";
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
