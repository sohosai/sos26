import { z } from "zod";
import { bureauSchema } from "./committee-member";
import { userSchema } from "./user";

// ─────────────────────────────────────────────────────────────
// 基本スキーマ
// ─────────────────────────────────────────────────────────────

export const inquiryStatusSchema = z.enum([
	"UNASSIGNED",
	"IN_PROGRESS",
	"RESOLVED",
]);
export type InquiryStatus = z.infer<typeof inquiryStatusSchema>;

export const inquiryCreatorRoleSchema = z.enum(["PROJECT", "COMMITTEE"]);
export type InquiryCreatorRole = z.infer<typeof inquiryCreatorRoleSchema>;

export const inquiryAssigneeSideSchema = z.enum(["PROJECT", "COMMITTEE"]);
export type InquiryAssigneeSide = z.infer<typeof inquiryAssigneeSideSchema>;

export const inquiryViewerScopeSchema = z.enum(["ALL", "BUREAU", "INDIVIDUAL"]);
export type InquiryViewerScope = z.infer<typeof inquiryViewerScopeSchema>;

export const inquiryActivityTypeSchema = z.enum([
	"ASSIGNEE_ADDED",
	"ASSIGNEE_REMOVED",
	"VIEWER_UPDATED",
	"STATUS_RESOLVED",
	"STATUS_REOPENED",
]);
export type InquiryActivityType = z.infer<typeof inquiryActivityTypeSchema>;

