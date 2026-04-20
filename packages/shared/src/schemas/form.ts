import { z } from "zod";
import { bureauSchema } from "./committee-member";
import {
	approvalStatusSchema,
	deliveryModeSchema,
	deliveryTargetSchema,
	projectLocationSchema,
	projectTypeSchema,
	viewerScopeSchema,
} from "./common";
import { formAnswerFileSchema, mimeTypeSchema } from "./file";
import { viewerInputSchema } from "./inquiry";
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

// ─────────────────────────────────────────────────────────────
// 回答バリデーション用の最小申請アイテム型
// ─────────────────────────────────────────────────────────────

export const formAnswerValidationItemSchema = z.object({
	id: z.string(),
	type: formItemTypeSchema,
	required: z.boolean(),
	options: z.array(z.object({ id: z.string() })),
	constraints: z
		.object({
			minLength: z.number().int().nonnegative().optional(),
			maxLength: z.number().int().positive().optional(),
			pattern: z
				.enum(["katakana", "hiragana", "alphanumeric", "custom"])
				.optional(),
			customPattern: z.string().optional(),
			minFiles: z.number().int().nonnegative().optional(),
			maxFiles: z.number().int().positive().optional(),
			allowedMimeTypes: z.array(mimeTypeSchema).min(1).optional(),
		})
		.nullable()
		.optional(),
});
export type FormAnswerValidationItem = z.infer<
	typeof formAnswerValidationItemSchema
>;

// ─────────────────────────────────────────────────────────────
// テキスト制約スキーマ
// ─────────────────────────────────────────────────────────────

export const textConstraintPatternSchema = z.enum([
	"katakana",
	"hiragana",
	"alphanumeric",
	"custom",
]);
export type TextConstraintPattern = z.infer<typeof textConstraintPatternSchema>;

export const textConstraintsSchema = z
	.object({
		minLength: z.number().int().nonnegative().optional(),
		maxLength: z.number().int().positive().optional(),
		pattern: textConstraintPatternSchema.optional(),
		customPattern: z
			.string()
			.refine(val => {
				try {
					new RegExp(val);
					return true;
				} catch {
					return false;
				}
			}, "正規表現の形式が不正です")
			.optional(),
	})
	.refine(
		({ minLength, maxLength }) =>
			minLength === undefined ||
			maxLength === undefined ||
			minLength <= maxLength,
		{ message: "最小文字数は最大文字数以下にしてください", path: ["minLength"] }
	);
export type TextConstraints = z.infer<typeof textConstraintsSchema>;

export const fileConstraintsSchema = z
	.object({
		minFiles: z.number().int().nonnegative().optional(),
		maxFiles: z.number().int().positive().optional(),
		allowedMimeTypes: z.array(mimeTypeSchema).min(1).optional(),
	})
	.refine(
		({ minFiles, maxFiles }) =>
			minFiles === undefined || maxFiles === undefined || minFiles <= maxFiles,
		{
			message: "最小ファイル数は最大ファイル数以下にしてください",
			path: ["minFiles"],
		}
	);
export type FileConstraints = z.infer<typeof fileConstraintsSchema>;

export const formItemConstraintsSchema = z
	.object({
		minLength: textConstraintsSchema.shape.minLength,
		maxLength: textConstraintsSchema.shape.maxLength,
		pattern: textConstraintsSchema.shape.pattern,
		customPattern: textConstraintsSchema.shape.customPattern,
		minFiles: fileConstraintsSchema.shape.minFiles,
		maxFiles: fileConstraintsSchema.shape.maxFiles,
		allowedMimeTypes: fileConstraintsSchema.shape.allowedMimeTypes,
	})
	.refine(
		({ minLength, maxLength }) =>
			minLength === undefined ||
			maxLength === undefined ||
			minLength <= maxLength,
		{ message: "最小文字数は最大文字数以下にしてください", path: ["minLength"] }
	)
	.refine(
		({ minFiles, maxFiles }) =>
			minFiles === undefined || maxFiles === undefined || minFiles <= maxFiles,
		{
			message: "最小ファイル数は最大ファイル数以下にしてください",
			path: ["minFiles"],
		}
	);
