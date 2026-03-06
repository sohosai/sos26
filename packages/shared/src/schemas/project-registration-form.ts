import { z } from "zod";
import {
	formAnswerInputSchema,
	formItemOptionSchema,
	formItemSchema,
	formItemTypeSchema,
} from "./form";
import { projectLocationSchema, projectTypeSchema } from "./project";
import { userSchema } from "./user";

// ─────────────────────────────────────────────────────────────
// 共通Enum
// ─────────────────────────────────────────────────────────────

export const projectRegistrationFormAuthorizationStatusSchema = z.enum([
	"PENDING",
	"APPROVED",
	"REJECTED",
]);
export type ProjectRegistrationFormAuthorizationStatus = z.infer<
	typeof projectRegistrationFormAuthorizationStatusSchema
>;

// ─────────────────────────────────────────────────────────────
// 基本モデルスキーマ
// ─────────────────────────────────────────────────────────────

export const projectRegistrationFormItemOptionSchema = formItemOptionSchema;
export type ProjectRegistrationFormItemOption = z.infer<
	typeof projectRegistrationFormItemOptionSchema
>;

export const projectRegistrationFormItemSchema = formItemSchema;
export type ProjectRegistrationFormItem = z.infer<
	typeof projectRegistrationFormItemSchema
>;

