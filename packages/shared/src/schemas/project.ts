import { z } from "zod";
import { isKana, toHiragana } from "../lib/phonetic";
import {
	isValidProjectDisplayName,
	PROJECT_DISPLAY_NAME_RULE_MESSAGE,
} from "../lib/project-display-name";
import { projectLocationSchema, projectTypeSchema } from "./common";
import { formAnswerFileSchema } from "./file";
import { formAnswerInputSchema, formItemTypeSchema } from "./form";

export { projectTypeSchema, projectLocationSchema };
export type { ProjectLocation, ProjectType } from "./common";

export const projectDeletionStatusSchema = z.enum([
	"LOTTERY_LOSS",
	"DELETED",
	"PROJECT_WITHDRAWN",
]);
export type ProjectDeletionStatus = z.infer<typeof projectDeletionStatusSchema>;

const INVITE_CODE_LENGTH = 6;

export const projectSchema = z.object({
	id: z.cuid(),
	number: z.number().int().positive(),
	name: z.string().min(1),
	namePhonetic: z
		.string()
		.min(1)
		.refine(isKana, "ひらがなで入力してください")
		.transform(toHiragana),
	organizationName: z.string().min(1),
	organizationNamePhonetic: z
		.string()
		.min(1)
		.refine(isKana, "ひらがなで入力してください")
		.transform(toHiragana),
	type: projectTypeSchema,
	location: projectLocationSchema,
	ownerId: z.string().min(1),
	subOwnerId: z.string().nullable(),
	inviteCode: z.string().length(INVITE_CODE_LENGTH),
	deletionStatus: projectDeletionStatusSchema.nullable(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
	deletedAt: z.coerce.date().nullable(),
});
export type Project = z.infer<typeof projectSchema>;

// /projectのパラメーター
export const projectIdPathParamsSchema = z.object({
	projectId: z.string().min(1),
});

// メンバー
export const projectMemberRoleSchema = z.enum(["OWNER", "SUB_OWNER", "MEMBER"]);
export type ProjectMemberRole = z.infer<typeof projectMemberRoleSchema>;

export const projectMemberSchema = z.object({
	id: z.string(),
	userId: z.string(),
	name: z.string(),
	email: z.email(),
	role: projectMemberRoleSchema,
	joinedAt: z.coerce.date(),
	avatarFileId: z.string().nullable(),
});
export type ProjectMember = z.infer<typeof projectMemberSchema>;

export const projectMemberViewSchema = projectMemberSchema.extend({
	email: z.email().nullable(),
});
export type ProjectMemberView = z.infer<typeof projectMemberViewSchema>;

// ─────────────────────────────────────────────────────────────
// POST /project/create
// ─────────────────────────────────────────────────────────────

export const createProjectRequestSchema = z
	.object({
		name: z.string().min(1).refine(isValidProjectDisplayName, {
			message: PROJECT_DISPLAY_NAME_RULE_MESSAGE,
		}),
		namePhonetic: z
			.string()
			.min(1)
			.refine(isKana, "ひらがなで入力してください")
			.transform(toHiragana),
		organizationName: z.string().min(1).refine(isValidProjectDisplayName, {
			message: PROJECT_DISPLAY_NAME_RULE_MESSAGE,
		}),
		organizationNamePhonetic: z
			.string()
			.min(1)
			.refine(isKana, "ひらがなで入力してください")
			.transform(toHiragana),
		type: projectTypeSchema,
		location: projectLocationSchema,
		registrationFormAnswers: z
			.array(
				z.object({
					formId: z.string().min(1),
					answers: z.array(formAnswerInputSchema),
				})
			)
			.optional(),
		agreedToRegistrationConstraints: z.literal(true),
		agreedToInfoImmutability: z.literal(true),
	})
	.superRefine((data, ctx) => {
		if (data.type === "STAGE" && data.location !== "STAGE") {
			ctx.addIssue({
				code: "custom",
				message: "ステージ企画の実施場所はステージのみ指定できます",
				path: ["location"],
			});
		}
		if (data.type !== "STAGE" && data.location === "STAGE") {
			ctx.addIssue({
				code: "custom",
				message: "ステージ以外の企画の実施場所にステージは指定できません",
				path: ["location"],
			});
		}
	});

export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>;

export const createProjectResponseSchema = z.object({
	project: projectSchema,
});

export type CreateProjectResponse = z.infer<typeof createProjectResponseSchema>;

// ─────────────────────────────────────────────────────────────
// GET /project/list
// ─────────────────────────────────────────────────────────────

export const listMyProjectsResponseSchema = z.object({
	projects: z.array(projectSchema),
});

export type ListMyProjectsResponse = z.infer<
	typeof listMyProjectsResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// GET /project/:projectId/members
// ─────────────────────────────────────────────────────────────

export const listProjectMembersResponseSchema = z.object({
	members: z.array(projectMemberViewSchema),
	pendingSubOwnerRequestUserId: z.string().nullable(),
});

export type ListProjectMembersResponse = z.infer<
	typeof listProjectMembersResponseSchema
>;

// ─────────────────────────────────────────────
// POST /project/join
// ─────────────────────────────────────────────

export const joinProjectRequestSchema = z.object({
	inviteCode: z.string().length(INVITE_CODE_LENGTH),
});

export type JoinProjectRequest = z.infer<typeof joinProjectRequestSchema>;

export const joinProjectResponseSchema = z.object({
	project: projectSchema,
});

export type JoinProjectResponse = z.infer<typeof joinProjectResponseSchema>;

// ─────────────────────────────────────────────
// GET /project/:projectId/detail
// ─────────────────────────────────────────────

export const getProjectDetailResponseSchema = z.object({
	project: projectSchema,
});

export type GetProjectDetailResponse = z.infer<
	typeof getProjectDetailResponseSchema
>;

// ─────────────────────────────────────────────
// GET /project/:projectId/registration-form-responses
// ─────────────────────────────────────────────

export const projectRegistrationFormResponseAnswerViewSchema = z.object({
	formItemId: z.string(),
	formItemLabel: z.string(),
	type: formItemTypeSchema,
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
export type ProjectRegistrationFormResponseAnswerView = z.infer<
	typeof projectRegistrationFormResponseAnswerViewSchema
>;

export const projectRegistrationFormResponseViewSchema = z.object({
	id: z.string(),
	submittedAt: z.coerce.date(),
	form: z.object({
		id: z.string(),
		title: z.string(),
		description: z.string().nullable(),
	}),
	answers: z.array(projectRegistrationFormResponseAnswerViewSchema),
});
export type ProjectRegistrationFormResponseView = z.infer<
	typeof projectRegistrationFormResponseViewSchema
>;

export const getProjectRegistrationFormResponsesResponseSchema = z.object({
	responses: z.array(projectRegistrationFormResponseViewSchema),
});
export type GetProjectRegistrationFormResponsesResponse = z.infer<
	typeof getProjectRegistrationFormResponsesResponseSchema
>;

// ─────────────────────────────────────────────
// POST /project/:projectId/registration-form-responses
// ─────────────────────────────────────────────

export const createProjectRegistrationFormResponseRequestSchema = z.object({
	formId: z.string().min(1),
	answers: z.array(formAnswerInputSchema),
});

export type CreateProjectRegistrationFormResponseRequest = z.infer<
	typeof createProjectRegistrationFormResponseRequestSchema
>;

export const createProjectRegistrationFormResponseResponseSchema = z.object({
	response: projectRegistrationFormResponseViewSchema,
});

export type CreateProjectRegistrationFormResponseResponse = z.infer<
	typeof createProjectRegistrationFormResponseResponseSchema
>;

// ─────────────────────────────────────────────
// PATCH /project/:projectId/detail
// ─────────────────────────────────────────────

export const updateProjectDetailRequestSchema = z
	.object({
		name: z
			.string()
			.min(1)
			.refine(isValidProjectDisplayName, {
				message: PROJECT_DISPLAY_NAME_RULE_MESSAGE,
			})
			.optional(),
		namePhonetic: z
			.string()
			.min(1)
			.refine(isKana, "ひらがなで入力してください")
			.transform(toHiragana)
			.optional(),
		organizationName: z
			.string()
			.min(1)
			.refine(isValidProjectDisplayName, {
				message: PROJECT_DISPLAY_NAME_RULE_MESSAGE,
			})
			.optional(),
		organizationNamePhonetic: z
			.string()
			.min(1)
			.refine(isKana, "ひらがなで入力してください")
			.transform(toHiragana)
			.optional(),
		type: projectTypeSchema.optional(),
		location: projectLocationSchema.optional(),
	})
	.superRefine((data, ctx) => {
		if (data.type === undefined || data.location === undefined) return;
		if (data.type === "STAGE" && data.location !== "STAGE") {
			ctx.addIssue({
				code: "custom",
				message: "ステージ企画の実施場所はステージのみ指定できます",
				path: ["location"],
			});
		}
		if (data.type !== "STAGE" && data.location === "STAGE") {
			ctx.addIssue({
				code: "custom",
				message: "ステージ以外の企画の実施場所にステージは指定できません",
				path: ["location"],
			});
		}
	});

export type UpdateProjectDetailRequest = z.infer<
	typeof updateProjectDetailRequestSchema
>;

export const updateProjectDetailResponseSchema = z.object({
	project: projectSchema,
});

export type UpdateProjectDetailResponse = z.infer<
	typeof updateProjectDetailResponseSchema
>;

// ─────────────────────────────────────────────────────────────────────────
// PATCH /project/:projectId/registration-form-responses/:responseId
// ─────────────────────────────────────────────────────────────────────────

export const projectRegistrationFormResponsePathParamsSchema = z.object({
	projectId: z.string().min(1),
	responseId: z.string().min(1),
});

export type ProjectRegistrationFormResponsePathParams = z.infer<
	typeof projectRegistrationFormResponsePathParamsSchema
>;

export const updateProjectRegistrationFormResponseRequestSchema = z.object({
	answers: z.array(formAnswerInputSchema),
});

export type UpdateProjectRegistrationFormResponseRequest = z.infer<
	typeof updateProjectRegistrationFormResponseRequestSchema
>;

export const updateProjectRegistrationFormResponseResponseSchema = z.object({
	response: projectRegistrationFormResponseViewSchema,
});

export type UpdateProjectRegistrationFormResponseResponse = z.infer<
	typeof updateProjectRegistrationFormResponseResponseSchema
>;

// ─────────────────────────────────────────────
// POST /project/:projectId/invite-code/regenerate
// ─────────────────────────────────────────────

export const regenerateInviteCodeRequestSchema = z.undefined();

export const regenerateInviteCodeResponseSchema = z.object({
	inviteCode: z.string().length(INVITE_CODE_LENGTH),
});

export type RegenerateInviteCodeResponse = z.infer<
	typeof regenerateInviteCodeResponseSchema
>;

// ─────────────────────────────────────────────
// POST /project/:projectId/members/:userId/remove
// ─────────────────────────────────────────────

export const projectMemberPathParamsSchema = z.object({
	projectId: z.string().min(1),
	userId: z.string().min(1),
});

export type ProjectMemberPathParams = z.infer<
	typeof projectMemberPathParamsSchema
>;

export const removeProjectMemberRequestSchema = z.undefined();

export const removeProjectMemberResponseSchema = z.object({
	success: z.literal(true),
});

export type RemoveProjectMemberResponse = z.infer<
	typeof removeProjectMemberResponseSchema
>;

// ─────────────────────────────────────────────
// POST /project/:projectId/members/:userId/assign
// ─────────────────────────────────────────────

export const assignSubOwnerRequestSchema = z.undefined();

export const assignSubOwnerResponseSchema = z.object({
	success: z.literal(true),
	requestId: z.string(),
	status: z.literal("PENDING"),
});

export type AssignSubOwnerResponse = z.infer<
	typeof assignSubOwnerResponseSchema
>;

// ─────────────────────────────────────────────
// POST /project/:projectId/sub-owner-request/approve
// POST /project/:projectId/sub-owner-request/reject
// ─────────────────────────────────────────────

export const decideSubOwnerRequestRequestSchema = z.undefined();

export const decideSubOwnerRequestResponseSchema = z.object({
	success: z.literal(true),
});

export type DecideSubOwnerRequestResponse = z.infer<
	typeof decideSubOwnerRequestResponseSchema
>;

// ─────────────────────────────────────────────
// GET /project/application-period
// 企画応募期間の情報を取得
// ─────────────────────────────────────────────

export const getApplicationPeriodResponseSchema = z.object({
	isOpen: z.boolean(),
	periods: z
		.array(
			z.object({
				start: z.string(),
				end: z.string(),
			})
		)
		.nullable(),
});

export type GetApplicationPeriodResponse = z.infer<
	typeof getApplicationPeriodResponseSchema
>;
