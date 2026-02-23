import { z } from "zod";
import { userSchema } from "./user";

// ─────────────────────────────────────────────────────────────
// 共通Enum
// ─────────────────────────────────────────────────────────────

export const formItemTypeSchema = z.enum([
	"TEXT",
	"TEXTAREA",
	"SELECT",
	"CHECKBOX",
	"NUMBER",
	"FILE",
]);
export type FormItemType = z.infer<typeof formItemTypeSchema>;

export const formAuthorizationStatusSchema = z.enum([
	"PENDING",
	"APPROVED",
	"REJECTED",
]);
export type FormAuthorizationStatus = z.infer<
	typeof formAuthorizationStatusSchema
>;

// ─────────────────────────────────────────────────────────────
// 基本モデルスキーマ
// ─────────────────────────────────────────────────────────────

export const formItemOptionSchema = z.object({
	id: z.string(),
	formItemId: z.string(),
	label: z.string().min(1),
	sortOrder: z.number().int(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});
export type FormItemOption = z.infer<typeof formItemOptionSchema>;

export const formItemSchema = z.object({
	id: z.string(),
	formId: z.string(),
	label: z.string().min(1),
	type: formItemTypeSchema,
	required: z.boolean(),
	sortOrder: z.number().int(),
	options: z.array(formItemOptionSchema),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});
export type FormItem = z.infer<typeof formItemSchema>;

export const formSchema = z.object({
	id: z.string(),
	ownerId: z.string(),
	title: z.string().min(1),
	description: z.string().nullable(),
	items: z.array(formItemSchema),
	deletedAt: z.coerce.date().nullable(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});
export type Form = z.infer<typeof formSchema>;

export const formCollaboratorSchema = z.object({
	id: z.string(),
	formId: z.string(),
	userId: z.string(),
	isWrite: z.boolean(),
	deletedAt: z.coerce.date().nullable(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});
export type FormCollaborator = z.infer<typeof formCollaboratorSchema>;

export const formAuthorizationSchema = z.object({
	id: z.string(),
	formId: z.string(),
	requestedById: z.string(),
	requestedToId: z.string(),
	status: formAuthorizationStatusSchema,
	decidedAt: z.coerce.date().nullable(),
	scheduledSendAt: z.coerce.date(),
	deadlineAt: z.coerce.date().nullable(),
	allowLateResponse: z.boolean(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});
export type FormAuthorization = z.infer<typeof formAuthorizationSchema>;

export const formDeliverySchema = z.object({
	id: z.cuid(),
	formAuthorizationId: z.cuid(),
	projectId: z.cuid(),
	createdAt: z.coerce.date(),
});
export type FormDelivery = z.infer<typeof formDeliverySchema>;

// ─────────────────────────────────────────────────────────────
// パスパラメーター
// ─────────────────────────────────────────────────────────────

export const formIdPathParamsSchema = z.object({
	formId: z.string().min(1),
});

export const formItemPathParamsSchema = z.object({
	formId: z.string().min(1),
	itemId: z.string().min(1),
});

export const formCollaboratorPathParamsSchema = z.object({
	formId: z.string().min(1),
	userId: z.string().min(1),
});

export const formAuthorizationPathParamsSchema = z.object({
	formId: z.string().min(1),
	authorizationId: z.string().min(1),
});

// ─────────────────────────────────────────────────────────────
// レスポンス組み立て用の内部ヘルパー（export しない）
// ─────────────────────────────────────────────────────────────

/** ユーザーの最小表示情報（id + name のみ） */
const userSummarySchema = userSchema.pick({ id: true, name: true });

/** 共同編集者 + ユーザー情報（詳細で使用: id は削除APIのパスに必要） */
const collaboratorWithUserSchema = formCollaboratorSchema
	.pick({ id: true })
	.extend({
		user: userSummarySchema,
	});

/** 承認情報の要約（一覧で使用: 最新の承認ステータスだけ表示） */
const authorizationSummarySchema = formAuthorizationSchema
	.pick({
		id: true,
		status: true,
		scheduledSendAt: true,
		deadlineAt: true,
		allowLateResponse: true,
	})
	.extend({
		requestedTo: userSummarySchema,
	});

/** 承認情報の全詳細（詳細画面で使用: 配信先企画リスト含む） */
const authorizationDetailSchema = formAuthorizationSchema.extend({
	requestedBy: userSummarySchema,
	requestedTo: userSummarySchema,
	deliveries: z.array(
		formDeliverySchema.extend({
			project: z.object({ id: z.cuid(), name: z.string() }),
		})
	),
});

// ─────────────────────────────────────────────────────────────
// POST /committee/forms/create
// ─────────────────────────────────────────────────────────────

export const createFormItemOptionInputSchema = z.object({
	label: z.string().min(1),
	sortOrder: z.number().int(),
});

export const createFormItemInputSchema = z.object({
	label: z.string().min(1),
	type: formItemTypeSchema,
	required: z.boolean().default(false),
	sortOrder: z.number().int(),
	options: z.array(createFormItemOptionInputSchema).optional(),
});

export const createFormRequestSchema = z.object({
	title: z.string().min(1).default("無題のフォーム"),
	description: z.string().optional(),
	items: z.array(createFormItemInputSchema).default([]),
});
export type CreateFormRequest = z.infer<typeof createFormRequestSchema>;

export const createFormResponseSchema = z.object({
	form: formSchema,
});
export type CreateFormResponse = z.infer<typeof createFormResponseSchema>;

// ─────────────────────────────────────────────────────────────
// GET /committee/forms/list
// ─────────────────────────────────────────────────────────────

export const listMyFormsResponseSchema = z.object({
	forms: z.array(
		formSchema.extend({
			owner: userSummarySchema,
			collaborators: z.array(userSummarySchema),
			authorization: authorizationSummarySchema.nullable(),
		})
	),
});
export type ListMyFormsResponse = z.infer<typeof listMyFormsResponseSchema>;

// ─────────────────────────────────────────────────────────────
// GET /committee/forms/:formId/detail
// ─────────────────────────────────────────────────────────────

export const getFormDetailResponseSchema = z.object({
	form: formSchema.extend({
		owner: userSummarySchema,
		collaborators: z.array(collaboratorWithUserSchema),
		authorizations: z.array(authorizationDetailSchema),
	}),
});
export type GetFormDetailResponse = z.infer<typeof getFormDetailResponseSchema>;

// ─────────────────────────────────────────────────────────────
// PATCH /committee/forms/:formId/detail
// ─────────────────────────────────────────────────────────────

// 更新リクエスト用のitem入力スキーマ（idはオプション、DBメタは不要）
export const updateFormItemInputSchema = z.object({
	id: z.string().optional(), // 既存itemはid付き、新規はなし
	label: z.string().min(1),
	type: formItemTypeSchema,
	required: z.boolean().default(false),
	sortOrder: z.number().int(),
	options: z.array(createFormItemOptionInputSchema).optional(),
});

export const updateFormDetailRequestSchema = z.object({
	title: z.string().min(1).optional(),
	description: z.string().nullable().optional(),
	items: z.array(updateFormItemInputSchema).optional(),
});
export type UpdateFormDetailRequest = z.infer<
	typeof updateFormDetailRequestSchema
>;

export const updateFormDetailResponseSchema = z.object({
	form: formSchema,
});
export type UpdateFormDetailResponse = z.infer<
	typeof updateFormDetailResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// DELETE /committee/forms/:formId
// ─────────────────────────────────────────────────────────────

export const deleteFormResponseSchema = z.object({
	success: z.literal(true),
});
export type DeleteFormResponse = z.infer<typeof deleteFormResponseSchema>;

// ─────────────────────────────────────────────────────────────
// POST /committee/forms/:formId/collaborators/:userId
// ─────────────────────────────────────────────────────────────

export const addFormCollaboratorRequestSchema = z.object({
	isWrite: z.boolean().default(false),
});
export type AddFormCollaboratorRequest = z.infer<
	typeof addFormCollaboratorRequestSchema
>;

export const addFormCollaboratorResponseSchema = z.object({
	collaborator: formCollaboratorSchema,
});
export type AddFormCollaboratorResponse = z.infer<
	typeof addFormCollaboratorResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// DELETE /committee/forms/:formId/collaborators/:userId
// ─────────────────────────────────────────────────────────────

export const removeFormCollaboratorResponseSchema = z.object({
	success: z.literal(true),
});
export type RemoveFormCollaboratorResponse = z.infer<
	typeof removeFormCollaboratorResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// POST /committee/forms/:formId/authorizations
// ─────────────────────────────────────────────────────────────

export const requestFormAuthorizationRequestSchema = z.object({
	requestedToId: z.string().min(1),
	scheduledSendAt: z.coerce.date(),
	deadlineAt: z.coerce.date().nullable().optional(),
	allowLateResponse: z.boolean().default(false),
	projectIds: z.array(z.string().min(1)).min(1),
});
export type RequestFormAuthorizationRequest = z.infer<
	typeof requestFormAuthorizationRequestSchema
>;

export const requestFormAuthorizationResponseSchema = z.object({
	authorization: formAuthorizationSchema,
});
export type RequestFormAuthorizationResponse = z.infer<
	typeof requestFormAuthorizationResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// POST /committee/forms/:formId/authorizations/:authorizationId/approve
// ─────────────────────────────────────────────────────────────
export const approveFormAuthorizationRequestSchema = z.undefined();
export type ApproveFormAuthorizationRequest = z.infer<
	typeof approveFormAuthorizationRequestSchema
>;

export const approveFormAuthorizationResponseSchema = z.object({
	authorization: formAuthorizationSchema,
});
export type ApproveFormAuthorizationResponse = z.infer<
	typeof approveFormAuthorizationResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// POST /committee/forms/:formId/authorizations/:authorizationId/reject
// ─────────────────────────────────────────────────────────────

export const rejectFormAuthorizationRequestSchema = z.undefined();
export type RejectFormAuthorizationRequest = z.infer<
	typeof rejectFormAuthorizationRequestSchema
>;
export const rejectFormAuthorizationResponseSchema = z.object({
	authorization: formAuthorizationSchema,
});
export type RejectFormAuthorizationResponse = z.infer<
	typeof rejectFormAuthorizationResponseSchema
>;
