import { z } from "zod";

/**
 * ファイルステータス
 */
export const fileStatusSchema = z.enum(["PENDING", "CONFIRMED"]);
export type FileStatus = z.infer<typeof fileStatusSchema>;

/**
 * ファイル形式の一元定義
 *
 * mimeTypes[0] を canonical MIME タイプとし、残りをエイリアスとして扱う。
 * 新しいファイル形式を追加する際は、この配列に追加する。
 */
export const fileTypeRegistry = [
	{
		mimeTypes: ["image/jpeg"] as const,
		extensions: [".jpg", ".jpeg"] as const,
		label: "JPEG (JPG)",
	},
	{
		mimeTypes: ["image/png"] as const,
		extensions: [".png"] as const,
		label: "PNG",
	},
	{
		mimeTypes: ["image/gif"] as const,
		extensions: [".gif"] as const,
		label: "GIF",
	},
	{
		mimeTypes: ["image/webp"] as const,
		extensions: [".webp"] as const,
		label: "WebP",
	},
	{
		mimeTypes: ["application/pdf"] as const,
		extensions: [".pdf"] as const,
		label: "PDF",
	},
	{
		mimeTypes: [
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		] as const,
		extensions: [".docx"] as const,
		label: "DOCX",
	},
	{
		mimeTypes: [
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		] as const,
		extensions: [".xlsx"] as const,
		label: "XLSX",
	},
	{
		mimeTypes: ["video/mp4"] as const,
		extensions: [".mp4"] as const,
		label: "MP4",
	},
	{
		mimeTypes: ["video/quicktime"] as const,
		extensions: [".mov"] as const,
		label: "MOV",
	},
	{
		mimeTypes: ["audio/wav", "audio/x-wav"] as const,
		extensions: [".wav"] as const,
		label: "WAV",
	},
	{
		mimeTypes: ["audio/aiff", "audio/x-aiff"] as const,
		extensions: [".aiff", ".aif"] as const,
		label: "AIFF (AIF)",
	},
] as const;

export type FileTypeRegistryEntry = (typeof fileTypeRegistry)[number];

/**
 * 許可されたMIMEタイプ
 */
export const allowedMimeTypes = [
	...fileTypeRegistry.flatMap(f => f.mimeTypes),
] as const;

export const mimeTypeSchema = z.enum(allowedMimeTypes);
export type AllowedMimeType = z.infer<typeof mimeTypeSchema>;

/** ファイルの実効 MIME タイプを取得（ブラウザ type 空文字時は拡張子でフォールバック） */
export function resolveFileMimeType(file: {
	name: string;
	type: string;
}): string {
	if (file.type && file.type !== "") return file.type;

	const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
	const entry = fileTypeRegistry.find(entry =>
		entry.extensions.some(e => e.slice(1) === ext)
	);
	return (entry?.mimeTypes[0] as AllowedMimeType) ?? file.type;
}

/** ファイルが許可された MIME タイプか判定 */
export function isAllowedFileType(file: {
	name: string;
	type: string;
}): boolean {
	const effectiveType = resolveFileMimeType(file);
	return allowedMimeTypes.includes(effectiveType as AllowedMimeType);
}

/** MIME タイプが画像か判定 */
export function isImageMimeType(mimeType: string): boolean {
	return mimeType.startsWith("image/");
}

/** ファイルが画像として扱える MIME タイプか判定 */
export function isAllowedImageFile(file: {
	name: string;
	type: string;
}): boolean {
	return isImageMimeType(resolveFileMimeType(file));
}

/** 指定MIMEタイプ配列から accept 属性文字列を生成（未指定時は全許可） */
export function buildFileAcceptAttribute(
	mimeTypes?: readonly AllowedMimeType[]
): string {
	if (!mimeTypes || mimeTypes.length === 0) {
		mimeTypes = allowedMimeTypes;
	}

	const canonicalMimeTypes = [
		...new Set(
			mimeTypes.map(mime => {
				const entry = fileTypeRegistry.find(entry =>
					entry.mimeTypes.some(type => type === mime)
				);
				return (entry?.mimeTypes[0] ?? mime) as AllowedMimeType;
			})
		),
	];

	return canonicalMimeTypes
		.flatMap(mime => {
			const entry = fileTypeRegistry.find(entry => entry.mimeTypes[0] === mime);
			return entry ? [mime, ...entry.extensions] : [mime];
		})
		.join(",");
}

/** 指定MIMEタイプ配列から表示用ラベルを生成（未指定時は全形式） */
export function buildFileTypesLabel(mimeTypes?: AllowedMimeType[]): string {
	if (!mimeTypes || mimeTypes.length === 0) {
		return fileTypeRegistry.map(f => f.label).join(", ");
	}

	const canonicalMimeTypes = [
		...new Set(
			mimeTypes.map(mime => {
				const entry = fileTypeRegistry.find(entry =>
					entry.mimeTypes.some(type => type === mime)
				);
				return (entry?.mimeTypes[0] ?? mime) as AllowedMimeType;
			})
		),
	];

	return canonicalMimeTypes
		.map(mime => {
			const entry = fileTypeRegistry.find(entry => entry.mimeTypes[0] === mime);
			return entry?.label ?? mime;
		})
		.join(", ");
}

/** 拡張子がブラウザストリーミング対応か判定（プレビュー用） */
export function isStreamable(ext: string): boolean {
	return ["mp4", "png", "jpg", "jpeg", "gif", "webp", "svg", "wav"].includes(
		ext.toLowerCase()
	);
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
