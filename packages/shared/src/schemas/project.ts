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

export const listMyProjectsResponseSchema = z.object({
	projects: z.array(projectSchema),
});

export type ListMyProjectsResponse = z.infer<
	typeof listMyProjectsResponseSchema
>;