export type FormItemConstraints = z.infer<typeof formItemConstraintsSchema>;

function hasTextConstraints(
	constraints: FormItemConstraints | null | undefined
): boolean {
	return (
		constraints?.minLength !== undefined ||
		constraints?.maxLength !== undefined ||
		constraints?.pattern !== undefined ||
		constraints?.customPattern !== undefined
	);
}

function hasFileConstraints(
	constraints: FormItemConstraints | null | undefined
): boolean {
	return (
		constraints?.minFiles !== undefined ||
		constraints?.maxFiles !== undefined ||
		constraints?.allowedMimeTypes !== undefined
	);
}

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
	description: z.string().nullable(),
	type: formItemTypeSchema,
	required: z.boolean().default(false),
	sortOrder: z.number().int(),
	options: z.array(formItemOptionSchema),
	constraints: formItemConstraintsSchema.nullable(),
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
	status: approvalStatusSchema,
	decidedAt: z.coerce.date().nullable(),
	scheduledSendAt: z.coerce.date(),
	deadlineAt: z.coerce.date().nullable(),
	allowLateResponse: z.boolean(),
	required: z.boolean(),
	ownerOnly: z.boolean(),
	deliveryMode: deliveryModeSchema,
	filterTypes: z.array(projectTypeSchema),
	filterLocations: z.array(projectLocationSchema),
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

export const formAttachmentSchema = z.object({
	id: z.cuid(),
	fileId: z.string(),
	fileName: z.string(),
	mimeType: z.string(),
	size: z.number(),
	isPublic: z.boolean(),
	createdAt: z.coerce.date(),
});
export type FormAttachment = z.infer<typeof formAttachmentSchema>;

// ─────────────────────────────────────────────────────────────
// パスパラメーター
// ─────────────────────────────────────────────────────────────

export const formIdPathParamsSchema = z.object({
	formId: z.cuid(),
});

export const formCollaboratorPathParamsSchema = z.object({
	formId: z.cuid(),
	userId: z.cuid(),
});

export const formAuthorizationPathParamsSchema = z.object({
	formId: z.cuid(),
	authorizationId: z.cuid(),
});

export const formAttachmentPathParamsSchema = z.object({
	formId: z.cuid(),
	attachmentId: z.cuid(),
});

// ─────────────────────────────────────────────────────────────
// レスポンス組み立て用の内部ヘルパー（export しない）
// ─────────────────────────────────────────────────────────────

/** ユーザーの最小表示情報（id + name + avatar） */
const userSummarySchema = userSchema.pick({
	id: true,
	name: true,
	avatarFileId: true,
});

/** 共同編集者 + ユーザー情報（詳細で使用: id は削除APIのパスに必要） */
const collaboratorWithUserSchema = formCollaboratorSchema
	.pick({ id: true, isWrite: true })
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
		ownerOnly: true,
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

/** 回答スキーマを組み立てるため */
const baseAnswerSchema = {
	formItemId: z.string().min(1),
	type: formItemTypeSchema,
};
const textAnswerSchema = z.object({
	...baseAnswerSchema,
	type: z.literal("TEXT"),
	textValue: z.string().nullable(),
});

const textareaAnswerSchema = z.object({
	...baseAnswerSchema,
	type: z.literal("TEXTAREA"),
	textValue: z.string().nullable(),
});

const numberAnswerSchema = z.object({
	...baseAnswerSchema,
	type: z.literal("NUMBER"),
	numberValue: z.number().nullable(),
});

const fileAnswerSchema = z.object({
	...baseAnswerSchema,
	type: z.literal("FILE"),
	fileIds: z.array(z.string()),
});

