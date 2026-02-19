import { z } from "zod";
import {
	projectMemberSchema,
	projectSchema,
	projectTypeSchema,
} from "./project";
import { userSchema } from "./user";

// ─────────────────────────────────────────────────────────────
// 共通
// ─────────────────────────────────────────────────────────────

/** owner/subOwner 用のユーザーサマリー */
const userSummarySchema = userSchema.pick({
	id: true,
	name: true,
	email: true,
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
