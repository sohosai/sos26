import { z } from "zod";
import {
	projectMemberSchema,
	projectSchema,
	projectTypeSchema,
} from "./project";
import { userSchema } from "./user";

// ─────────────────────────────────────────────────────────────
// GET /committee/projects
// ─────────────────────────────────────────────────────────────

/**
 * 企画一覧クエリパラメータ
 */
export const listCommitteeProjectsQuerySchema = z.object({
	type: projectTypeSchema.optional(),
	search: z.string().optional(),
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListCommitteeProjectsQuery = z.infer<
	typeof listCommitteeProjectsQuerySchema
>;

/**
 * 企画サマリー（一覧用）
 */
export const committeeProjectSummarySchema = projectSchema.extend({
	memberCount: z.number().int(),
	ownerName: z.string(),
});
export type CommitteeProjectSummary = z.infer<
	typeof committeeProjectSummarySchema
>;

/**
 * 企画一覧レスポンス
 */
export const listCommitteeProjectsResponseSchema = z.object({
	projects: z.array(committeeProjectSummarySchema),
	total: z.number().int(),
	page: z.number().int(),
	limit: z.number().int(),
});
export type ListCommitteeProjectsResponse = z.infer<
	typeof listCommitteeProjectsResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// GET /committee/projects/:projectId
// ─────────────────────────────────────────────────────────────

/**
 * 企画詳細（owner/subOwner情報含む）
 */
export const committeeProjectDetailSchema = projectSchema.extend({
	memberCount: z.number().int(),
	owner: userSchema,
	subOwner: userSchema.nullable(),
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
