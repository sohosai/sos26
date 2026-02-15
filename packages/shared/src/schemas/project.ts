import { z } from "zod";

export const projectTypeSchema = z.enum(["STAGE", "FOOD", "NORMAL"]);
export type ProjectType = z.infer<typeof projectTypeSchema>;

export const projectSchema = z.object({
	id: z.cuid(),
	name: z.string().min(1),
	namePhonetic: z.string().min(1),
	organizationName: z.string().min(1),
	organizationNamePhonetic: z.string().min(1),
	type: projectTypeSchema,
	ownerId: z.string().min(1),
	subOwnerId: z.string().nullable(),
	inviteCode: z.string().length(6),
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

// 同じプロジェクトのメンバーに公開される情報を想定するが、最低限の情報に絞る
export const projectMemberSchema = z.object({
	id: z.string(),
	userId: z.string(),
	name: z.string(),
	role: projectMemberRoleSchema,
	joinedAt: z.coerce.date(),
});
export type ProjectMember = z.infer<typeof projectMemberSchema>;

// ─────────────────────────────────────────────────────────────
// POST /projects/suscribe
// ─────────────────────────────────────────────────────────────

export const createProjectRequestSchema = z.object({
	name: z.string().min(1),
	namePhonetic: z.string().min(1),
	organizationName: z.string().min(1),
	organizationNamePhonetic: z.string().min(1),
	type: projectTypeSchema,
});

export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>;

export const createProjectResponseSchema = z.object({
	project: projectSchema,
});

export type CreateProjectResponse = z.infer<typeof createProjectResponseSchema>;

// ─────────────────────────────────────────────────────────────
// GET /projects
// ─────────────────────────────────────────────────────────────

export const listMyProjectsResponseSchema = z.object({
	projects: z.array(projectSchema),
});

export type ListMyProjectsResponse = z.infer<
	typeof listMyProjectsResponseSchema
>;

// ─────────────────────────────────────────────────────────────
// GET /projects/:projectId/members
// ─────────────────────────────────────────────────────────────

export const listProjectMembersResponseSchema = z.object({
	members: z.array(projectMemberSchema),
});

export type ListProjectMembersResponse = z.infer<
	typeof listProjectMembersResponseSchema
>;