const selectAnswerSchema = z.object({
	...baseAnswerSchema,
	type: z.literal("SELECT"),
	selectedOptionIds: z.array(z.string()),
});

const checkboxAnswerSchema = z.object({
	...baseAnswerSchema,
	type: z.literal("CHECKBOX"),
	selectedOptionIds: z.array(z.string()),
});

// ─────────────────────────────────────────────────────────────
// POST /committee/forms/create
// ─────────────────────────────────────────────────────────────

export const createFormItemOptionInputSchema = z.object({
	label: z.string().min(1),
	sortOrder: z.number().int(),
});

/**
 * SELECT/CHECKBOX は options 必須、それ以外は options 不可のバリデーション。
 */
export const validateFormItemTypeOptions = (
	data: { type: string; options?: unknown[] },
	ctx: z.RefinementCtx
) => {
	const needsOptions = data.type === "SELECT" || data.type === "CHECKBOX";
	if (needsOptions && (!data.options || data.options.length === 0)) {
		ctx.addIssue({
			code: "custom",
			message: "SELECT/CHECKBOXタイプの設問には選択肢を1つ以上設定してください",
			path: ["options"],
		});
	}
	if (!needsOptions && data.options && data.options.length > 0) {
		ctx.addIssue({
			code: "custom",
			message: "このタイプの設問には選択肢を設定できません",
			path: ["options"],
		});
	}
};

export const validateFormItemTypeConstraints = (
	data: { type: string; constraints?: FormItemConstraints | null },
	ctx: z.RefinementCtx
) => {
	const constraints = data.constraints;
	if (!constraints) return;

	const hasText = hasTextConstraints(constraints);
	const hasFile = hasFileConstraints(constraints);

	if (data.type === "TEXT" || data.type === "TEXTAREA") {
		if (hasFile) {
			ctx.addIssue({
				code: "custom",
				message: "TEXT/TEXTAREAタイプの設問にはファイル数制約を設定できません",
				path: ["constraints"],
			});
		}
		return;
	}

	if (data.type === "FILE") {
		if (hasText) {
			ctx.addIssue({
				code: "custom",
				message: "FILEタイプの設問には文字数制約を設定できません",
				path: ["constraints"],
			});
		}
		return;
	}

	if (hasText || hasFile) {
		ctx.addIssue({
			code: "custom",
			message: "このタイプの設問には入力制約を設定できません",
			path: ["constraints"],
		});
	}
};

export const validateFormItemTypeConfiguration = (
	data: {
		type: string;
		required?: boolean;
		options?: unknown[];
		constraints?: FormItemConstraints | null;
	},
	ctx: z.RefinementCtx
) => {
	validateFormItemTypeOptions(data, ctx);
	validateFormItemTypeConstraints(data, ctx);

	// 必須FILEは minFiles >= 1 を強制
	if (data.type === "FILE" && data.required) {
		const minFiles = data.constraints?.minFiles;
		if (minFiles === undefined || minFiles < 1) {
			ctx.addIssue({
				code: "custom",
				message:
					"必須のファイル設問には最小ファイル数を1以上に設定してください",
				path: ["constraints"],
			});
		}
	}
};

// .extend() を使うため superRefine なしのベーススキーマ（内部利用）
const formItemInputObjectSchema = formItemSchema
	.pick({
		label: true,
		description: true,
		type: true,
		required: true,
		sortOrder: true,
	})
	.extend({
		options: z.array(createFormItemOptionInputSchema).optional(),
		constraints: formItemConstraintsSchema.nullable().optional(),
	});

export const createFormItemInputSchema = formItemInputObjectSchema.superRefine(
	validateFormItemTypeConfiguration
);

export const createFormRequestSchema = z.object({
	title: z.string().min(1).default("無題の申請"),
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
	/** 現在ユーザーが FormViewer の scope に合致する閲覧者かどうか */
	isViewer: z.boolean(),
});

export const listMyFormsResponseSchema = z.object({
	forms: z.array(formSummarySchema),
});
export type ListMyFormsResponse = z.infer<typeof listMyFormsResponseSchema>;

