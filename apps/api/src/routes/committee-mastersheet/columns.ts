import {
	createMastersheetColumnRequestSchema,
	type InitialValueInput,
	type MastersheetDataType,
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
	getAccessiblePrfFormIds,
	requireColumnOwner,
	syncColumnOptions,
	syncColumnViewers,
	type TxClient,
} from "./helpers";

export const columnsRoute = new Hono<AuthEnv>();

/** 初期値とデータ型の整合性を検証する */
function validateInitialValueForDataType(
	initialValue: InitialValueInput,
	dataType: MastersheetDataType
) {
	if (
		(dataType === "TEXT" || dataType === "NUMBER") &&
		initialValue.selectedOptionIndexes?.length
	) {
		throw Errors.invalidRequest(
			"テキスト・数値カラムに選択肢の初期値は指定できません"
		);
	}
	if (
		(dataType === "SELECT" || dataType === "MULTI_SELECT") &&
		(initialValue.textValue != null || initialValue.numberValue != null)
	) {
		throw Errors.invalidRequest(
			"選択カラムにテキスト・数値の初期値は指定できません"
		);
	}
	if (dataType === "TEXT" && initialValue.numberValue != null) {
		throw Errors.invalidRequest("テキストカラムに数値の初期値は指定できません");
	}
	if (dataType === "NUMBER" && initialValue.textValue != null) {
		throw Errors.invalidRequest("数値カラムにテキストの初期値は指定できません");
	}
}

/** 初期値を全企画のセルに一括適用する */
async function applyInitialValue(
	tx: TxClient,
	columnId: string,
	initialValue: InitialValueInput
) {
	const projects = await tx.project.findMany({
		where: { deletedAt: null },
		select: { id: true },
	});
	if (projects.length === 0) return;

	// SELECT/MULTI_SELECT の場合、作成されたオプションの ID を取得
	const resolvedOptionIds: string[] = [];
	if (initialValue.selectedOptionIndexes?.length) {
		const createdOptions = await tx.mastersheetColumnOption.findMany({
			where: { columnId },
			orderBy: { sortOrder: "asc" },
			select: { id: true },
		});
		for (const idx of initialValue.selectedOptionIndexes) {
			const opt = createdOptions[idx];
			if (!opt) {
				throw Errors.invalidRequest(`選択肢インデックス ${idx} が範囲外です`);
			}
			resolvedOptionIds.push(opt.id);
		}
	}

	// セル値を一括作成
	await tx.mastersheetCellValue.createMany({
		data: projects.map(p => ({
			columnId,
			projectId: p.id,
			textValue: initialValue.textValue ?? null,
			numberValue: initialValue.numberValue ?? null,
		})),
	});

	// SELECT/MULTI_SELECT の選択肢を一括作成
	if (resolvedOptionIds.length > 0) {
		const cells = await tx.mastersheetCellValue.findMany({
			where: { columnId },
			select: { id: true },
		});
		await tx.mastersheetCellSelectedOption.createMany({
			data: cells.flatMap(cell =>
				resolvedOptionIds.map(optionId => ({
					cellId: cell.id,
					optionId,
				}))
			),
		});
	}
}

// ─────────────────────────────────────────────────────────────
// ヘルパー: カラム作成時の include 共通定義
// ─────────────────────────────────────────────────────────────

const columnCreateInclude = {
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
	projectRegistrationFormItem: {
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
		orderBy: { sortOrder: "asc" as const },
		select: { id: true, label: true, sortOrder: true },
	},
	createdBy: { select: { name: true } },
	viewers: { include: { user: { select: { name: true } } } },
} as const;

