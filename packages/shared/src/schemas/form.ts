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
	required: z.boolean(),
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

const formSummarySchema = z.object({
	id: z.string(),
	title: z.string(),
	description: z.string().nullable(),
	updatedAt: z.coerce.date(),

	owner: userSummarySchema,
	collaborators: z.array(userSummarySchema),
	authorization: authorizationSummarySchema.nullable(),
});

export const listMyFormsResponseSchema = z.object({
	forms: z.array(formSummarySchema),
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

// 更新リクエスト用のitem入力スキーマ
export const updateFormItemInputSchema = z.object({
	id: z.string().min(1),
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
	required: z.boolean().default(true),
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

// ─────────────────────────────────────────────────────────────
// GET /committee/forms/:formId/responses
// フォームの回答一覧（共同編集者のみ）
// ─────────────────────────────────────────────────────────────

export const formResponseAnswerSchema = z.object({
	formItemId: z.string(),
	textValue: z.string().nullable(),
	numberValue: z.number().nullable(),
	fileUrl: z.string().nullable(),
	selectedOptions: z.array(
		z.object({
			id: z.string(),
			label: z.string(),
		})
	),
});

export const formResponseSummarySchema = z.object({
	id: z.string(),
	respondent: z.object({ id: z.string(), name: z.string() }),
	project: z.object({
		id: z.string(),
		name: z.string(),
	}),
	submittedAt: z.coerce.date().nullable(),
	createdAt: z.coerce.date(),
	answers: z.array(formResponseAnswerSchema),
});

export const listFormResponsesResponseSchema = z.object({
	responses: z.array(formResponseSummarySchema),
});
export type ListFormResponsesResponse = z.infer<
	typeof listFormResponsesResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// 企画側
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// パスパラメーター（企画側）
// ─────────────────────────────────────────────────────────────

export const projectFormPathParamsSchema = z.object({
	projectId: z.string().min(1),
	formDeliveryId: z.string().min(1),
});

export const projectFormResponsePathParamsSchema = z.object({
	projectId: z.string().min(1),
	formDeliveryId: z.string().min(1),
	responseId: z.string().min(1),
});

// ─────────────────────────────────────────────────────────────
// 企画側: GET /project/:projectId/forms
// 自分の企画に配信されたフォーム一覧
// ─────────────────────────────────────────────────────────────

export const listProjectFormsResponseSchema = z.object({
	forms: z.array(
		z.object({
			formDeliveryId: z.string(),
			formId: z.string(),
			title: z.string(),
			description: z.string().nullable(),
			scheduledSendAt: z.coerce.date(),
			deadlineAt: z.coerce.date().nullable(),
			required: z.boolean(),
			allowLateResponse: z.boolean(),
			// 自分の回答状況
			response: z
				.object({
					id: z.string(),
					submittedAt: z.coerce.date().nullable(),
				})
				.nullable(),
		})
	),
});
export type ListProjectFormsResponse = z.infer<
	typeof listProjectFormsResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// 企画側: GET /project/:projectId/forms/:formDeliveryId
// フォーム詳細（項目含む）+ 自分の回答
// ─────────────────────────────────────────────────────────────

// 企画側に返す項目スキーマ（DBメタ不要）
const projectFormItemOptionSchema = z.object({
	id: z.string(),
	label: z.string(),
	sortOrder: z.number().int(),
});

const projectFormItemSchema = z.object({
	id: z.string(),
	label: z.string(),
	type: formItemTypeSchema,
	required: z.boolean(),
	sortOrder: z.number().int(),
	options: z.array(projectFormItemOptionSchema),
});

// 回答値スキーマ
const formAnswerSchema = z.object({
	formItemId: z.string(),
	textValue: z.string().nullable(),
	numberValue: z.number().nullable(),
	fileUrl: z.string().nullable(),
	selectedOptionIds: z.array(z.string()),
});

export const getProjectFormResponseSchema = z.object({
	form: z.object({
		formDeliveryId: z.string(),
		formId: z.string(),
		title: z.string(),
		description: z.string().nullable(),
		scheduledSendAt: z.coerce.date(),
		deadlineAt: z.coerce.date().nullable(),
		allowLateResponse: z.boolean(),
		required: z.boolean(),
		items: z.array(projectFormItemSchema),
		// 既存の回答（下書き含む）
		response: z
			.object({
				id: z.string(),
				submittedAt: z.coerce.date().nullable(),
				answers: z.array(formAnswerSchema),
			})
			.nullable(),
	}),
});
export type GetProjectFormResponse = z.infer<
	typeof getProjectFormResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// 企画側: POST /project/:projectId/forms/:formDeliveryId/responses
// 回答を作成（下書き or 提出）
// ─────────────────────────────────────────────────────────────

const formAnswerInputSchema = z.object({
	formItemId: z.string().min(1),
	textValue: z.string().nullable().optional(),
	numberValue: z.number().nullable().optional(),
	fileUrl: z.string().nullable().optional(),
	selectedOptionIds: z.array(z.string()).optional(),
});

export const createFormResponseRequestSchema = z.object({
	answers: z.array(formAnswerInputSchema),
	submit: z.boolean().default(false), // false=下書き, true=提出
});
export type CreateFormResponseRequest = z.infer<
	typeof createFormResponseRequestSchema
>;

export const createFormResponseResponseSchema = z.object({
	response: z.object({
		id: z.string(),
		submittedAt: z.coerce.date().nullable(),
		answers: z.array(formAnswerSchema),
	}),
});
export type CreateFormResponseResponse = z.infer<
	typeof createFormResponseResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// 企画側: PATCH /project/:projectId/forms/:formDeliveryId/responses/:responseId
// 回答を更新（下書き編集 or 提出）
// ─────────────────────────────────────────────────────────────

export const updateFormResponseRequestSchema = z.object({
	answers: z.array(formAnswerInputSchema),
	submit: z.boolean().default(false),
});
export type UpdateFormResponseRequest = z.infer<
	typeof updateFormResponseRequestSchema
>;

export const updateFormResponseResponseSchema = z.object({
	response: z.object({
		id: z.string(),
		submittedAt: z.coerce.date().nullable(),
		answers: z.array(formAnswerSchema),
	}),
});
export type UpdateFormResponseResponse = z.infer<
	typeof updateFormResponseResponseSchema
>;
