import { z } from "zod";

/**
 * ファイルステータス
 */
export const fileStatusSchema = z.enum(["PENDING", "CONFIRMED"]);
export type FileStatus = z.infer<typeof fileStatusSchema>;

/**
 * 許可されたMIMEタイプ
 */
export const allowedMimeTypes = [
	// 画像
	"image/jpeg",
	"image/png",
	"image/gif",
	"image/webp",
	// 文書
	"application/pdf",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	// 動画
	"video/mp4",
	"video/quicktime",
] as const;

export const mimeTypeSchema = z.enum(allowedMimeTypes);
export type AllowedMimeType = z.infer<typeof mimeTypeSchema>;

/** MIMEタイプ → 表示名のマップ */
export const mimeTypeLabels: Record<AllowedMimeType, string> = {
	"image/jpeg": "JPEG",
	"image/png": "PNG",
	"image/gif": "GIF",
	"image/webp": "WebP",
	"application/pdf": "PDF",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document":
		"DOCX",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
	"video/mp4": "MP4",
	"video/quicktime": "MOV",
};

/** HTML input accept 属性用の文字列 */
export const fileAcceptAttribute = allowedMimeTypes.join(",");

/** 人間が読めるファイル形式一覧 */
export const allowedFileExtensions =
	"JPEG, PNG, GIF, WebP, PDF, DOCX, XLSX, MP4, MOV";

/** 拡張子から許可された MIME タイプを推定するフォールバック */
export function inferMimeTypeFromFileName(
	fileName: string
): AllowedMimeType | null {
	const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
	switch (ext) {
		case "jpg":
		case "jpeg":
			return "image/jpeg";
		case "png":
			return "image/png";
		case "gif":
			return "image/gif";
		case "webp":
			return "image/webp";
		case "pdf":
			return "application/pdf";
		case "docx":
			return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
		case "xlsx":
			return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
		case "mp4":
			return "video/mp4";
		case "mov":
			return "video/quicktime";
		default:
			return null;
	}
}

/** ファイルの実効 MIME タイプを取得（ブラウザ type 空文字時は拡張子でフォールバック） */
export function resolveFileMimeType(file: {
	name: string;
	type: string;
}): string {
	if (file.type && file.type !== "") return file.type;
	return inferMimeTypeFromFileName(file.name) ?? file.type;
}

/** ファイルが許可された MIME タイプか判定 */
export function isAllowedFileType(file: {
	name: string;
	type: string;
}): boolean {
	const effectiveType = resolveFileMimeType(file);
	return allowedMimeTypes.includes(effectiveType as AllowedMimeType);
}

/** 拡張子がブラウザストリーミング対応か判定（プレビュー用） */
export function isStreamable(ext: string): boolean {
	return ["mp4", "png", "jpg", "jpeg", "gif", "webp", "svg"].includes(
		ext.toLowerCase()
	);
}

/** 指定MIMEタイプ配列から accept 属性文字列を生成（未指定時は全許可） */
export function buildFileAcceptAttribute(
	mimeTypes?: AllowedMimeType[]
): string {
	if (!mimeTypes || mimeTypes.length === 0) return fileAcceptAttribute;
	return mimeTypes.join(",");
}

/** 指定MIMEタイプ配列から表示用ラベルを生成（未指定時は全形式） */
export function buildFileExtensionsLabel(
	mimeTypes?: AllowedMimeType[]
): string {
	if (!mimeTypes || mimeTypes.length === 0) return allowedFileExtensions;
	return mimeTypes.map(m => mimeTypeLabels[m]).join(", ");
}

/**
 * ファイル情報（レスポンス用）
 */
export const fileSchema = z.object({
	id: z.string(),
	fileName: z.string(),
	mimeType: z.string(),
	size: z.number(),
	isPublic: z.boolean(),
	status: fileStatusSchema,
	uploadedById: z.string(),
	createdAt: z.string(),
	updatedAt: z.string(),
});
export type FileInfo = z.infer<typeof fileSchema>;

/**
 * フォーム回答で返す実用的なファイル要約
 */
export const formAnswerFileSchema = fileSchema
	.pick({
		id: true,
		fileName: true,
		mimeType: true,
		size: true,
		isPublic: true,
		createdAt: true,
	})
	.extend({
		sortOrder: z.number().int().nonnegative(),
	});
