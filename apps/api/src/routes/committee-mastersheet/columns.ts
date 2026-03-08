import {
	createMastersheetColumnRequestSchema,
	mastersheetColumnIdPathParamsSchema,
	updateMastersheetColumnRequestSchema,
} from "@sos26/shared";
import { Hono } from "hono";
import { Errors } from "../../lib/error";
import { prisma } from "../../lib/prisma";
import { requireAuth, requireCommitteeMember } from "../../middlewares/auth";
import type { AuthEnv } from "../../types/auth-env";
import {
	type ColumnFull,
	canViewColumn,
	formatColumnDef,
	getAccessibleFormIds,
	requireColumnOwner,
	syncColumnOptions,
	syncColumnViewers,
} from "./helpers";

export const columnsRoute = new Hono<AuthEnv>();

// ─────────────────────────────────────────────────────────────
// POST /committee/mastersheet/columns
// ─────────────────────────────────────────────────────────────

columnsRoute.post("/columns", requireAuth, requireCommitteeMember, async c => {
	const userId = c.get("user").id;
	const body = await c.req.json().catch(() => ({}));
	const data = createMastersheetColumnRequestSchema.parse(body);

	if (data.type === "FORM_ITEM") {
		// フォームへのアクセス権チェック
		const formItem = await prisma.formItem.findUnique({
			where: { id: data.formItemId },
			include: {
				form: {
					include: { collaborators: { where: { deletedAt: null } } },
				},
			},
		});
		if (!formItem) throw Errors.notFound("フォーム項目が見つかりません");

		const form = formItem.form;
		const hasAccess =
			form.ownerId === userId ||
			form.collaborators.some(col => col.userId === userId);
		if (!hasAccess)
			throw Errors.forbidden("このフォームへのアクセス権がありません");

		const existing = await prisma.mastersheetColumn.findUnique({
			where: { formItemId: data.formItemId },
		});
		if (existing)
			throw Errors.alreadyExists("このフォーム項目のカラムは既に存在します");

		const col = await prisma.mastersheetColumn.create({
			data: {
				type: "FORM_ITEM",
				name: data.name,
				description: data.description ?? null,
				sortOrder: data.sortOrder,
				createdById: userId,
				formItemId: data.formItemId,
			},
			include: {
				formItem: {
					select: {
						id: true,
						formId: true,
						type: true,
						options: {
							orderBy: { sortOrder: "asc" as const },
							select: { id: true, label: true, sortOrder: true },
						},
					},
				},
				options: {
					orderBy: { sortOrder: "asc" },
					select: { id: true, label: true, sortOrder: true },
				},
				createdBy: { select: { name: true } },
				viewers: { include: { user: { select: { name: true } } } },
			},
		});

		return c.json({ column: formatColumnDef(col, userId) }, 201);
	}

	// CUSTOM
	const visibility = data.viewers.length > 0 ? "PUBLIC" : "PRIVATE";
	const col = await prisma.$transaction(
		async tx => {
			const created = await tx.mastersheetColumn.create({
				data: {
					type: "CUSTOM",
					name: data.name,
					description: data.description ?? null,
					sortOrder: data.sortOrder,
					createdById: userId,
					dataType: data.dataType,
					visibility,
					options: data.options?.length ? { create: data.options } : undefined,
				},
			});
			if (data.viewers.length > 0) {
				await tx.mastersheetColumnViewer.createMany({
					data: data.viewers.map(v => ({
						columnId: created.id,
						scope: v.scope,
						bureauValue: v.bureauValue ?? null,
						userId: v.userId ?? null,
					})),
				});
			}
			return tx.mastersheetColumn.findUniqueOrThrow({
				where: { id: created.id },
				include: {
					formItem: {
						select: {
							id: true,
							formId: true,
							type: true,
							options: {
								orderBy: { sortOrder: "asc" as const },
								select: { id: true, label: true, sortOrder: true },
							},
						},
					},
					options: {
						orderBy: { sortOrder: "asc" },
						select: { id: true, label: true, sortOrder: true },
					},
					createdBy: { select: { name: true } },
					viewers: { include: { user: { select: { name: true } } } },
				},
			});
		},
		{ isolationLevel: "Serializable" }
	);

	return c.json({ column: formatColumnDef(col, userId) }, 201);
});

