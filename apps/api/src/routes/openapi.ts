import { swaggerUI } from "@hono/swagger-ui";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { projectPublicInfoSchema } from "@sos26/shared";
import { prisma } from "../lib/prisma";

export const openApiRoute = new OpenAPIHono();

const publicProjectListResponseSchema = z.array(
	z.object({
		id: z.string(),
		name: z.string(),
		organizationName: z.string(),
		type: z.enum(["STAGE", "FOOD", "NORMAL"]),
		location: z.enum(["INDOOR", "OUTDOOR", "STAGE"]),
		publicInfo: projectPublicInfoSchema.nullable(),
	})
);

const getProjectsRoute = createRoute({
	method: "get",
	path: "/projects",
	responses: {
		200: {
			content: {
				"application/json": {
					schema: publicProjectListResponseSchema,
				},
			},
			description: "企画の情報（一覧）",
		},
	},
});

openApiRoute.openapi(getProjectsRoute, async c => {
	const projects = await prisma.project.findMany({
		where: { deletedAt: null, deletionStatus: null },
		include: {
			publicInfo: {
				include: {
					mapImages: { orderBy: { sortOrder: "asc" } },
				},
			},
		},
	});

	const response = projects.map(p => ({
		id: p.id,
		name: p.name,
		organizationName: p.organizationName,
		type: p.type,
		location: p.location,
		publicInfo: p.publicInfo
			? {
					description: p.publicInfo.description,
					iconFileId: p.publicInfo.iconFileId,
					mapImageFileIds: p.publicInfo.mapImages.map(img => img.fileId),
					openStatus: p.publicInfo.openStatus,
					stockStatus: p.publicInfo.stockStatus,
				}
			: null,
	}));

	return c.json(response, 200);
});

const getProjectDetailRoute = createRoute({
	method: "get",
	path: "/projects/{id}",
	request: {
		params: z.object({
			id: z.string().openapi({ param: { name: "id", in: "path" } }),
		}),
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: publicProjectListResponseSchema.element,
				},
			},
			description: "企画の情報（個別）",
		},
		404: {
			description: "Project not found",
		},
	},
});

openApiRoute.openapi(getProjectDetailRoute, async c => {
	const id = c.req.valid("param").id;
	const project = await prisma.project.findFirst({
		where: { id, deletedAt: null, deletionStatus: null },
		include: {
			publicInfo: {
				include: {
					mapImages: { orderBy: { sortOrder: "asc" } },
				},
			},
		},
	});

	if (!project) {
		return c.notFound();
	}

	const response = {
		id: project.id,
		name: project.name,
		organizationName: project.organizationName,
		type: project.type,
		location: project.location,
		publicInfo: project.publicInfo
			? {
					description: project.publicInfo.description,
					iconFileId: project.publicInfo.iconFileId,
					mapImageFileIds: project.publicInfo.mapImages.map(img => img.fileId),
					openStatus: project.publicInfo.openStatus,
					stockStatus: project.publicInfo.stockStatus,
				}
			: null,
	};

	return c.json(response, 200);
});

openApiRoute.doc("/openapi.json", {
	openapi: "3.0.0",
	info: {
		title: "sos26 Public API",
		version: "1.0.0",
		description: "雙峰祭オンラインマップにデータ連携をするためのAPI",
	},
});

openApiRoute.get("/swagger", swaggerUI({ url: "/openapi/openapi.json" }));