export type FormAnswerFile = z.infer<typeof formAnswerFileSchema>;

/**
 * アップロードURL要求
 */
export const requestUploadUrlRequestSchema = z.object({
	fileName: z.string().min(1),
	mimeType: mimeTypeSchema,
	size: z.number().int().positive(),
	isPublic: z.boolean().default(false),
});
export type RequestUploadUrlRequest = z.infer<
	typeof requestUploadUrlRequestSchema
>;

/**
 * アップロードURL応答
 */
export const requestUploadUrlResponseSchema = z.object({
	fileId: z.string(),
	uploadUrl: z.string(),
	key: z.string(),
});
export type RequestUploadUrlResponse = z.infer<
	typeof requestUploadUrlResponseSchema
>;

/**
 * アップロード確認応答
 */
export const confirmUploadResponseSchema = z.object({
	file: fileSchema,
});
export type ConfirmUploadResponse = z.infer<typeof confirmUploadResponseSchema>;

/**
 * マルチパートアップロード開始リクエスト
 */
export const initiateMultipartUploadRequestSchema = z.object({
	fileName: z.string().min(1),
	mimeType: mimeTypeSchema,
	size: z.number().int().positive(),
	isPublic: z.boolean().default(false),
	partCount: z.number().int().positive(),
});
export type InitiateMultipartUploadRequest = z.infer<
	typeof initiateMultipartUploadRequestSchema
>;

/**
 * マルチパートアップロード開始レスポンス
 */
export const initiateMultipartUploadResponseSchema = z.object({
	fileId: z.string(),
	uploadId: z.string(),
	partUrls: z.array(z.string()),
	key: z.string(),
});
export type InitiateMultipartUploadResponse = z.infer<
	typeof initiateMultipartUploadResponseSchema
>;

/**
 * マルチパートアップロード完了リクエスト
 */
export const completeMultipartUploadRequestSchema = z.object({
	fileId: z.string(),
	uploadId: z.string(),
});
export type CompleteMultipartUploadRequest = z.infer<
	typeof completeMultipartUploadRequestSchema
>;

/**
 * マルチパートアップロード完了レスポンス
 */
export const completeMultipartUploadResponseSchema =
	confirmUploadResponseSchema;
export type CompleteMultipartUploadResponse = z.infer<
	typeof completeMultipartUploadResponseSchema
>;

/**
 * マルチパートアップロード中止リクエスト
 */
export const abortMultipartUploadRequestSchema = z.object({
	fileId: z.string(),
	uploadId: z.string(),
});
export type AbortMultipartUploadRequest = z.infer<
	typeof abortMultipartUploadRequestSchema
>;

/**
 * マルチパートアップロード中止レスポンス
 */
export const abortMultipartUploadResponseSchema = z.object({
	success: z.literal(true),
});
export type AbortMultipartUploadResponse = z.infer<
	typeof abortMultipartUploadResponseSchema
>;

/**
 * ダウンロードURL応答
 */
export const requestDownloadUrlResponseSchema = z.object({
	downloadUrl: z.string(),
});
export type RequestDownloadUrlResponse = z.infer<
	typeof requestDownloadUrlResponseSchema
>;

/**
 * プレビューURL応答
 */
export const requestPreviewUrlResponseSchema = z.object({
	previewUrl: z.string(),
});
export type RequestPreviewUrlResponse = z.infer<
	typeof requestPreviewUrlResponseSchema
>;

/**
 * ファイル一覧応答
 */
export const listFilesResponseSchema = z.object({
	files: z.array(fileSchema),
});
export type ListFilesResponse = z.infer<typeof listFilesResponseSchema>;

/**
 * ファイル削除応答
 */
export const deleteFileResponseSchema = z.object({
	success: z.literal(true),
});
export type DeleteFileResponse = z.infer<typeof deleteFileResponseSchema>;

/**
 * ファイルトークン応答
 */
export const fileTokenResponseSchema = z.object({
	token: z.string(),
	expiresAt: z.string(),
});
export type FileTokenResponse = z.infer<typeof fileTokenResponseSchema>;
