import {
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

cellsRoute.get(
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