/** FORM_ITEM カラムを作成する */
async function createFormItemColumn(
	data: {
		formItemId: string;
		name: string;
		description?: string | null;
		sortOrder: number;
	},
	userId: string
) {
	const formItem = await prisma.formItem.findUnique({
		where: { id: data.formItemId },
		include: {
			form: {
				include: { collaborators: { where: { deletedAt: null } } },
			},
		},
	});
	if (!formItem) throw Errors.notFound("申請項目が見つかりません");

	const form = formItem.form;
	const hasAccess =
		form.ownerId === userId ||
		form.collaborators.some(col => col.userId === userId);
	if (!hasAccess) throw Errors.forbidden("この申請へのアクセス権がありません");

	const existing = await prisma.mastersheetColumn.findUnique({
		where: { formItemId: data.formItemId },
	});
	if (existing)
		throw Errors.alreadyExists("この申請項目のカラムは既に存在します");

	return prisma.mastersheetColumn.create({
		data: {
			type: "FORM_ITEM",
			name: data.name,
			description: data.description ?? null,
			sortOrder: data.sortOrder,
			createdById: userId,
			formItemId: data.formItemId,
		},
		include: columnCreateInclude,
	});
}

/** PROJECT_REGISTRATION_FORM_ITEM カラムを作成する */
async function createPrfItemColumn(
	data: {
		projectRegistrationFormItemId: string;
		name: string;
		description?: string | null;
		sortOrder: number;
	},
	userId: string
) {
	const prfItem = await prisma.projectRegistrationFormItem.findUnique({
		where: { id: data.projectRegistrationFormItemId },
		include: {
			form: {
				include: { collaborators: { where: { deletedAt: null } } },
			},
		},
	});
	if (!prfItem) throw Errors.notFound("企画登録申請項目が見つかりません");

	const form = prfItem.form;
	const hasAccess =
		form.ownerId === userId ||
		form.collaborators.some(col => col.userId === userId);
	if (!hasAccess)
		throw Errors.forbidden("この企画登録申請へのアクセス権がありません");

	const existing = await prisma.mastersheetColumn.findUnique({
		where: {
			projectRegistrationFormItemId: data.projectRegistrationFormItemId,
		},
	});
	if (existing)
		throw Errors.alreadyExists("この企画登録申請項目のカラムは既に存在します");

	return prisma.mastersheetColumn.create({
		data: {
			type: "PROJECT_REGISTRATION_FORM_ITEM",
			name: data.name,
			description: data.description ?? null,
			sortOrder: data.sortOrder,
			createdById: userId,
			projectRegistrationFormItemId: data.projectRegistrationFormItemId,
		},
		include: columnCreateInclude,
	});
}

// ─────────────────────────────────────────────────────────────
// POST /committee/mastersheet/columns
// ─────────────────────────────────────────────────────────────

columnsRoute.post("/columns", requireAuth, requireCommitteeMember, async c => {
	const userId = c.get("user").id;
	const body = await c.req.json().catch(() => ({}));
	const data = createMastersheetColumnRequestSchema.parse(body);

	if (data.type === "FORM_ITEM") {
		const col = await createFormItemColumn(data, userId);
		return c.json({ column: formatColumnDef(col, userId) }, 201);
	}

	if (data.type === "PROJECT_REGISTRATION_FORM_ITEM") {
		const col = await createPrfItemColumn(data, userId);
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

			// 初期値が指定されている場合、全企画にセルを一括作成
			if (data.initialValue) {
				validateInitialValueForDataType(data.initialValue, data.dataType);
				await applyInitialValue(tx, created.id, data.initialValue);
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
					projectRegistrationFormItem: {
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
						projectRegistrationFormItem: {
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
					// FORM_ITEM / PROJECT_REGISTRATION_FORM_ITEM はアクセス権があれば表示
					{ type: "FORM_ITEM" },
					{ type: "PROJECT_REGISTRATION_FORM_ITEM" },
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
				projectRegistrationFormItem: {
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
		const accessiblePrfFormIds = await getAccessiblePrfFormIds(userId);

		return c.json({
			columns: columns.map(col => {
				const hasAccess = canViewColumn(
					col as ColumnFull,
					userId,
					committeeMember,
					accessibleFormIds,
					accessiblePrfFormIds
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
