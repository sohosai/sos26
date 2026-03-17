import {
	batchMastersheetHistoryRequestSchema,
	editFormItemCellRequestSchema,
	mastersheetColumnProjectPathParamsSchema,
	upsertMastersheetCellRequestSchema,
} from "@sos26/shared";
import { Hono } from "hono";
import { Errors } from "../../lib/error";
import {
	formAnswerFileSelect,
	mapAnswerFiles,
	normalizeFileIds,
} from "../../lib/form-answer-files";
import { prisma } from "../../lib/prisma";
import { requireAuth, requireCommitteeMember } from "../../middlewares/auth";
import type { AuthEnv } from "../../types/auth-env";
import { canViewColumn, getAccessibleFormIds, getColumnFull } from "./helpers";

const answerFilesInclude = {
	where: {
		file: {
			status: "CONFIRMED" as const,
			deletedAt: null,
		},
	},
	orderBy: { sortOrder: "asc" as const },
	include: {
		file: { select: formAnswerFileSelect },
	},
};

// ─────────────────────────────────────────────────────────────
// ヘルパー: 編集履歴のグループマップ構築
// ─────────────────────────────────────────────────────────────

type HistoryEntry = {
	id: string;
	value: {
		textValue: string | null;
		numberValue: number | null;
		files: ReturnType<typeof mapAnswerFiles>;
		selectedOptionIds: string[];
	};
	actor: { id: string; name: string };
	trigger: string;
	createdAt: Date;
};

type HistoryGroup = {
	columnId: string;
	projectId: string;
	history: HistoryEntry[];
};

type HistoryGroupMap = Map<string, HistoryGroup>;

/** FormItemEditHistory をグループマップに追加する */
async function collectFormItemHistory(
	formItemIds: string[],
	targetProjectIds: string[],
	formItemToColumn: Map<string, string>,
	targetCellKeys: Set<string>,
	groupMap: HistoryGroupMap
) {
	const allHistory = await prisma.formItemEditHistory.findMany({
		where: {
			formItemId: { in: formItemIds },
			projectId: { in: targetProjectIds },
		},
		include: {
			actor: { select: { id: true, name: true } },
			files: answerFilesInclude,
			selectedOptions: { select: { formItemOptionId: true } },
		},
		orderBy: { createdAt: "desc" },
	});

	for (const h of allHistory) {
		const columnId = formItemToColumn.get(h.formItemId);
		if (!columnId) continue;
		if (!targetCellKeys.has(`${columnId}:${h.projectId}`)) continue;

		const key = `${columnId}:${h.projectId}`;
		let group = groupMap.get(key);
		if (!group) {
			group = { columnId, projectId: h.projectId, history: [] };
			groupMap.set(key, group);
		}
		group.history.push({
			id: h.id,
			value: {
				textValue: h.textValue,
				numberValue: h.numberValue,
				files: mapAnswerFiles(h.files),
				selectedOptionIds: h.selectedOptions.map(s => s.formItemOptionId),
			},
			actor: h.actor,
			trigger: h.trigger,
			createdAt: h.createdAt,
		});
	}
}

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
					files: [],
					selectedOptionIds: cell.selectedOptions.map(s => s.optionId),
				},
			},
		});
	}
);

// ─────────────────────────────────────────────────────────────
// PUT /committee/mastersheet/edits/:columnId/:projectId
// 申請由来カラムの値を編集
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

		const accessibleFormIds = await getAccessibleFormIds(userId);
		if (!canViewColumn(col, userId, committeeMember, accessibleFormIds))
			throw Errors.forbidden("このカラムへのアクセス権がありません");

		const project = await prisma.project.findFirst({
			where: { id: projectId, deletedAt: null },
		});
		if (!project) throw Errors.notFound("企画が見つかりません");

		const body = await c.req.json().catch(() => ({}));
		const data = editFormItemCellRequestSchema.parse(body);

		if (!col.formItemId)
			throw Errors.invalidRequest("申請項目が紐づいていません");

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

		const history = await prisma.$transaction(
			async tx => {
				const created = await tx.formItemEditHistory.create({
					data: {
						formItemId,
						projectId,
						textValue: data.textValue ?? null,
						numberValue: data.numberValue ?? null,
						actorId: userId,
						trigger: "COMMITTEE_EDIT",
					},
				});

				const fileIds = normalizeFileIds(data.fileIds);
				if (fileIds.length > 0) {
					await tx.formItemEditHistoryFile.createMany({
						data: fileIds.map((fileId, sortOrder) => ({
							editHistoryId: created.id,
							fileId,
							sortOrder,
						})),
					});
				}

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
						files: answerFilesInclude,
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
					files: mapAnswerFiles(history.files),
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

	const targetProjectIds = [...new Set(cells.map(c => c.projectId))];
	const targetCellKeys = new Set(
		cells.map(c => `${c.columnId}:${c.projectId}`)
	);

	// FORM_ITEM カラムの履歴
	const formItemToColumn = new Map(
		accessibleColumns
			.filter(
				(
					col
				): col is typeof col & {
					formItem: NonNullable<typeof col.formItem>;
				} => col.type === "FORM_ITEM" && col.formItem != null
			)
			.map(col => [col.formItem.id, col.id] as const)
	);
	const formItemIds = [...formItemToColumn.keys()];

	const groupMap: HistoryGroupMap = new Map();

	// FormItemEditHistory（FORM_ITEM カラムのみ。PRF カラムは基本情報のため履歴なし）
	if (formItemIds.length > 0) {
		await collectFormItemHistory(
			formItemIds,
			targetProjectIds,
			formItemToColumn,
			targetCellKeys,
			groupMap
		);
	}

	return c.json({
		groups: [...groupMap.values()].map(g => ({
			columnId: g.columnId,
			projectId: g.projectId,
			history: g.history,
		})),
	});
});