export const projectRegistrationFormAuthorizationSchema = z.object({
	id: z.string(),
	formId: z.string(),
	requestedById: z.string(),
	requestedToId: z.string(),
	status: projectRegistrationFormAuthorizationStatusSchema,
	decidedAt: z.coerce.date().nullable(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});
export type ProjectRegistrationFormAuthorization = z.infer<
	typeof projectRegistrationFormAuthorizationSchema
>;

export const projectRegistrationFormSchema = z.object({
	id: z.string(),
	ownerId: z.string(),
	title: z.string().min(1),
	description: z.string().nullable(),
	isActive: z.boolean(),
	sortOrder: z.number().int(),
	filterTypes: z.array(projectTypeSchema),
	filterLocations: z.array(projectLocationSchema),
	deletedAt: z.coerce.date().nullable(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});
export type ProjectRegistrationForm = z.infer<
	typeof projectRegistrationFormSchema
>;

// フォーム詳細（items, authorizations 含む）
export const projectRegistrationFormDetailSchema =
	projectRegistrationFormSchema.extend({
		items: z.array(projectRegistrationFormItemSchema),
		authorizations: z.array(
			projectRegistrationFormAuthorizationSchema.extend({
				requestedBy: userSchema,
				requestedTo: userSchema,
			})
		),
	});
export type ProjectRegistrationFormDetail = z.infer<
	typeof projectRegistrationFormDetailSchema
>;

// ─────────────────────────────────────────────────────────────
// 入力スキーマ（作成・更新）
// ─────────────────────────────────────────────────────────────

export const projectRegistrationFormItemOptionInputSchema = z.object({
	label: z.string().min(1, "選択肢ラベルを入力してください"),
	sortOrder: z.number().int(),
});

export const projectRegistrationFormItemInputSchema = z.object({
	label: z.string().min(1, "質問文を入力してください"),
	description: z.string().optional(),
	type: formItemTypeSchema,
	required: z.boolean().default(false),
	sortOrder: z.number().int(),
	options: z.array(projectRegistrationFormItemOptionInputSchema).optional(),
});

// ─────────────────────────────────────────────────────────────
// path params
// ─────────────────────────────────────────────────────────────

export const projectRegistrationFormIdPathParamsSchema = z.object({
	formId: z.string().min(1),
});

export const projectRegistrationFormAuthorizationPathParamsSchema = z.object({
	formId: z.string().min(1),
	authorizationId: z.string().min(1),
});

// ─────────────────────────────────────────────────────────────
// POST /committee/project-registration-forms/create
// ─────────────────────────────────────────────────────────────

export const createProjectRegistrationFormRequestSchema = z.object({
	title: z.string().min(1).optional(),
	description: z.string().optional(),
	sortOrder: z.number().int().default(0),
	filterTypes: z.array(projectTypeSchema).default([]),
	filterLocations: z.array(projectLocationSchema).default([]),
	items: z.array(projectRegistrationFormItemInputSchema).default([]),
});
export type CreateProjectRegistrationFormRequest = z.infer<
	typeof createProjectRegistrationFormRequestSchema
>;

export const createProjectRegistrationFormResponseSchema = z.object({
	form: projectRegistrationFormDetailSchema,
});
export type CreateProjectRegistrationFormResponse = z.infer<
	typeof createProjectRegistrationFormResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// GET /committee/project-registration-forms
// ─────────────────────────────────────────────────────────────

export const listProjectRegistrationFormsResponseSchema = z.object({
	forms: z.array(
		projectRegistrationFormSchema.extend({
			owner: userSchema,
			latestAuthorization: projectRegistrationFormAuthorizationSchema
				.pick({
					id: true,
					status: true,
					requestedToId: true,
					createdAt: true,
				})
				.nullable(),
		})
	),
});
export type ListProjectRegistrationFormsResponse = z.infer<
	typeof listProjectRegistrationFormsResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// GET /committee/project-registration-forms/:formId
// ─────────────────────────────────────────────────────────────

export const getProjectRegistrationFormDetailResponseSchema = z.object({
	form: projectRegistrationFormDetailSchema,
});
export type GetProjectRegistrationFormDetailResponse = z.infer<
	typeof getProjectRegistrationFormDetailResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// PATCH /committee/project-registration-forms/:formId
// ─────────────────────────────────────────────────────────────

export const updateProjectRegistrationFormRequestSchema = z.object({
	title: z.string().min(1).optional(),
	description: z.string().nullable().optional(),
	sortOrder: z.number().int().optional(),
	filterTypes: z.array(projectTypeSchema).optional(),
	filterLocations: z.array(projectLocationSchema).optional(),
	items: z.array(projectRegistrationFormItemInputSchema).optional(),
});
export type UpdateProjectRegistrationFormRequest = z.infer<
	typeof updateProjectRegistrationFormRequestSchema
>;

export const updateProjectRegistrationFormResponseSchema = z.object({
	form: projectRegistrationFormDetailSchema,
});
export type UpdateProjectRegistrationFormResponse = z.infer<
	typeof updateProjectRegistrationFormResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// DELETE /committee/project-registration-forms/:formId
// ─────────────────────────────────────────────────────────────

export const deleteProjectRegistrationFormResponseSchema = z.object({
	success: z.literal(true),
});
export type DeleteProjectRegistrationFormResponse = z.infer<
	typeof deleteProjectRegistrationFormResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// POST /committee/project-registration-forms/:formId/authorizations
// ─────────────────────────────────────────────────────────────

export const requestProjectRegistrationFormAuthorizationRequestSchema =
	z.object({
		requestedToId: z.string().min(1, "承認者を指定してください"),
	});
export type RequestProjectRegistrationFormAuthorizationRequest = z.infer<
	typeof requestProjectRegistrationFormAuthorizationRequestSchema
>;

export const requestProjectRegistrationFormAuthorizationResponseSchema =
	z.object({
		authorization: projectRegistrationFormAuthorizationSchema,
	});
export type RequestProjectRegistrationFormAuthorizationResponse = z.infer<
	typeof requestProjectRegistrationFormAuthorizationResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// PATCH /committee/project-registration-forms/:formId/authorizations/:authorizationId
// ─────────────────────────────────────────────────────────────

export const updateProjectRegistrationFormAuthorizationRequestSchema = z.object(
	{
		status: z.enum(["APPROVED", "REJECTED"]),
	}
);
export type UpdateProjectRegistrationFormAuthorizationRequest = z.infer<
	typeof updateProjectRegistrationFormAuthorizationRequestSchema
>;

export const updateProjectRegistrationFormAuthorizationResponseSchema =
	z.object({
		authorization: projectRegistrationFormAuthorizationSchema,
	});
export type UpdateProjectRegistrationFormAuthorizationResponse = z.infer<
	typeof updateProjectRegistrationFormAuthorizationResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// GET /project/registration-forms  (企画登録時に使うアクティブフォーム一覧)
// ─────────────────────────────────────────────────────────────

export const getActiveProjectRegistrationFormsQuerySchema = z.object({
	type: projectTypeSchema,
	location: projectLocationSchema,
});
export type GetActiveProjectRegistrationFormsQuery = z.infer<
	typeof getActiveProjectRegistrationFormsQuerySchema
>;

export const getActiveProjectRegistrationFormsResponseSchema = z.object({
	forms: z.array(projectRegistrationFormDetailSchema),
});
export type GetActiveProjectRegistrationFormsResponse = z.infer<
	typeof getActiveProjectRegistrationFormsResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// 企画登録時の回答入力スキーマ  (POST /project/create に埋め込む)
// ─────────────────────────────────────────────────────────────

export const registrationFormAnswerItemInputSchema = formAnswerInputSchema;

export const registrationFormAnswersInputSchema = z.object({
	formId: z.string().min(1),
	answers: z.array(registrationFormAnswerItemInputSchema),
});
export type RegistrationFormAnswersInput = z.infer<
	typeof registrationFormAnswersInputSchema
>;
