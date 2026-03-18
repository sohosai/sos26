import { z } from "zod";
import { toHiragana } from "../lib/phonetic";
import {
	isValidProjectDisplayName,
	PROJECT_DISPLAY_NAME_RULE_MESSAGE,
} from "../lib/project-display-name";
import {
	projectDeletionStatusSchema,
	projectLocationSchema,
	projectMemberSchema,
	projectSchema,
	projectTypeSchema,
} from "./project";
import { userSchema } from "./user";

// ─────────────────────────────────────────────────────────────
// 共通
// ─────────────────────────────────────────────────────────────

/** owner/subOwner 用のユーザーサマリー */
const userSummarySchema = userSchema
	.pick({
		id: true,
		name: true,
		email: true,
		telephoneNumber: true,
	})
	.extend({
		// マスキングのために nullable にするが、userSchema と同じ制約を維持する
		email: userSchema.shape.email.nullable(),
		telephoneNumber: userSchema.shape.telephoneNumber.nullable(),
	});

const committeeProjectActionSchema = z.object({
	id: z.string(),
	title: z.string(),
	sentAt: z.coerce.date(),
});

const committeeProjectPermissionsSchema = z.object({
	canEdit: z.boolean(),
	canDelete: z.boolean(),
	canViewContacts: z.boolean(),
});

// ─────────────────────────────────────────────────────────────
// GET /committee/projects
// ─────────────────────────────────────────────────────────────

/**
 * 企画一覧クエリパラメータ
 *
 * - limit を省略すると全件取得（ページネーションなし）
 */
export const listCommitteeProjectsQuerySchema = z.object({
	type: projectTypeSchema.optional(),
	search: z.string().min(1).optional(),
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).optional(),
});
export type ListCommitteeProjectsQuery = z.infer<
	typeof listCommitteeProjectsQuerySchema
>;
export type ListCommitteeProjectsQueryInput = z.input<
	typeof listCommitteeProjectsQuerySchema
>;

/**
 * 企画サマリー（一覧用）
 * inviteCode・deletedAt は実委向けでも不要なため除外
 */
export const committeeProjectSummarySchema = projectSchema
	.omit({ inviteCode: true, deletedAt: true })
	.extend({
		memberCount: z.number().int(),
		ownerName: z.string(),
	});
export type CommitteeProjectSummary = z.infer<
	typeof committeeProjectSummarySchema
>;

/**
 * 企画一覧レスポンス
 *
 * limit 未指定時は page/limit を含まない
 */
export const listCommitteeProjectsResponseSchema = z.object({
	projects: z.array(committeeProjectSummarySchema),
	total: z.number().int(),
	page: z.number().int().optional(),
	limit: z.number().int().optional(),
});
export type ListCommitteeProjectsResponse = z.infer<
	typeof listCommitteeProjectsResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// GET /committee/projects/:projectId
// ─────────────────────────────────────────────────────────────

/**
 * 企画詳細（owner/subOwner情報含む）
 * inviteCode・deletedAt は除外、owner/subOwner は必要最小限のフィールドのみ
 */
export const committeeProjectDetailSchema = projectSchema
	.omit({ inviteCode: true, deletedAt: true })
	.extend({
		memberCount: z.number().int(),
		owner: userSummarySchema,
		subOwner: userSummarySchema.nullable(),
		actions: z.object({
			forms: z.array(committeeProjectActionSchema),
			notices: z.array(committeeProjectActionSchema),
			inquiries: z.array(committeeProjectActionSchema),
		}),
		permissions: committeeProjectPermissionsSchema,
	});
export type CommitteeProjectDetail = z.infer<
	typeof committeeProjectDetailSchema
>;

/**
 * 企画詳細レスポンス
 */
export const getCommitteeProjectDetailResponseSchema = z.object({
	project: committeeProjectDetailSchema,
});
export type GetCommitteeProjectDetailResponse = z.infer<
	typeof getCommitteeProjectDetailResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// PATCH /committee/projects/:projectId/base-info
// ─────────────────────────────────────────────────────────────

export const updateCommitteeProjectBaseInfoRequestSchema = z
	.object({
		name: z
			.string()
			.min(1)
			.refine(isValidProjectDisplayName, {
				message: PROJECT_DISPLAY_NAME_RULE_MESSAGE,
			})
			.optional(),
		namePhonetic: z.string().min(1).transform(toHiragana).optional(),
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
			.transform(toHiragana)
			.optional(),
		type: projectTypeSchema.optional(),
		location: projectLocationSchema.optional(),
	})
	.refine(data => Object.keys(data).length > 0, {
		message: "更新する項目を指定してください",
	})
	.superRefine((data, ctx) => {
		const { type, location } = data;

		// ステージ企画は location=STAGE のみ許可する
		if (type === "STAGE" && location !== undefined && location !== "STAGE") {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["location"],
				message: "ステージ企画の location は STAGE のみ指定できます",
			});
		}

		// location=STAGE の場合は type=STAGE を要求する
		if (location === "STAGE" && type !== undefined && type !== "STAGE") {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["type"],
				message: "location=STAGE の場合、type も STAGE を指定してください",
			});
		}
	});
export type UpdateCommitteeProjectBaseInfoRequest = z.infer<
	typeof updateCommitteeProjectBaseInfoRequestSchema
>;

export const updateCommitteeProjectBaseInfoResponseSchema = z.object({
	project: committeeProjectDetailSchema.omit({
		actions: true,
		permissions: true,
	}),
});
export type UpdateCommitteeProjectBaseInfoResponse = z.infer<
	typeof updateCommitteeProjectBaseInfoResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// PATCH /committee/projects/:projectId/deletion-status
// ─────────────────────────────────────────────────────────────

export const updateCommitteeProjectDeletionStatusRequestSchema = z.object({
	deletionStatus: projectDeletionStatusSchema.nullable(),
});
export type UpdateCommitteeProjectDeletionStatusRequest = z.infer<
	typeof updateCommitteeProjectDeletionStatusRequestSchema
>;

export const updateCommitteeProjectDeletionStatusResponseSchema = z.object({
	project: committeeProjectDetailSchema.omit({
		actions: true,
		permissions: true,
	}),
});
export type UpdateCommitteeProjectDeletionStatusResponse = z.infer<
	typeof updateCommitteeProjectDeletionStatusResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// GET /committee/projects/:projectId/members
// ─────────────────────────────────────────────────────────────

/**
 * 企画メンバー一覧レスポンス
 */
export const listCommitteeProjectMembersResponseSchema = z.object({
	members: z.array(projectMemberSchema),
});
export type ListCommitteeProjectMembersResponse = z.infer<
	typeof listCommitteeProjectMembersResponseSchema
>;
