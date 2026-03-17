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
};

/** HTML input accept 属性用の文字列 */
export const fileAcceptAttribute = allowedMimeTypes.join(",");

/** 人間が読めるファイル形式一覧 */
export const allowedFileExtensions = "JPEG, PNG, GIF, WebP, PDF, DOCX, XLSX";

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