// ─────────────────────────────────────────────────────────────
// PATCH /committee/mastersheet/columns/:columnId
// ─────────────────────────────────────────────────────────────

columnsRoute.patch(
	"/columns/:columnId",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const userId = c.get("user").id;
		const { columnId } = mastersheetColumnIdPathParamsSchema.parse(
			c.req.param()
		);
		await requireColumnOwner(columnId, userId);

		const body = await c.req.json().catch(() => ({}));
		const data = updateMastersheetColumnRequestSchema.parse(body);
		const { viewers, options, ...columnFields } = data;

		const col = await prisma.$transaction(
			async tx => {
				const visibility =
					viewers !== undefined
						? viewers.length > 0
							? "PUBLIC"
							: "PRIVATE"
						: undefined;

				await tx.mastersheetColumn.update({
					where: { id: columnId },
					data: {
						...columnFields,
						...(visibility !== undefined ? { visibility } : {}),
					},
				});

				if (viewers !== undefined) {
					await syncColumnViewers(tx, columnId, viewers);
				}

				if (options !== undefined) {
					await syncColumnOptions(tx, columnId, options);
				}

				return tx.mastersheetColumn.findUniqueOrThrow({
					where: { id: columnId },
					include: {
						formItem: {
							select: {
								id: true,
								formId: true,
								type: true,
								options: {
									orderBy: { sortOrder: "asc" as const },
									select: { id: true, label: true, sortOrder: true },
								},
							},
						},
						options: {
							orderBy: { sortOrder: "asc" },
							select: { id: true, label: true, sortOrder: true },
						},
						createdBy: { select: { name: true } },
						viewers: { include: { user: { select: { name: true } } } },
					},
				});
			},
			{ isolationLevel: "Serializable" }
		);

		return c.json({ column: formatColumnDef(col, userId) });
	}
);

// ─────────────────────────────────────────────────────────────
// DELETE /committee/mastersheet/columns/:columnId
// ─────────────────────────────────────────────────────────────

columnsRoute.delete(
	"/columns/:columnId",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const userId = c.get("user").id;
		const { columnId } = mastersheetColumnIdPathParamsSchema.parse(
			c.req.param()
		);
		await requireColumnOwner(columnId, userId);

		await prisma.mastersheetColumn.delete({ where: { id: columnId } });

		return c.json({ success: true as const });
	}
);

// ─────────────────────────────────────────────────────────────
// GET /committee/mastersheet/columns/discover
// PUBLIC カラム全件 + 自分の PRIVATE カラム
// ─────────────────────────────────────────────────────────────

columnsRoute.get(
	"/columns/discover",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const userId = c.get("user").id;
		const committeeMember = c.get("committeeMember");

		const columns = await prisma.mastersheetColumn.findMany({
			where: {
				OR: [
					{ visibility: "PUBLIC" },
					{ createdById: userId },
					// FORM_ITEM はアクセス権があれば表示
					{ type: "FORM_ITEM" },
				],
			},
			include: {
				formItem: {
					select: {
						id: true,
						formId: true,
						type: true,
						options: {
							orderBy: { sortOrder: "asc" as const },
							select: { id: true, label: true, sortOrder: true },
						},
					},
				},
				options: {
					orderBy: { sortOrder: "asc" },
					select: { id: true, label: true, sortOrder: true },
				},
				viewers: { include: { user: { select: { name: true } } } },
				createdBy: { select: { name: true } },
				accessRequests: {
					where: { requesterId: userId, status: "PENDING" },
					select: { id: true },
				},
			},
			orderBy: { createdAt: "asc" },
		});

		const accessibleFormIds = await getAccessibleFormIds(userId);

		return c.json({
			columns: columns.map(col => {
				const hasAccess = canViewColumn(
					col as ColumnFull,
					userId,
					committeeMember,
					accessibleFormIds
				);
				const pendingRequest = col.accessRequests.length > 0;

				const base = {
					id: col.id,
					name: col.name,
					type: col.type,
					createdById: col.createdById,
					createdByName: col.createdBy.name,
					hasAccess,
					pendingRequest,
				};

				if (!hasAccess) return base;

				return {
					...base,
					description: col.description,
					dataType: col.dataType,
					visibility: col.visibility,
				};
			}),
		});
	}
);
