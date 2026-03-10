import {
	batchMastersheetHistoryRequestSchema,
	editFormItemCellRequestSchema,
	mastersheetColumnProjectPathParamsSchema,
	upsertMastersheetCellRequestSchema,
} from "@sos26/shared";
import { Hono } from "hono";
import { Errors } from "../../lib/error";
import { prisma } from "../../lib/prisma";
import { requireAuth, requireCommitteeMember } from "../../middlewares/auth";
import type { AuthEnv } from "../../types/auth-env";
import { canViewColumn, getAccessibleFormIds, getColumnFull } from "./helpers";

export const cellsRoute = new Hono<AuthEnv>();

// ─────────────────────────────────────────────────────────────
// PUT /committee/mastersheet/cells/:columnId/:projectId
// 自由追加カラムのセル値を更新
// ─────────────────────────────────────────────────────────────

cellsRoute.put(
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
					if (data.selectedOptionIds.length > 0) {
						const validIds = new Set(col.options.map(o => o.id));
						const invalid = data.selectedOptionIds.filter(
							id => !validIds.has(id)
						);
						if (invalid.length > 0)
							throw Errors.invalidRequest("無効な選択肢が含まれています");
					}

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

cellsRoute.put(
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
					const validIds = new Set(col.formItem?.options.map(o => o.id) ?? []);
					const invalid = data.selectedOptionIds.filter(
						id => !validIds.has(id)
					);
					if (invalid.length > 0)
						throw Errors.invalidRequest("無効な選択肢が含まれています");

					await tx.formItemEditHistorySelectedOption.createMany({
						data: data.selectedOptionIds.map(optionId => ({
							editHistoryId: created.id,
							formItemOptionId: optionId,
						})),
					});
				}

				return tx.formItemEditHistory.findUniqueOrThrow({
					where: { id: created.id },
					include: {
						selectedOptions: { select: { formItemOptionId: true } },
					},
				});
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
					selectedOptionIds: history.selectedOptions.map(
						s => s.formItemOptionId
					),
				},
			},
		});
	}
);

// ─────────────────────────────────────────────────────────────
// POST /committee/mastersheet/history
// 編集履歴をバッチ取得（cells が空なら空レスポンス）
// ─────────────────────────────────────────────────────────────

cellsRoute.post("/history", requireAuth, requireCommitteeMember, async c => {
	const userId = c.get("user").id;
	const committeeMember = c.get("committeeMember");

	const body = await c.req.json().catch(() => {
		throw Errors.invalidRequest("リクエストボディが不正です");
	});
	const { cells } = batchMastersheetHistoryRequestSchema.parse(body);

	// セル指定がなければ空レスポンス
	if (cells.length === 0) {
		return c.json({ groups: [] });
	}

	const accessibleFormIds = await getAccessibleFormIds(userId);

	// 対象カラムを特定
	const targetColumnIds = [...new Set(cells.map(c => c.columnId))];

	const columns = await prisma.mastersheetColumn.findMany({
		where: {
			id: { in: targetColumnIds },
			formItemId: { not: null },
		},
		include: {
			formItem: { select: { id: true, formId: true } },
			createdBy: { select: { name: true } },
			viewers: { include: { user: { select: { name: true } } } },
		},
	});

	// 権限フィルタ
	const accessibleColumns = columns.filter(col =>
		canViewColumn(
			col as Parameters<typeof canViewColumn>[0],
			userId,
			committeeMember,
			accessibleFormIds
		)
	);

	if (accessibleColumns.length === 0) {
		return c.json({ groups: [] });
	}

	// formItemId → columnId のマップ
	const formItemToColumn = new Map(
		accessibleColumns
			.filter(
				(
					col
				): col is typeof col & { formItem: NonNullable<typeof col.formItem> } =>
					col.formItem != null
			)
			.map(col => [col.formItem.id, col.id] as const)
	);
	const formItemIds = [...formItemToColumn.keys()];

	const targetProjectIds = [...new Set(cells.map(c => c.projectId))];

	// バッチクエリ
	const allHistory = await prisma.formItemEditHistory.findMany({
		where: {
			formItemId: { in: formItemIds },
			projectId: { in: targetProjectIds },
		},
		include: {
			actor: { select: { id: true, name: true } },
			selectedOptions: { select: { formItemOptionId: true } },
		},
		orderBy: { createdAt: "desc" },
	});

	// (columnId, projectId) でグルーピング
	const groupMap = new Map<
		string,
		{ columnId: string; projectId: string; history: typeof allHistory }
	>();

	for (const h of allHistory) {
		const columnId = formItemToColumn.get(h.formItemId);
		if (!columnId) continue;

		// 対象セルのみに絞り込む
		const match = cells.some(
			c => c.columnId === columnId && c.projectId === h.projectId
		);
		if (!match) continue;

		const key = `${columnId}:${h.projectId}`;
		let group = groupMap.get(key);
		if (!group) {
			group = { columnId, projectId: h.projectId, history: [] };
			groupMap.set(key, group);
		}
		group.history.push(h);
	}

	return c.json({
		groups: [...groupMap.values()].map(g => ({
			columnId: g.columnId,
			projectId: g.projectId,
			history: g.history.map(h => ({
				id: h.id,
				value: {
					textValue: h.textValue,
					numberValue: h.numberValue,
					fileUrl: h.fileUrl,
					selectedOptionIds: h.selectedOptions.map(s => s.formItemOptionId),
				},
				actor: h.actor,
				trigger: h.trigger,
				createdAt: h.createdAt,
			})),
		})),
	});
});
