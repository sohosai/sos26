import {
	createMastersheetViewRequestSchema,
	mastersheetViewIdPathParamsSchema,
	updateMastersheetViewRequestSchema,
} from "@sos26/shared";
import { Hono } from "hono";
import { Errors } from "../../lib/error";
import { prisma } from "../../lib/prisma";
import { requireAuth, requireCommitteeMember } from "../../middlewares/auth";
import type { AuthEnv } from "../../types/auth-env";

export const viewsRoute = new Hono<AuthEnv>();

// ─────────────────────────────────────────────────────────────
// GET /committee/mastersheet/views
// ─────────────────────────────────────────────────────────────

viewsRoute.get("/views", requireAuth, requireCommitteeMember, async c => {
	const userId = c.get("user").id;

	const views = await prisma.mastersheetView.findMany({
		where: { createdById: userId },
		orderBy: { createdAt: "asc" },
	});

	return c.json({ views });
});

// ─────────────────────────────────────────────────────────────
// POST /committee/mastersheet/views
// ─────────────────────────────────────────────────────────────

viewsRoute.post("/views", requireAuth, requireCommitteeMember, async c => {
	const userId = c.get("user").id;
	const body = await c.req.json().catch(() => ({}));
	const data = createMastersheetViewRequestSchema.parse(body);

	const view = await prisma.mastersheetView.create({
		data: { ...data, createdById: userId },
	});

	return c.json({ view }, 201);
});

// ─────────────────────────────────────────────────────────────
// PATCH /committee/mastersheet/views/:viewId
// ─────────────────────────────────────────────────────────────

viewsRoute.patch(
	"/views/:viewId",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const userId = c.get("user").id;
		const { viewId } = mastersheetViewIdPathParamsSchema.parse(c.req.param());
		const body = await c.req.json().catch(() => ({}));
		const data = updateMastersheetViewRequestSchema.parse(body);

		const view = await prisma.mastersheetView.findUnique({
			where: { id: viewId },
		});
		if (!view) throw Errors.notFound("ビューが見つかりません");
		if (view.createdById !== userId)
			throw Errors.forbidden("自分のビューのみ更新できます");

		const updated = await prisma.mastersheetView.update({
			where: { id: viewId },
			data: {
				...(data.name !== undefined && { name: data.name }),
				...(data.state !== undefined && { state: data.state }),
			},
		});

		return c.json({ view: updated });
	}
);

// ─────────────────────────────────────────────────────────────
// DELETE /committee/mastersheet/views/:viewId
// ─────────────────────────────────────────────────────────────

viewsRoute.delete(
	"/views/:viewId",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const userId = c.get("user").id;
		const { viewId } = mastersheetViewIdPathParamsSchema.parse(c.req.param());

		const view = await prisma.mastersheetView.findUnique({
			where: { id: viewId },
		});
		if (!view) throw Errors.notFound("ビューが見つかりません");
		if (view.createdById !== userId)
			throw Errors.forbidden("自分のビューのみ削除できます");

		await prisma.mastersheetView.delete({ where: { id: viewId } });

		return c.json({ success: true as const });
	}
);