// ─────────────────────────────────────────────────────────────
// GET /committee/forms/:formId/detail
// ─────────────────────────────────────────────────────────────

/** 閲覧者情報 */
const formViewerDetailSchema = z.object({
	id: z.string(),
	scope: viewerScopeSchema,
	bureauValue: bureauSchema.nullable(),
	createdAt: z.coerce.date(),
	user: userSummarySchema.nullable(),
});

export const getFormDetailResponseSchema = z.object({
	form: formSchema.extend({
		owner: userSummarySchema,
		collaborators: z.array(collaboratorWithUserSchema),
		authorizationDetail: authorizationDetailSchema.nullable(),
		attachments: z.array(formAttachmentSchema),
		viewers: z.array(formViewerDetailSchema),
	}),
});
export type GetFormDetailResponse = z.infer<typeof getFormDetailResponseSchema>;

// ─────────────────────────────────────────────────────────────
// PUT /committee/forms/:formId/viewers
// ─────────────────────────────────────────────────────────────

export const updateFormViewersRequestSchema = z.object({
	viewers: z.array(viewerInputSchema),
});
export type UpdateFormViewersRequest = z.infer<
	typeof updateFormViewersRequestSchema
>;

export const updateFormViewersResponseSchema = z.object({
	viewers: z.array(formViewerDetailSchema),
});
export type UpdateFormViewersResponse = z.infer<
	typeof updateFormViewersResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// PATCH /committee/forms/:formId/detail
// ─────────────────────────────────────────────────────────────

// 更新リクエスト用のitem入力スキーマ
export const updateFormItemInputSchema = formItemInputObjectSchema
	.extend({ id: z.string().min(1).optional() })
	.superRefine(validateFormItemTypeConfiguration);

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
// POST /committee/forms/:formId/attachments
// ─────────────────────────────────────────────────────────────

export const addFormAttachmentRequestSchema = z.object({
	fileIds: z.array(z.string()).min(1, "ファイルを1つ以上指定してください"),
});
export type AddFormAttachmentRequest = z.infer<
	typeof addFormAttachmentRequestSchema
>;

export const addFormAttachmentResponseSchema = z.object({
	attachments: z.array(formAttachmentSchema),
});
export type AddFormAttachmentResponse = z.infer<
	typeof addFormAttachmentResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// DELETE /committee/forms/:formId/attachments/:attachmentId
// ─────────────────────────────────────────────────────────────

export const removeFormAttachmentResponseSchema = z.object({
	success: z.literal(true),
});
export type RemoveFormAttachmentResponse = z.infer<
	typeof removeFormAttachmentResponseSchema
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
	ownerOnly: z.boolean().default(false),
	deliveryTarget: deliveryTargetSchema,
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
// PATCH /committee/forms/:formId/authorizations/:authorizationId
// ─────────────────────────────────────────────────────────────

export const updateFormAuthorizationRequestSchema = z.object({
	status: z.enum(["APPROVED", "REJECTED"]),
});
export type UpdateFormAuthorizationRequest = z.infer<
	typeof updateFormAuthorizationRequestSchema
>;

export const updateFormAuthorizationResponseSchema = z.object({
	authorization: formAuthorizationSchema,
});
export type UpdateFormAuthorizationResponse = z.infer<
	typeof updateFormAuthorizationResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// GET /committee/forms/:formId/responses
// 申請の回答一覧（共同編集者のみ）
// ─────────────────────────────────────────────────────────────