export const inquirySchema = z.object({
	id: z.cuid(),
	title: z.string(),
	body: z.string(),
	status: inquiryStatusSchema,
	createdById: z.cuid(),
	creatorRole: inquiryCreatorRoleSchema,
	projectId: z.cuid(),
	relatedFormId: z.cuid().nullable(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});
export type Inquiry = z.infer<typeof inquirySchema>;

export const inquiryAssigneeSchema = z.object({
	id: z.cuid(),
	inquiryId: z.cuid(),
	userId: z.cuid(),
	side: inquiryAssigneeSideSchema,
	isCreator: z.boolean(),
	assignedAt: z.coerce.date(),
});
export type InquiryAssignee = z.infer<typeof inquiryAssigneeSchema>;

export const inquiryViewerSchema = z.object({
	id: z.cuid(),
	inquiryId: z.cuid(),
	scope: inquiryViewerScopeSchema,
	bureauValue: bureauSchema.nullable(),
	userId: z.cuid().nullable(),
	createdAt: z.coerce.date(),
});
export type InquiryViewer = z.infer<typeof inquiryViewerSchema>;

export const inquiryCommentSchema = z.object({
	id: z.cuid(),
	inquiryId: z.cuid(),
	body: z.string(),
	createdById: z.cuid(),
	senderRole: inquiryCreatorRoleSchema,
	createdAt: z.coerce.date(),
});
export type InquiryComment = z.infer<typeof inquiryCommentSchema>;

export const inquiryActivitySchema = z.object({
	id: z.cuid(),
	inquiryId: z.cuid(),
	type: inquiryActivityTypeSchema,
	actorId: z.cuid(),
	targetId: z.cuid().nullable(),
	createdAt: z.coerce.date(),
});
export type InquiryActivity = z.infer<typeof inquiryActivitySchema>;

export const inquiryAttachmentSchema = z.object({
	id: z.cuid(),
	fileId: z.string(),
	fileName: z.string(),
	mimeType: z.string(),
	size: z.number(),
	isPublic: z.boolean(),
	createdAt: z.coerce.date(),
});
export type InquiryAttachment = z.infer<typeof inquiryAttachmentSchema>;

// ─────────────────────────────────────────────────────────────
// パスパラメータ
// ─────────────────────────────────────────────────────────────

export const inquiryIdPathParamsSchema = z.object({
	inquiryId: z.cuid(),
});

export const projectInquiryIdPathParamsSchema = z.object({
	projectId: z.string().min(1),
	inquiryId: z.cuid(),
});

export const projectInquiryAssigneeIdPathParamsSchema = z.object({
	projectId: z.string().min(1),
	inquiryId: z.cuid(),
	assigneeId: z.cuid(),
});

export const committeeInquiryAssigneeIdPathParamsSchema = z.object({
	inquiryId: z.cuid(),
	assigneeId: z.cuid(),
});

// ─────────────────────────────────────────────────────────────
// レスポンス組み立て用の内部ヘルパー（export しない）
// ─────────────────────────────────────────────────────────────

/** ユーザーの最小表示情報（id + name のみ） */
const userSummarySchema = userSchema.pick({ id: true, name: true });

/** 担当者 + ユーザー情報 */
const assigneeWithUserSchema = inquiryAssigneeSchema
	.pick({ id: true, side: true, isCreator: true, assignedAt: true })
	.extend({
		user: userSummarySchema,
	});

/** コメント + 投稿者情報 */
const commentWithUserSchema = inquiryCommentSchema
	.pick({ id: true, body: true, senderRole: true, createdAt: true })
	.extend({
		createdBy: userSummarySchema,
		attachments: z.array(inquiryAttachmentSchema),
	});

/** アクティビティ + 操作者・対象者情報 */
const activityWithUserSchema = inquiryActivitySchema
	.pick({ id: true, type: true, createdAt: true })
	.extend({
		actor: userSummarySchema,
		target: userSummarySchema.nullable(),
	});

/** 閲覧者情報 */
const viewerDetailSchema = inquiryViewerSchema
	.pick({ id: true, scope: true, bureauValue: true, createdAt: true })
	.extend({
		user: userSummarySchema.nullable(),
	});

/** 一覧用のお問い合わせ要約 */
const inquirySummarySchema = z.object({
	id: z.cuid(),
	title: z.string(),
	status: inquiryStatusSchema,
	creatorRole: inquiryCreatorRoleSchema,
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
	createdBy: userSummarySchema,
	project: z.object({ id: z.cuid(), name: z.string() }),
	projectAssignees: z.array(assigneeWithUserSchema),
	committeeAssignees: z.array(assigneeWithUserSchema),
	commentCount: z.number(),
});

// ─────────────────────────────────────────────────────────────
// 企画側: POST /project/:projectId/inquiries
// ─────────────────────────────────────────────────────────────

export const createProjectInquiryRequestSchema = z.object({
	title: z.string().min(1, "件名を入力してください"),
	body: z.string().min(1, "内容を入力してください"),
	coAssigneeUserIds: z.array(z.cuid()).optional(),
	fileIds: z.array(z.string()).optional(),
});
export type CreateProjectInquiryRequest = z.infer<
	typeof createProjectInquiryRequestSchema
>;

export const createProjectInquiryResponseSchema = z.object({
	inquiry: inquirySchema,
});
export type CreateProjectInquiryResponse = z.infer<
	typeof createProjectInquiryResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// 企画側: GET /project/:projectId/inquiries
// ─────────────────────────────────────────────────────────────

export const listProjectInquiriesResponseSchema = z.object({
	inquiries: z.array(inquirySummarySchema),
});
export type ListProjectInquiriesResponse = z.infer<
	typeof listProjectInquiriesResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// 企画側: GET /project/:projectId/inquiries/:inquiryId
// ─────────────────────────────────────────────────────────────

export const getProjectInquiryResponseSchema = z.object({
	inquiry: inquirySchema.extend({
		createdBy: userSummarySchema,
		project: z.object({ id: z.cuid(), name: z.string() }),
		projectAssignees: z.array(assigneeWithUserSchema),
		committeeAssignees: z.array(assigneeWithUserSchema),
		comments: z.array(commentWithUserSchema),
		activities: z.array(activityWithUserSchema),
		attachments: z.array(inquiryAttachmentSchema),
	}),
});
export type GetProjectInquiryResponse = z.infer<
	typeof getProjectInquiryResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// 企画側: POST /project/:projectId/inquiries/:inquiryId/comments
// ─────────────────────────────────────────────────────────────

export const addInquiryCommentRequestSchema = z.object({
	body: z.string().min(1, "コメントを入力してください"),
	fileIds: z.array(z.string()).optional(),
});
export type AddInquiryCommentRequest = z.infer<
	typeof addInquiryCommentRequestSchema
>;

export const addInquiryCommentResponseSchema = z.object({
	comment: commentWithUserSchema,
});
export type AddInquiryCommentResponse = z.infer<
	typeof addInquiryCommentResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// 企画側/実委側共通: PATCH .../reopen
// ─────────────────────────────────────────────────────────────

export const reopenInquiryResponseSchema = z.object({
	inquiry: inquirySchema,
});
export type ReopenInquiryResponse = z.infer<typeof reopenInquiryResponseSchema>;

// ─────────────────────────────────────────────────────────────
// 企画側/実委側共通: POST .../assignees
// ─────────────────────────────────────────────────────────────

export const addInquiryAssigneeRequestSchema = z.object({
	userId: z.cuid(),
	side: inquiryAssigneeSideSchema,
});
export type AddInquiryAssigneeRequest = z.infer<
	typeof addInquiryAssigneeRequestSchema
>;

export const addInquiryAssigneeResponseSchema = z.object({
	assignee: assigneeWithUserSchema,
});
export type AddInquiryAssigneeResponse = z.infer<
	typeof addInquiryAssigneeResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// 企画側/実委側共通: DELETE .../assignees/:assigneeId
// ─────────────────────────────────────────────────────────────

export const removeInquiryAssigneeResponseSchema = z.object({
	success: z.literal(true),
});
export type RemoveInquiryAssigneeResponse = z.infer<
	typeof removeInquiryAssigneeResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// 閲覧者入力スキーマ（作成・更新で共用）
// ─────────────────────────────────────────────────────────────

export const viewerInputSchema = z.object({
	scope: inquiryViewerScopeSchema,
	bureauValue: bureauSchema.optional(),
	userId: z.cuid().optional(),
});
export type ViewerInput = z.infer<typeof viewerInputSchema>;

// ─────────────────────────────────────────────────────────────
// 実委側: POST /committee/inquiries
// ─────────────────────────────────────────────────────────────

export const createCommitteeInquiryRequestSchema = z.object({
	title: z.string().min(1, "件名を入力してください"),
	body: z.string().min(1, "内容を入力してください"),
	projectId: z.cuid(),
	projectAssigneeUserIds: z
		.array(z.cuid())
		.min(1, "企画側担当者を1人以上指定してください"),
	committeeAssigneeUserIds: z.array(z.cuid()).optional(),
	fileIds: z.array(z.string()).optional(),
	viewers: z.array(viewerInputSchema).optional(),
});
export type CreateCommitteeInquiryRequest = z.infer<
	typeof createCommitteeInquiryRequestSchema
>;

export const createCommitteeInquiryResponseSchema = z.object({
	inquiry: inquirySchema,
});
export type CreateCommitteeInquiryResponse = z.infer<
	typeof createCommitteeInquiryResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// 実委側: GET /committee/inquiries
// ─────────────────────────────────────────────────────────────

export const listCommitteeInquiriesResponseSchema = z.object({
	inquiries: z.array(inquirySummarySchema),
});
export type ListCommitteeInquiriesResponse = z.infer<
	typeof listCommitteeInquiriesResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// 実委側: GET /committee/inquiries/:inquiryId
// ─────────────────────────────────────────────────────────────

export const getCommitteeInquiryResponseSchema = z.object({
	inquiry: inquirySchema.extend({
		createdBy: userSummarySchema,
		project: z.object({ id: z.cuid(), name: z.string() }),
		projectAssignees: z.array(assigneeWithUserSchema),
		committeeAssignees: z.array(assigneeWithUserSchema),
		viewers: z.array(viewerDetailSchema),
		comments: z.array(commentWithUserSchema),
		activities: z.array(activityWithUserSchema),
		attachments: z.array(inquiryAttachmentSchema),
	}),
});
export type GetCommitteeInquiryResponse = z.infer<
	typeof getCommitteeInquiryResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// 実委側: PATCH /committee/inquiries/:inquiryId/status
// ─────────────────────────────────────────────────────────────

export const updateInquiryStatusRequestSchema = z.object({
	status: z.literal("RESOLVED"),
});
export type UpdateInquiryStatusRequest = z.infer<
	typeof updateInquiryStatusRequestSchema
>;

export const updateInquiryStatusResponseSchema = z.object({
	inquiry: inquirySchema,
});
export type UpdateInquiryStatusResponse = z.infer<
	typeof updateInquiryStatusResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// 実委側: PUT /committee/inquiries/:inquiryId/viewers
// ─────────────────────────────────────────────────────────────

export const updateInquiryViewersRequestSchema = z.object({
	viewers: z.array(viewerInputSchema),
});
export type UpdateInquiryViewersRequest = z.infer<
	typeof updateInquiryViewersRequestSchema
>;

export const updateInquiryViewersResponseSchema = z.object({
	viewers: z.array(viewerDetailSchema),
});
export type UpdateInquiryViewersResponse = z.infer<
	typeof updateInquiryViewersResponseSchema
>;
