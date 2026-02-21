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
