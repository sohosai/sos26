import type { CommitteeMember, Prisma } from "@prisma/client";
import {
	createMastersheetColumnRequestSchema,
	createMastersheetViewRequestSchema,
	editFormItemCellRequestSchema,
	mastersheetAccessRequestIdPathParamsSchema,
	mastersheetColumnIdPathParamsSchema,
	mastersheetColumnProjectPathParamsSchema,
	mastersheetViewIdPathParamsSchema,
	updateMastersheetAccessRequestRequestSchema,
	updateMastersheetColumnRequestSchema,
	updateMastersheetViewRequestSchema,
	upsertMastersheetCellRequestSchema,
} from "@sos26/shared";
import { Hono } from "hono";
import { Errors } from "../lib/error";
import { prisma } from "../lib/prisma";
import { requireAuth, requireCommitteeMember } from "../middlewares/auth";
import type { AuthEnv } from "../types/auth-env";

const committeeMastersheetRoute = new Hono<AuthEnv>();

// ─────────────────────────────────────────────────────────────
// データ取得・権限チェックヘルパー
// ─────────────────────────────────────────────────────────────

/** カラムをリレーション込みで取得（存在しない場合は 404） */
const getColumnFull = async (columnId: string) => {
	const col = await prisma.mastersheetColumn.findFirst({
		where: { id: columnId },
		include: {
			formItem: {
				select: {
					id: true,
					formId: true,
					type: true,
					options: {
						orderBy: { sortOrder: "asc" },
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
	if (!col) throw Errors.notFound("カラムが見つかりません");
	return col;
};

type ColumnFull = Awaited<ReturnType<typeof getColumnFull>>;

/** 自分がアクセス可能なフォーム ID セットを返す */
const getAccessibleFormIds = async (userId: string) => {
	const forms = await prisma.form.findMany({
		where: {
			deletedAt: null,
			OR: [
				{ ownerId: userId },
				{ collaborators: { some: { userId, deletedAt: null } } },
			],
		},
		select: { id: true },
	});
	return new Set(forms.map(f => f.id));
};

/** カラム閲覧権チェック（accessibleFormIds はバッチ取得済みのものを渡す） */
function canViewColumn(
	col: ColumnFull,
	userId: string,
	committeeMember: CommitteeMember,
	accessibleFormIds: Set<string>
): boolean {
	if (col.type === "FORM_ITEM") {
		return col.formItem !== null && accessibleFormIds.has(col.formItem.formId);
	}
	// CUSTOM
	if (col.createdById === userId) return true;
	if (col.visibility !== "PUBLIC") return false;
	for (const v of col.viewers) {
		if (v.scope === "ALL") return true;
		if (v.scope === "BUREAU" && v.bureauValue === committeeMember.Bureau)
			return true;
		if (v.scope === "INDIVIDUAL" && v.userId === userId) return true;
	}
	return false;
}

/** カラム管理者（作成者）チェック */
const requireColumnOwner = async (columnId: string, userId: string) => {
	const col = await getColumnFull(columnId);
	if (col.createdById !== userId)
		throw Errors.forbidden("この操作は作成者のみ行えます");
	return col;
};

// ─────────────────────────────────────────────────────────────
// レスポンス整形ヘルパー
// ─────────────────────────────────────────────────────────────

function formatColumnDef(col: ColumnFull, userId: string) {
	return {
		id: col.id,
		type: col.type,
		name: col.name,
		description: col.description,
		sortOrder: col.sortOrder,
		createdById: col.createdById,
		createdByName: col.createdBy.name,
		isOwner: col.createdById === userId,
		formItemId: col.formItemId,
		formItemType: col.formItem?.type ?? null,
		dataType: col.dataType,
		visibility: col.visibility,
		viewers: col.viewers.map(v => ({
			id: v.id,
			scope: v.scope,
			bureauValue: v.bureauValue,
			userId: v.userId,
			userName: v.user?.name ?? null,
		})),
		options:
			col.type === "FORM_ITEM" && col.formItem?.options?.length
				? col.formItem.options
				: col.options,
		createdAt: col.createdAt,
	};
}

function computeCellStatus(
	deliveryId: string | undefined,
	response: { submittedAt: Date | null } | undefined,
	latestHistory: { trigger: string } | undefined
) {
	if (!deliveryId) return "NOT_DELIVERED" as const;
	if (!response?.submittedAt && !latestHistory) return "NOT_ANSWERED" as const;
	if (latestHistory?.trigger === "COMMITTEE_EDIT")
		return "COMMITTEE_EDITED" as const;
	return "SUBMITTED" as const;
}

// ─────────────────────────────────────────────────────────────
// データ組み立てヘルパー（複雑度分散のためモジュールレベルに定義）
// ─────────────────────────────────────────────────────────────

type FormResponseWithAnswers = Prisma.FormResponseGetPayload<{
	include: {
		answers: {
			include: { selectedOptions: { select: { formItemOptionId: true } } };
		};
	};
}>;

type HistoryWithOptions = Prisma.FormItemEditHistoryGetPayload<{
	include: {
		selectedOptions: { select: { formItemOptionId: true } };
	};
}>;

function buildFormItemCell(
	colId: string,
	formItem: { id: string; formId: string },
	projectId: string,
	deliveryByFormProject: Map<string, Map<string, string>>,
	responseByDelivery: Map<string, FormResponseWithAnswers>,
	answerByResponseItem: Map<
		string,
		Map<string, FormResponseWithAnswers["answers"][0]>
	>,
	latestHistoryByCell: Map<string, HistoryWithOptions>
) {
	const deliveryId = deliveryByFormProject.get(formItem.formId)?.get(projectId);
	const response = deliveryId ? responseByDelivery.get(deliveryId) : undefined;
	const historyKey = `${formItem.id}:${projectId}`;
	const latestHistory = latestHistoryByCell.get(historyKey);
	const status = computeCellStatus(deliveryId, response, latestHistory);

	// 表示値: 履歴があれば履歴の値、なければ FormAnswer
	if (latestHistory) {
		return {
			columnId: colId,
			status,
			formValue: {
				textValue: latestHistory.textValue,
				numberValue: latestHistory.numberValue,
				fileUrl: latestHistory.fileUrl,
				selectedOptionIds: latestHistory.selectedOptions.map(
					s => s.formItemOptionId
				),
			},
		};
	}

	const answer = response?.submittedAt
		? answerByResponseItem.get(response.id)?.get(formItem.id)
		: undefined;
	const formValue = answer
		? {
				textValue: answer.textValue,
				numberValue: answer.numberValue,
				fileUrl: answer.fileUrl,
				selectedOptionIds: answer.selectedOptions.map(s => s.formItemOptionId),
			}
		: null;
	return {
		columnId: colId,
		status,
		formValue,
	};
}

// ─────────────────────────────────────────────────────────────
// GET /committee/mastersheet/data
// ─────────────────────────────────────────────────────────────

committeeMastersheetRoute.get(
	"/data",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const userId = c.get("user").id;
		const committeeMember = c.get("committeeMember");

		// 1. カラム一覧 + 権限フィルタ
		const allColumns = await prisma.mastersheetColumn.findMany({
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
			orderBy: { sortOrder: "asc" },
		});

		const accessibleFormIds = await getAccessibleFormIds(userId);
		const visibleColumns = allColumns.filter(col =>
			canViewColumn(
				col as ColumnFull,
				userId,
				committeeMember,
				accessibleFormIds
			)
		);

		const formItemCols = visibleColumns.filter(c => c.type === "FORM_ITEM");
		const customCols = visibleColumns.filter(c => c.type === "CUSTOM");

		// 2. 企画一覧
		const projects = await prisma.project.findMany({
			where: { deletedAt: null },
			include: {
				owner: { select: { id: true, name: true } },
				subOwner: { select: { id: true, name: true } },
			},
			orderBy: { number: "asc" },
		});

		// 3. FORM_ITEM: 配信・回答・オーバーライドをバッチ取得
		const visibleFormIds = [
			...new Set(
				formItemCols.flatMap(c => (c.formItem ? [c.formItem.formId] : []))
			),
		];

		const deliveries = visibleFormIds.length
			? await prisma.formDelivery.findMany({
					where: {
						formAuthorization: {
							formId: { in: visibleFormIds },
							status: "APPROVED",
						},
					},
					include: { formAuthorization: { select: { formId: true } } },
				})
			: [];

		// deliveryByFormProject: formId → projectId → deliveryId
		const deliveryByFormProject = new Map<string, Map<string, string>>();
		for (const d of deliveries) {
			const fid = d.formAuthorization.formId;
			if (!deliveryByFormProject.has(fid))
				deliveryByFormProject.set(fid, new Map());
			deliveryByFormProject.get(fid)?.set(d.projectId, d.id);
		}

		const deliveryIds = deliveries.map(d => d.id);
		const responses = deliveryIds.length
			? await prisma.formResponse.findMany({
					where: { formDeliveryId: { in: deliveryIds } },
					include: {
						answers: {
							include: {
								selectedOptions: { select: { formItemOptionId: true } },
							},
						},
					},
				})
			: [];

		const responseByDelivery = new Map(
			responses.map(r => [r.formDeliveryId, r])
		);
		const answerByResponseItem = new Map<
			string,
			Map<string, (typeof responses)[0]["answers"][0]>
		>();
		for (const r of responses) {
			answerByResponseItem.set(
				r.id,
				new Map(r.answers.map(a => [a.formItemId, a]))
			);
		}

		// FormItemEditHistory: 最新の履歴を取得
		const formItemIds = formItemCols
			.flatMap(c => (c.formItem ? [c.formItem.id] : []))
			.filter((id, i, arr) => arr.indexOf(id) === i);
		const allHistory = formItemIds.length
			? await prisma.formItemEditHistory.findMany({
					where: { formItemId: { in: formItemIds } },
					orderBy: { createdAt: "desc" },
					include: {
						selectedOptions: { select: { formItemOptionId: true } },
					},
				})
			: [];

		const latestHistoryByCell = new Map<string, (typeof allHistory)[0]>();
		for (const h of allHistory) {
			const key = `${h.formItemId}:${h.projectId}`;
			if (!latestHistoryByCell.has(key)) latestHistoryByCell.set(key, h);
		}

		// 4. CUSTOM: セル値をバッチ取得
		const customColIds = customCols.map(c => c.id);
		const cellValues = customColIds.length
			? await prisma.mastersheetCellValue.findMany({
					where: { columnId: { in: customColIds } },
					include: { selectedOptions: { select: { optionId: true } } },
				})
			: [];

		const cellByColProject = new Map<
			string,
			Map<string, (typeof cellValues)[0]>
		>();
		for (const cv of cellValues) {
			if (!cellByColProject.has(cv.columnId))
				cellByColProject.set(cv.columnId, new Map());
			cellByColProject.get(cv.columnId)?.set(cv.projectId, cv);
		}

		// 5. レスポンス組み立て
		const rows = projects.map(project => {
			const cells = visibleColumns.map(col => {
				if (col.type === "FORM_ITEM" && col.formItem) {
					return buildFormItemCell(
						col.id,
						col.formItem,
						project.id,
						deliveryByFormProject,
						responseByDelivery,
						answerByResponseItem,
						latestHistoryByCell
					);
				}
				// CUSTOM
				const cv = cellByColProject.get(col.id)?.get(project.id);
				return {
					columnId: col.id,
					cellValue: cv
						? {
								textValue: cv.textValue,
								numberValue: cv.numberValue,
								fileUrl: null,
								selectedOptionIds: cv.selectedOptions.map(s => s.optionId),
							}
						: null,
				};
			});

			return {
				project: {
					id: project.id,
					number: project.number,
					name: project.name,
					type: project.type,
					organizationName: project.organizationName,
					owner: project.owner,
					subOwner: project.subOwner ?? null,
				},
				cells,
			};
		});

		return c.json({
			columns: visibleColumns.map(col =>
				formatColumnDef(col as ColumnFull, userId)
			),
			rows,
		});
	}
);

// ─────────────────────────────────────────────────────────────
// POST /committee/mastersheet/columns
// ─────────────────────────────────────────────────────────────

committeeMastersheetRoute.post(
	"/columns",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const userId = c.get("user").id;
		const body = await c.req.json().catch(() => ({}));
		const data = createMastersheetColumnRequestSchema.parse(body);

		if (data.type === "FORM_ITEM") {
			// フォームへのアクセス権チェック
			const formItem = await prisma.formItem.findFirst({
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

			const existing = await prisma.mastersheetColumn.findFirst({
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
						options: data.options?.length
							? { create: data.options }
							: undefined,
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
	}
);

// ─────────────────────────────────────────────────────────────
// PATCH /committee/mastersheet/columns/:columnId
// ─────────────────────────────────────────────────────────────

committeeMastersheetRoute.patch(
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
		const { viewers, ...columnFields } = data;

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
					await tx.mastersheetColumnViewer.deleteMany({
						where: { columnId },
					});
					if (viewers.length > 0) {
						await tx.mastersheetColumnViewer.createMany({
							data: viewers.map(v => ({
								columnId,
								scope: v.scope,
								bureauValue: v.bureauValue ?? null,
								userId: v.userId ?? null,
							})),
						});
					}
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

committeeMastersheetRoute.delete(
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
// PUT /committee/mastersheet/cells/:columnId/:projectId
// 自由追加カラムのセル値を更新
// ─────────────────────────────────────────────────────────────

committeeMastersheetRoute.put(
	"/cells/:columnId/:projectId",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const userId = c.get("user").id;
		const committeeMember = c.get("committeeMember");
		const { columnId, projectId } =
			mastersheetColumnProjectPathParamsSchema.parse(c.req.param());

		const col = await getColumnFull(columnId);
		if (col.type !== "CUSTOM")
			throw Errors.invalidRequest("CUSTOM カラムのみセル値を編集できます");

		const accessibleFormIds = await getAccessibleFormIds(userId);
		if (!canViewColumn(col, userId, committeeMember, accessibleFormIds))
			throw Errors.forbidden("このカラムへのアクセス権がありません");

		const project = await prisma.project.findFirst({
			where: { id: projectId, deletedAt: null },
		});
		if (!project) throw Errors.notFound("企画が見つかりません");

		const body = await c.req.json().catch(() => ({}));
		const data = upsertMastersheetCellRequestSchema.parse(body);

		const cell = await prisma.$transaction(
			async tx => {
				const existing = await tx.mastersheetCellValue.findUnique({
					where: { columnId_projectId: { columnId, projectId } },
				});

				let cellId: string;
				if (existing) {
					await tx.mastersheetCellValue.update({
						where: { id: existing.id },
						data: {
							textValue: data.textValue ?? null,
							numberValue: data.numberValue ?? null,
						},
					});
					cellId = existing.id;
				} else {
					const created = await tx.mastersheetCellValue.create({
						data: {
							columnId,
							projectId,
							textValue: data.textValue ?? null,
							numberValue: data.numberValue ?? null,
						},
					});
					cellId = created.id;
				}

				// SELECT/MULTI_SELECT の選択肢を全置き換え
				if (data.selectedOptionIds !== undefined) {
					await tx.mastersheetCellSelectedOption.deleteMany({
						where: { cellId },
					});
					if (data.selectedOptionIds.length > 0) {
						await tx.mastersheetCellSelectedOption.createMany({
							data: data.selectedOptionIds.map(optionId => ({
								cellId,
								optionId,
							})),
						});
					}
				}

				return tx.mastersheetCellValue.findUniqueOrThrow({
					where: { id: cellId },
					include: { selectedOptions: { select: { optionId: true } } },
				});
			},
			{ isolationLevel: "Serializable" }
		);

		return c.json({
			cell: {
				columnId,
				cellValue: {
					textValue: cell.textValue,
					numberValue: cell.numberValue,
					fileUrl: null,
					selectedOptionIds: cell.selectedOptions.map(s => s.optionId),
				},
			},
		});
	}
);

// ─────────────────────────────────────────────────────────────
// PUT /committee/mastersheet/edits/:columnId/:projectId
// フォーム由来カラムの値を編集（FormItemEditHistory に COMMITTEE_EDIT を追加）
// ─────────────────────────────────────────────────────────────

committeeMastersheetRoute.put(
	"/edits/:columnId/:projectId",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const userId = c.get("user").id;
		const committeeMember = c.get("committeeMember");
		const { columnId, projectId } =
			mastersheetColumnProjectPathParamsSchema.parse(c.req.param());

		const col = await getColumnFull(columnId);
		if (col.type !== "FORM_ITEM")
			throw Errors.invalidRequest("FORM_ITEM カラムのみ編集できます");
		if (!col.formItemId)
			throw Errors.invalidRequest("フォーム項目が紐づいていません");

		const accessibleFormIds = await getAccessibleFormIds(userId);
		if (!canViewColumn(col, userId, committeeMember, accessibleFormIds))
			throw Errors.forbidden("このカラムへのアクセス権がありません");

		const project = await prisma.project.findFirst({
			where: { id: projectId, deletedAt: null },
		});
		if (!project) throw Errors.notFound("企画が見つかりません");

		const formItemId = col.formItemId;

		// NOT_ANSWERED（未提出 かつ 履歴なし）は編集不可
		const [response, latestHistory] = await Promise.all([
			prisma.formResponse.findFirst({
				where: {
					formDelivery: {
						projectId,
						formAuthorization: {
							form: { items: { some: { id: formItemId } } },
						},
					},
					submittedAt: { not: null },
				},
				select: { id: true },
			}),
			prisma.formItemEditHistory.findFirst({
				where: { formItemId, projectId },
				select: { id: true },
			}),
		]);
		if (!response && !latestHistory) {
			throw Errors.invalidRequest(
				"未回答の企画は編集できません。提出後に編集してください"
			);
		}

		const body = await c.req.json().catch(() => ({}));
		const data = editFormItemCellRequestSchema.parse(body);

		const history = await prisma.$transaction(
			async tx => {
				const created = await tx.formItemEditHistory.create({
					data: {
						formItemId,
						projectId,
						textValue: data.textValue ?? null,
						numberValue: data.numberValue ?? null,
						fileUrl: data.fileUrl ?? null,
						actorId: userId,
						trigger: "COMMITTEE_EDIT",
					},
				});

				if (data.selectedOptionIds?.length) {
					await tx.formItemEditHistorySelectedOption.createMany({
						data: data.selectedOptionIds.map(optionId => ({
							editHistoryId: created.id,
							formItemOptionId: optionId,
						})),
					});
				}

				return created;
			},
			{ isolationLevel: "Serializable" }
		);

		return c.json({
			cell: {
				columnId,
				status: "COMMITTEE_EDITED" as const,
				formValue: {
					textValue: history.textValue,
					numberValue: history.numberValue,
					fileUrl: history.fileUrl,
					selectedOptionIds: data.selectedOptionIds ?? [],
				},
			},
		});
	}
);

// ─────────────────────────────────────────────────────────────
// GET /committee/mastersheet/columns/:columnId/history/:projectId
// ─────────────────────────────────────────────────────────────

committeeMastersheetRoute.get(
	"/columns/:columnId/history/:projectId",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const userId = c.get("user").id;
		const committeeMember = c.get("committeeMember");
		const { columnId, projectId } =
			mastersheetColumnProjectPathParamsSchema.parse(c.req.param());

		const col = await getColumnFull(columnId);
		if (!col.formItemId)
			throw Errors.invalidRequest("フォーム項目が紐づいていません");

		const accessibleFormIds = await getAccessibleFormIds(userId);
		if (!canViewColumn(col, userId, committeeMember, accessibleFormIds))
			throw Errors.forbidden("このカラムへのアクセス権がありません");

		const history = await prisma.formItemEditHistory.findMany({
			where: { formItemId: col.formItemId, projectId },
			include: {
				actor: { select: { id: true, name: true } },
				selectedOptions: { select: { formItemOptionId: true } },
			},
			orderBy: { createdAt: "desc" },
		});

		return c.json({
			history: history.map(h => ({
				id: h.id,
				value: JSON.stringify({
					textValue: h.textValue,
					numberValue: h.numberValue,
					fileUrl: h.fileUrl,
					selectedOptionIds: h.selectedOptions.map(s => s.formItemOptionId),
				}),
				actor: h.actor,
				trigger: h.trigger,
				createdAt: h.createdAt,
			})),
		});
	}
);

// ─────────────────────────────────────────────────────────────
// GET /committee/mastersheet/columns/discover
// PUBLIC カラム全件 + 自分の PRIVATE カラム
// ─────────────────────────────────────────────────────────────

committeeMastersheetRoute.get(
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

// ─────────────────────────────────────────────────────────────
// POST /committee/mastersheet/columns/:columnId/access-request
// ─────────────────────────────────────────────────────────────

/** FORM_ITEM カラムへの閲覧申請（PENDING）を作成 */
async function createFormItemAccessRequest(
	columnId: string,
	formId: string,
	userId: string
) {
	const form = await prisma.form.findFirst({
		where: { id: formId, deletedAt: null },
		include: { collaborators: { where: { deletedAt: null } } },
	});
	if (!form) throw Errors.notFound("フォームが見つかりません");

	const hasAccess =
		form.ownerId === userId ||
		form.collaborators.some(c => c.userId === userId);
	if (hasAccess) throw Errors.alreadyExists("既にアクセス権があります");

	const pending = await prisma.mastersheetAccessRequest.findFirst({
		where: { columnId, requesterId: userId, status: "PENDING" },
	});
	if (pending) throw Errors.alreadyExists("既に申請中です");

	await prisma.mastersheetAccessRequest.create({
		data: { columnId, requesterId: userId, status: "PENDING" },
	});
}

/** CUSTOM カラムへの閲覧申請（PENDING）を作成 */
async function createCustomAccessRequest(
	col: ColumnFull,
	columnId: string,
	userId: string
) {
	if (col.createdById === userId)
		throw Errors.alreadyExists("既にアクセス権があります");

	const viewerEntry = col.viewers.find(
		v => v.scope === "ALL" || (v.scope === "INDIVIDUAL" && v.userId === userId)
	);
	if (viewerEntry) throw Errors.alreadyExists("既にアクセス権があります");

	const pending = await prisma.mastersheetAccessRequest.findFirst({
		where: { columnId, requesterId: userId, status: "PENDING" },
	});
	if (pending) throw Errors.alreadyExists("既に申請中です");

	await prisma.mastersheetAccessRequest.create({
		data: { columnId, requesterId: userId, status: "PENDING" },
	});
}

committeeMastersheetRoute.post(
	"/columns/:columnId/access-request",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const userId = c.get("user").id;
		const { columnId } = mastersheetColumnIdPathParamsSchema.parse(
			c.req.param()
		);

		const col = await getColumnFull(columnId);

		if (col.type === "FORM_ITEM") {
			if (!col.formItem) throw Errors.notFound("フォーム項目が見つかりません");
			await createFormItemAccessRequest(columnId, col.formItem.formId, userId);
		} else {
			await createCustomAccessRequest(col, columnId, userId);
		}

		return c.json({ success: true as const }, 201);
	}
);

// ─────────────────────────────────────────────────────────────
// PATCH /committee/mastersheet/access-requests/:requestId
// カラム管理者が閲覧申請を承認・却下
// ─────────────────────────────────────────────────────────────

committeeMastersheetRoute.patch(
	"/access-requests/:requestId",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const userId = c.get("user").id;
		const { requestId } = mastersheetAccessRequestIdPathParamsSchema.parse(
			c.req.param()
		);

		const body = await c.req.json().catch(() => ({}));
		const { status } = updateMastersheetAccessRequestRequestSchema.parse(body);

		await prisma.$transaction(
			async tx => {
				const request = await tx.mastersheetAccessRequest.findFirst({
					where: { id: requestId },
					include: {
						column: {
							include: {
								formItem: {
									include: { form: { select: { ownerId: true } } },
								},
							},
						},
					},
				});
				if (!request) throw Errors.notFound("申請が見つかりません");

				// 権限チェック（種別によって承認者が異なる）
				const canDecide =
					request.column.type === "FORM_ITEM"
						? request.column.formItem?.form.ownerId === userId
						: request.column.createdById === userId;
				if (!canDecide)
					throw Errors.forbidden("この申請を操作する権限がありません");

				if (request.status !== "PENDING")
					throw Errors.invalidRequest("この申請は既に処理済みです");

				await tx.mastersheetAccessRequest.update({
					where: { id: requestId },
					data: { status, decidedById: userId, decidedAt: new Date() },
				});

				if (status === "APPROVED") {
					if (request.column.type === "FORM_ITEM" && request.column.formItem) {
						// FORM_ITEM: FormCollaborator を作成
						await tx.formCollaborator.upsert({
							where: {
								formId_userId: {
									formId: request.column.formItem.formId,
									userId: request.requesterId,
								},
							},
							create: {
								formId: request.column.formItem.formId,
								userId: request.requesterId,
								isWrite: true,
							},
							update: { deletedAt: null },
						});
					} else {
						// CUSTOM: MastersheetColumnViewer を作成
						await tx.mastersheetColumnViewer.create({
							data: {
								columnId: request.columnId,
								scope: "INDIVIDUAL",
								userId: request.requesterId,
							},
						});
					}
				}
			},
			{ isolationLevel: "Serializable" }
		);

		return c.json({ success: true as const });
	}
);

// ─────────────────────────────────────────────────────────────
// GET /committee/mastersheet/access-requests
// 自分が承認権限を持つ PENDING 申請一覧
// ─────────────────────────────────────────────────────────────

committeeMastersheetRoute.get(
	"/access-requests",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const userId = c.get("user").id;
		const requests = await prisma.mastersheetAccessRequest.findMany({
			where: {
				status: "PENDING",
				OR: [
					{ column: { type: "CUSTOM", createdById: userId } },
					{
						column: {
							type: "FORM_ITEM",
							formItem: { form: { ownerId: userId } },
						},
					},
				],
			},
			include: { requester: { select: { id: true, name: true } } },
			orderBy: { createdAt: "asc" },
		});
		return c.json({
			requests: requests.map(r => ({
				id: r.id,
				columnId: r.columnId,
				requester: r.requester,
				createdAt: r.createdAt,
			})),
		});
	}
);

// ─────────────────────────────────────────────────────────────
// GET /committee/mastersheet/views
// ─────────────────────────────────────────────────────────────

committeeMastersheetRoute.get(
	"/views",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const userId = c.get("user").id;

		const views = await prisma.mastersheetView.findMany({
			where: { createdById: userId },
			orderBy: { createdAt: "asc" },
		});

		return c.json({ views });
	}
);

// ─────────────────────────────────────────────────────────────
// POST /committee/mastersheet/views
// ─────────────────────────────────────────────────────────────

committeeMastersheetRoute.post(
	"/views",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const userId = c.get("user").id;
		const body = await c.req.json().catch(() => ({}));
		const data = createMastersheetViewRequestSchema.parse(body);

		const view = await prisma.mastersheetView.create({
			data: { ...data, createdById: userId },
		});

		return c.json({ view }, 201);
	}
);

// ─────────────────────────────────────────────────────────────
// PATCH /committee/mastersheet/views/:viewId
// ─────────────────────────────────────────────────────────────

committeeMastersheetRoute.patch(
	"/views/:viewId",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const userId = c.get("user").id;
		const { viewId } = mastersheetViewIdPathParamsSchema.parse(c.req.param());
		const body = await c.req.json().catch(() => ({}));
		const data = updateMastersheetViewRequestSchema.parse(body);

		const view = await prisma.mastersheetView.findFirst({
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

committeeMastersheetRoute.delete(
	"/views/:viewId",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const userId = c.get("user").id;
		const { viewId } = mastersheetViewIdPathParamsSchema.parse(c.req.param());

		const view = await prisma.mastersheetView.findFirst({
			where: { id: viewId },
		});
		if (!view) throw Errors.notFound("ビューが見つかりません");
		if (view.createdById !== userId)
			throw Errors.forbidden("自分のビューのみ削除できます");

		await prisma.mastersheetView.delete({ where: { id: viewId } });

		return c.json({ success: true as const });
	}
);

export { committeeMastersheetRoute };
