import { z } from "zod";

export const openStatusSchema = z.enum(["OPEN", "CLOSED", "NOT_APPLICABLE"]);
export type OpenStatus = z.infer<typeof openStatusSchema>;

export const stockStatusSchema = z.enum([
	"IN_STOCK",
	"OUT_OF_STOCK",
	"NOT_APPLICABLE",
]);
export type StockStatus = z.infer<typeof stockStatusSchema>;

/**
 * 紹介文の最大文字数
 *
 * Prisma スキーマの `ProjectPublicInfo.description` の VarChar と必ず一致させること。
 */
export const PROJECT_DESCRIPTION_MAX_LENGTH = 200;

/** 掲載画像の最大枚数 */
export const PROJECT_MAP_IMAGES_MAX_COUNT = 10;

/**
 * SNSリンクの最大文字数
 *
 * Prisma スキーマの `ProjectPublicInfo` の各URL列の VarChar と必ず一致させること。
 */
export const PROJECT_SNS_URL_MAX_LENGTH = 2048;

/** 企画情報として収集するSNSリンクの項目 */
export const projectSnsLinkKeys = [
	"websiteUrl",
	"xUrl",
	"instagramUrl",
	"youtubeUrl",
] as const;
export type ProjectSnsLinkKey = (typeof projectSnsLinkKeys)[number];

// 公開APIからそのままリンクとして配信されるため、javascript: などを弾く
export const projectSnsUrlSchema = z
	.url({
		protocol: /^https?$/,
		error: "http(s) から始まるURLを入力してください",
	})
	.max(PROJECT_SNS_URL_MAX_LENGTH);

// 空文字は「未設定に戻す」を意味する
const updateSnsUrlSchema = z
	.union([z.literal(""), projectSnsUrlSchema])
	.nullable()
	.optional();

export const projectPublicInfoSchema = z.object({
	description: z.string().max(PROJECT_DESCRIPTION_MAX_LENGTH).nullable(),
	iconFileId: z.string().nullable(),
	mapImageFileIds: z.array(z.string()).max(PROJECT_MAP_IMAGES_MAX_COUNT),
	websiteUrl: projectSnsUrlSchema.nullable(),
	xUrl: projectSnsUrlSchema.nullable(),
	instagramUrl: projectSnsUrlSchema.nullable(),
	youtubeUrl: projectSnsUrlSchema.nullable(),
	openStatus: openStatusSchema,
	stockStatus: stockStatusSchema,
});

export type ProjectPublicInfo = z.infer<typeof projectPublicInfoSchema>;

// GET /project/:projectId/public-info
export const getProjectPublicInfoResponseSchema = z.object({
	publicInfo: projectPublicInfoSchema.nullable(),
});
export type GetProjectPublicInfoResponse = z.infer<
	typeof getProjectPublicInfoResponseSchema
>;

// PUT /project/:projectId/public-info
export const updateProjectPublicInfoRequestSchema = z.object({
	description: z
		.string()
		.max(PROJECT_DESCRIPTION_MAX_LENGTH)
		.nullable()
		.optional(),
	iconFileId: z.string().nullable().optional(),
	mapImageFileIds: z
		.array(z.string())
		.max(PROJECT_MAP_IMAGES_MAX_COUNT)
		.optional(),
	websiteUrl: updateSnsUrlSchema,
	xUrl: updateSnsUrlSchema,
	instagramUrl: updateSnsUrlSchema,
	youtubeUrl: updateSnsUrlSchema,
	openStatus: openStatusSchema.optional(),
	stockStatus: stockStatusSchema.optional(),
});
export type UpdateProjectPublicInfoRequest = z.infer<
	typeof updateProjectPublicInfoRequestSchema
>;

export const updateProjectPublicInfoResponseSchema = z.object({
	publicInfo: projectPublicInfoSchema,
});
export type UpdateProjectPublicInfoResponse = z.infer<
	typeof updateProjectPublicInfoResponseSchema
>;