export const formResponseAnswerSchema = z.object({
	formItemId: z.string(),
	textValue: z.string().nullable(),
	numberValue: z.number().nullable(),
	files: z.array(formAnswerFileSchema),
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
		number: z.number().int().positive(),
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
// GET /committee/forms/:formId/responses/:responseId
// 申請の回答詳細（共同編集者のみ）
// ─────────────────────────────────────────────────────────────

export const formResponsePathParamsSchema = z.object({
	formId: z.cuid(),
	responseId: z.cuid(),
});

export const getFormResponseResponseSchema = z.object({
	response: formResponseSummarySchema.extend({
		project: z.object({
			id: z.string(),
			number: z.number().int().positive(),
			name: z.string(),
		}),
	}),
});
export type GetFormResponseResponse = z.infer<
	typeof getFormResponseResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// PUT /committee/forms/:formId/answers/:formItemId/:projectId
// 申請回答の編集（委員会側）
// ─────────────────────────────────────────────────────────────

export const editFormAnswerPathParamsSchema = z.object({
	formId: z.cuid(),
	formItemId: z.cuid(),
	projectId: z.cuid(),
});

export const editFormAnswerRequestSchema = z.object({
	textValue: z.string().nullable().optional(),
	numberValue: z.number().nullable().optional(),
	fileIds: z.array(z.string()).optional(),
	selectedOptionIds: z.array(z.string()).optional(),
});
export type EditFormAnswerRequest = z.infer<typeof editFormAnswerRequestSchema>;

export const editFormAnswerResponseSchema = z.object({
	answer: z.object({
		formItemId: z.string(),
		textValue: z.string().nullable(),
		numberValue: z.number().nullable(),
		files: z.array(formAnswerFileSchema),
		selectedOptions: z.array(z.object({ id: z.string(), label: z.string() })),
	}),
});
export type EditFormAnswerResponse = z.infer<
	typeof editFormAnswerResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// 企画側
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// パスパラメーター（企画側）
// ─────────────────────────────────────────────────────────────

export const projectFormPathParamsSchema = z.object({
	projectId: z.cuid(),
	formDeliveryId: z.cuid(),
});

// ─────────────────────────────────────────────────────────────
// 企画側: GET /project/:projectId/forms
// 自分の企画に配信された申請一覧
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
			ownerOnly: z.boolean(),
			restricted: z.boolean(),
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
// 申請詳細（項目含む）+ 自分の回答
// ─────────────────────────────────────────────────────────────

// 企画側に返す項目スキーマ
const projectFormItemOptionSchema = z.object({
	id: z.string(),
	label: z.string(),
	sortOrder: z.number().int(),
});

const projectFormItemSchema = z.object({
	id: z.string(),
	label: z.string(),
	description: z.string().nullable(),
	type: formItemTypeSchema,
	required: z.boolean(),
	sortOrder: z.number().int(),
	options: z.array(projectFormItemOptionSchema),
	constraints: formItemConstraintsSchema.nullable(),
});

// 回答値スキーマ
const formAnswerSchema = z.object({
	formItemId: z.string(),
	textValue: z.string().nullable(),
	numberValue: z.number().nullable(),
	files: z.array(formAnswerFileSchema),
	selectedOptionIds: z.array(z.string()),
});

export const getProjectFormResponseSchema = z.object({
	form: z.object({
		formDeliveryId: z.string(),
		formId: z.string(),
		title: z.string(),
		description: z.string().nullable(),
		attachments: z.array(formAttachmentSchema),
		scheduledSendAt: z.coerce.date(),
		deadlineAt: z.coerce.date().nullable(),
		allowLateResponse: z.boolean(),
		required: z.boolean(),
		ownerOnly: z.boolean(),
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

export const formAnswerInputSchema = z.discriminatedUnion("type", [
	textAnswerSchema,
	textareaAnswerSchema,
	numberAnswerSchema,
	fileAnswerSchema,
	selectAnswerSchema,
	checkboxAnswerSchema,
]);
export type FormAnswerInput = z.infer<typeof formAnswerInputSchema>;

export const registrationFormAnswersInputSchema = z.object({
	formId: z.string().min(1),
	answers: z.array(formAnswerInputSchema),
});
export type RegistrationFormAnswersInput = z.infer<
	typeof registrationFormAnswersInputSchema
>;

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
