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

/** SNSリンクの項目ごとに登録できる最大件数 */
export const PROJECT_SNS_LINKS_MAX_COUNT = 2;

/**
 * Webサイトの URL の最大文字数
 *
 * Prisma スキーマの `ProjectPublicInfo.websiteUrls` の VarChar と必ず一致させること。
 */
export const PROJECT_SNS_URL_MAX_LENGTH = 2048;

/**
 * X・Instagram・YouTube の ID の最大文字数（各サービスの仕様による）
 *
 * Prisma スキーマの `ProjectPublicInfo.xIds` / `instagramIds` / `youtubeIds` の VarChar と必ず一致させること。
 */
export const PROJECT_X_ID_MAX_LENGTH = 15;
export const PROJECT_INSTAGRAM_ID_MAX_LENGTH = 30;
export const PROJECT_YOUTUBE_ID_MAX_LENGTH = 30;

/**
 * 企画情報として収集するSNSリンクの項目
 *
 * X はユーザーID（@ を除く）、Instagram はユーザーネーム、
 * YouTube はチャンネルのハンドル（@ を除く）で持つ。
 * 共有URLに付く追跡用パラメータや twitter.com / x.com の表記ゆれを持ち込まず、
 * 利用側で `https://x.com/{id}` のように組み立てられるようにするため。
 */
export const projectSnsLinkKeys = [
	"websiteUrls",
	"xIds",
	"instagramIds",
	"youtubeIds",
] as const;
export type ProjectSnsLinkKey = (typeof projectSnsLinkKeys)[number];

// 公開APIからそのままリンクとして配信されるため、javascript: などを弾く
export const projectSnsUrlSchema = z
	.url({
		protocol: /^https?$/,
		error: "http(s) から始まるURLを入力してください",
	})
	.max(PROJECT_SNS_URL_MAX_LENGTH);

export const projectXIdSchema = z
	.string()
	.regex(
		new RegExp(`^[A-Za-z0-9_]{1,${PROJECT_X_ID_MAX_LENGTH}}$`),
		`XのユーザーIDは半角英数字と _ の${PROJECT_X_ID_MAX_LENGTH}文字以内で入力してください`
	);

export const projectInstagramIdSchema = z
	.string()
	.regex(
		new RegExp(`^[A-Za-z0-9._]{1,${PROJECT_INSTAGRAM_ID_MAX_LENGTH}}$`),
		`Instagramのユーザーネームは半角英数字と . _ の${PROJECT_INSTAGRAM_ID_MAX_LENGTH}文字以内で入力してください`
	);

// YouTube のハンドルは日本語などの文字も使えるため、英数字に限定しない
export const projectYoutubeIdSchema = z
	.string()
	.regex(
		new RegExp(
			`^[\\p{L}\\p{M}\\p{N}._·-]{1,${PROJECT_YOUTUBE_ID_MAX_LENGTH}}$`,
			"u"
		),
		`YouTubeのハンドルは${PROJECT_YOUTUBE_ID_MAX_LENGTH}文字以内の文字・数字と . _ - で入力してください`
	)
	.refine(value => {
		const length = Array.from(value).length;
		// 漢字・ハングルは1文字から、かな・エチオピア文字は2文字から使える。
		return (
			length >= 3 ||
			/^[\p{Script_Extensions=Han}\p{Script_Extensions=Hangul}]+$/u.test(
				value
			) ||
			(length >= 2 &&
				/^[\p{Script_Extensions=Han}\p{Script_Extensions=Hangul}\p{Script_Extensions=Hiragana}\p{Script_Extensions=Katakana}\p{Script_Extensions=Ethiopic}]+$/u.test(
					value
				))
		);
	}, "YouTubeのハンドルは3文字以上（漢字・ハングルは1文字以上、ひらがな・カタカナなどは2文字以上）で入力してください");

// プロフィールの表示どおり「@sohosai」と入力されても受け付け、@ を外して扱う
function snsIdInputSchema(schema: z.ZodString) {
	return z
		.string()
		.trim()
		.overwrite(v => v.replace(/^@/, ""))
		.pipe(schema);
}

/** 入力欄1つ分の値の検証に使うスキーマ */
export const projectSnsLinkInputSchemas = {
	websiteUrls: projectSnsUrlSchema,
	xIds: snsIdInputSchema(projectXIdSchema),
	instagramIds: snsIdInputSchema(projectInstagramIdSchema),
	youtubeIds: snsIdInputSchema(projectYoutubeIdSchema),
} satisfies Record<ProjectSnsLinkKey, z.ZodType<string, string>>;

function snsLinksSchema<T extends z.ZodType>(schema: T) {
	return z.array(schema).max(PROJECT_SNS_LINKS_MAX_COUNT);
}

export const projectPublicInfoSchema = z.object({
	description: z.string().max(PROJECT_DESCRIPTION_MAX_LENGTH).nullable(),
	iconFileId: z.string().nullable(),
	mapImageFileIds: z.array(z.string()).max(PROJECT_MAP_IMAGES_MAX_COUNT),
	websiteUrls: snsLinksSchema(projectSnsUrlSchema).describe("WebサイトのURL"),
	xIds: snsLinksSchema(projectXIdSchema).describe(
		"XのユーザーID（@ を除く）。URL は https://x.com/{xId}"
	),
	instagramIds: snsLinksSchema(projectInstagramIdSchema).describe(
		"Instagramのユーザーネーム。URL は https://www.instagram.com/{instagramId}"
	),
	youtubeIds: snsLinksSchema(projectYoutubeIdSchema).describe(
		"YouTubeチャンネルのハンドル（@ を除く）。URL は https://www.youtube.com/@{youtubeId}"
	),
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
	websiteUrls: snsLinksSchema(
		projectSnsLinkInputSchemas.websiteUrls
	).optional(),
	xIds: snsLinksSchema(projectSnsLinkInputSchemas.xIds).optional(),
	instagramIds: snsLinksSchema(
		projectSnsLinkInputSchemas.instagramIds
	).optional(),
	youtubeIds: snsLinksSchema(projectSnsLinkInputSchemas.youtubeIds).optional(),
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
