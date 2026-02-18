import { z } from "zod";
import { userSchema } from "./user";

// ─────────────────────────────────────────────────────────────
// 基本スキーマ
// ─────────────────────────────────────────────────────────────

export const noticeSchema = z.object({
	id: z.cuid(),
	ownerId: z.cuid(),
	title: z.string(),
	body: z.string().nullable(),
	deletedAt: z.coerce.date().nullable(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});
export type Notice = z.infer<typeof noticeSchema>;

export const noticeCollaboratorSchema = z.object({
	id: z.cuid(),
	noticeId: z.cuid(),
	userId: z.cuid(),
	deletedAt: z.coerce.date().nullable(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});
export type NoticeCollaborator = z.infer<typeof noticeCollaboratorSchema>;

export const noticeAuthorizationStatusSchema = z.enum([
	"PENDING",
	"APPROVED",
	"REJECTED",
]);
export type NoticeAuthorizationStatus = z.infer<
	typeof noticeAuthorizationStatusSchema
>;

export const noticeAuthorizationSchema = z.object({
	id: z.cuid(),
	noticeId: z.cuid(),
	requestedById: z.cuid(),
	requestedToId: z.cuid(),
	status: noticeAuthorizationStatusSchema,
	decidedAt: z.coerce.date().nullable(),
	deliveredAt: z.coerce.date(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});
export type NoticeAuthorization = z.infer<typeof noticeAuthorizationSchema>;

export const noticeDeliverySchema = z.object({
	id: z.cuid(),
	noticeAuthorizationId: z.cuid(),
	projectId: z.cuid(),
	createdAt: z.coerce.date(),
});
export type NoticeDelivery = z.infer<typeof noticeDeliverySchema>;

// ─────────────────────────────────────────────────────────────
// パスパラメータ
// ─────────────────────────────────────────────────────────────

export const noticeIdPathParamsSchema = z.object({
	noticeId: z.cuid(),
});

export const noticeAuthorizationIdPathParamsSchema = z.object({
	noticeId: z.cuid(),
	authorizationId: z.cuid(),
});

export const noticeCollaboratorIdPathParamsSchema = z.object({
	noticeId: z.cuid(),
	collaboratorId: z.cuid(),
});

export const projectNoticeIdPathParamsSchema = z.object({
	projectId: z.cuid(),
	noticeId: z.cuid(),
});

// ─────────────────────────────────────────────────────────────
// レスポンス組み立て用の内部ヘルパー（export しない）
// ─────────────────────────────────────────────────────────────

/** ユーザーの最小表示情報（id + name のみ） */
const userSummarySchema = userSchema.pick({ id: true, name: true });

/** 共同編集者 + ユーザー情報（一覧・詳細で使用） */
const collaboratorWithUserSchema = noticeCollaboratorSchema
	.omit({ deletedAt: true })
	.extend({
		user: userSummarySchema,
	});

/** 承認情報の要約（一覧で使用: 最新の承認ステータスだけ表示） */
const authorizationSummarySchema = noticeAuthorizationSchema
	.pick({
		id: true,
		status: true,
		deliveredAt: true,
	})
	.extend({
		requestedTo: userSummarySchema,
	});

/** 承認情報の全詳細（詳細画面で使用: 配信先企画リスト含む） */
const authorizationDetailSchema = noticeAuthorizationSchema.extend({
	requestedBy: userSummarySchema,
	requestedTo: userSummarySchema,
	deliveries: z.array(
		noticeDeliverySchema.extend({
			project: z.object({ id: z.cuid(), name: z.string() }),
		})
	),
});

// ─────────────────────────────────────────────────────────────
// POST /committee/notices
// ─────────────────────────────────────────────────────────────

export const createNoticeRequestSchema = z.object({
	title: z.string().min(1, "タイトルを入力してください"),
	body: z.string().min(1, "本文を入力してください"),
});
export type CreateNoticeRequest = z.infer<typeof createNoticeRequestSchema>;

export const createNoticeResponseSchema = z.object({
	notice: noticeSchema,
});
export type CreateNoticeResponse = z.infer<typeof createNoticeResponseSchema>;

// ─────────────────────────────────────────────────────────────
// GET /committee/notices
// ─────────────────────────────────────────────────────────────

export const listNoticesResponseSchema = z.object({
	notices: z.array(
		noticeSchema.omit({ deletedAt: true, body: true }).extend({
			owner: userSummarySchema,
			collaborators: z.array(collaboratorWithUserSchema),
			authorizations: z.array(authorizationSummarySchema),
		})
	),
});
export type ListNoticesResponse = z.infer<typeof listNoticesResponseSchema>;

// ─────────────────────────────────────────────────────────────
// GET /committee/notices/:noticeId
// ─────────────────────────────────────────────────────────────

export const getNoticeResponseSchema = z.object({
	notice: noticeSchema.omit({ deletedAt: true }).extend({
		owner: userSummarySchema,
		collaborators: z.array(collaboratorWithUserSchema),
		authorizations: z.array(authorizationDetailSchema),
	}),
});
export type GetNoticeResponse = z.infer<typeof getNoticeResponseSchema>;

// ─────────────────────────────────────────────────────────────
// PATCH /committee/notices/:noticeId
// ─────────────────────────────────────────────────────────────

export const updateNoticeRequestSchema = z.object({
	title: z.string().min(1).optional(),
	body: z.string().min(1).optional(),
});
export type UpdateNoticeRequest = z.infer<typeof updateNoticeRequestSchema>;

export const updateNoticeResponseSchema = z.object({
	notice: noticeSchema,
});
export type UpdateNoticeResponse = z.infer<typeof updateNoticeResponseSchema>;

// ─────────────────────────────────────────────────────────────
// DELETE /committee/notices/:noticeId
// ─────────────────────────────────────────────────────────────

export const deleteNoticeResponseSchema = z.object({
	success: z.literal(true),
});
export type DeleteNoticeResponse = z.infer<typeof deleteNoticeResponseSchema>;

// ─────────────────────────────────────────────────────────────
// POST /committee/notices/:noticeId/collaborators
// ─────────────────────────────────────────────────────────────

export const addCollaboratorRequestSchema = z.object({
	userId: z.cuid(),
});
export type AddCollaboratorRequest = z.infer<
	typeof addCollaboratorRequestSchema
>;

export const addCollaboratorResponseSchema = z.object({
	collaborator: collaboratorWithUserSchema,
});
export type AddCollaboratorResponse = z.infer<
	typeof addCollaboratorResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// DELETE /committee/notices/:noticeId/collaborators/:collaboratorId
// ─────────────────────────────────────────────────────────────

export const removeCollaboratorResponseSchema = z.object({
	success: z.literal(true),
});
export type RemoveCollaboratorResponse = z.infer<
	typeof removeCollaboratorResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// POST /committee/notices/:noticeId/authorizations
// ─────────────────────────────────────────────────────────────

export const createNoticeAuthorizationRequestSchema = z.object({
	requestedToId: z.cuid(),
	deliveredAt: z.coerce.date(),
	projectIds: z.array(z.cuid()).min(1, "配信先企画を指定してください"),
});
export type CreateNoticeAuthorizationRequest = z.infer<
	typeof createNoticeAuthorizationRequestSchema
>;

export const createNoticeAuthorizationResponseSchema = z.object({
	authorization: noticeAuthorizationSchema.extend({
		deliveries: z.array(noticeDeliverySchema),
	}),
});
export type CreateNoticeAuthorizationResponse = z.infer<
	typeof createNoticeAuthorizationResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// PATCH /committee/notices/:noticeId/authorizations/:authorizationId
// ─────────────────────────────────────────────────────────────

export const updateNoticeAuthorizationRequestSchema = z.object({
	status: z.enum(["APPROVED", "REJECTED"]),
});
export type UpdateNoticeAuthorizationRequest = z.infer<
	typeof updateNoticeAuthorizationRequestSchema
>;

export const updateNoticeAuthorizationResponseSchema = z.object({
	authorization: noticeAuthorizationSchema,
});
export type UpdateNoticeAuthorizationResponse = z.infer<
	typeof updateNoticeAuthorizationResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// GET /committee/notices/:noticeId/status
// ─────────────────────────────────────────────────────────────

export const getNoticeStatusResponseSchema = z.object({
	deliveries: z.array(
		z.object({
			id: z.cuid(),
			project: z.object({ id: z.cuid(), name: z.string() }),
			authorization: z.object({
				status: noticeAuthorizationStatusSchema,
				deliveredAt: z.coerce.date(),
			}),
			readCount: z.number(),
			memberCount: z.number(),
		})
	),
});
export type GetNoticeStatusResponse = z.infer<
	typeof getNoticeStatusResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// 企画側: GET /project/:projectId/notices
// ─────────────────────────────────────────────────────────────

export const listProjectNoticesResponseSchema = z.object({
	notices: z.array(
		z.object({
			id: z.cuid(),
			title: z.string(),
			owner: userSummarySchema,
			ownerBureau: z.string(),
			deliveredAt: z.coerce.date(),
			isRead: z.boolean(),
		})
	),
});
export type ListProjectNoticesResponse = z.infer<
	typeof listProjectNoticesResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// 企画側: GET /project/:projectId/notices/:noticeId
// ─────────────────────────────────────────────────────────────

export const getProjectNoticeResponseSchema = z.object({
	notice: z.object({
		id: z.cuid(),
		title: z.string(),
		body: z.string().nullable(),
		owner: userSummarySchema,
		ownerBureau: z.string(),
		deliveredAt: z.coerce.date(),
		isRead: z.boolean(),
	}),
});
export type GetProjectNoticeResponse = z.infer<
	typeof getProjectNoticeResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// 企画側: POST /project/:projectId/notices/:noticeId/read
// ─────────────────────────────────────────────────────────────

export const readProjectNoticeResponseSchema = z.object({
	success: z.literal(true),
});
export type ReadProjectNoticeResponse = z.infer<
	typeof readProjectNoticeResponseSchema
>;
