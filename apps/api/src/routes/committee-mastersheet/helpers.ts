import type {
	Bureau,
	CommitteeMember,
	Prisma,
	ViewerScope,
} from "@prisma/client";
import { Errors } from "../../lib/error";
import {
	formAnswerFileSelect,
	mapAnswerFiles,
} from "../../lib/form-answer-files";
import { prisma } from "../../lib/prisma";

// ─────────────────────────────────────────────────────────────
// データ取得・権限チェックヘルパー
// ─────────────────────────────────────────────────────────────

/** カラムをリレーション込みで取得（存在しない場合は 404） */
export const getColumnFull = async (columnId: string) => {
	const col = await prisma.mastersheetColumn.findUnique({
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
			projectRegistrationFormItem: {
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

export type ColumnFull = Awaited<ReturnType<typeof getColumnFull>>;

/** 自分が編集可能（owner / collaborator）な申請 ID セットを返す */
export const getEditableFormIds = async (userId: string) => {
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

/**
 * 自分が閲覧可能（owner / collaborator / FormViewer の scope に合致）な申請 ID セットを返す。
 * FORM_ITEM カラムの閲覧範囲判定に使用する。
 */
export const getViewableFormIds = async (
	userId: string,
	committeeMember: CommitteeMember
): Promise<Set<string>> => {
	const [editable, viewerEntries] = await Promise.all([
		getEditableFormIds(userId),
		prisma.formViewer.findMany({
			where: {
				deletedAt: null,
				form: { deletedAt: null },
				OR: [
					{ scope: "ALL" },
					{ scope: "BUREAU", bureauValue: committeeMember.Bureau },
					{ scope: "INDIVIDUAL", userId },
				],
			},
			select: { formId: true },
		}),
	]);
	const result = new Set(editable);
	for (const v of viewerEntries) result.add(v.formId);
	return result;
};

/** カラム閲覧権チェック（viewableFormIds は viewer 含むセット） */
export function canViewColumn(
	col: ColumnFull,
	userId: string,
	committeeMember: CommitteeMember,
	viewableFormIds: Set<string>
): boolean {
	if (col.type === "FORM_ITEM") {
		return col.formItem !== null && viewableFormIds.has(col.formItem.formId);
	}
	if (col.type === "PROJECT_REGISTRATION_FORM_ITEM") {
		// 企画登録情報は実委人全員が閲覧可能
		return col.projectRegistrationFormItem !== null;
	}
	// CUSTOM
	if (col.createdById === userId) return true;
	if (col.visibility !== "PUBLIC") return false;
	for (const v of col.viewers) {
		if (v.scope === "ALL") return true;
		if (
			v.scope === "BUREAU" &&
			v.bureauValue != null &&
			v.bureauValue === committeeMember.Bureau
		)
			return true;
		if (v.scope === "INDIVIDUAL" && v.userId === userId) return true;
	}
	return false;
}

/**
 * セル編集権チェック。
 * - FORM_ITEM: 申請の owner / collaborator のみ（viewer は不可）
 * - CUSTOM: canViewColumn と同じ（カラムにアクセスできる全員）
 * - PROJECT_REGISTRATION_FORM_ITEM: 不可（読み取り専用）
 */
export function canEditColumn(
	col: ColumnFull,
	userId: string,
	committeeMember: CommitteeMember,
	editableFormIds: Set<string>
): boolean {
	if (col.type === "FORM_ITEM") {
		return col.formItem !== null && editableFormIds.has(col.formItem.formId);
	}
	if (col.type === "PROJECT_REGISTRATION_FORM_ITEM") {
		return false;
	}
	// CUSTOM: 閲覧できる人＝編集できる人
	return canViewColumn(col, userId, committeeMember, new Set());
}

/** カラム管理者（作成者）チェック */
export const requireColumnOwner = async (columnId: string, userId: string) => {
	const col = await prisma.mastersheetColumn.findUnique({
		where: { id: columnId },
		select: { id: true, createdById: true },
	});
	if (!col) throw Errors.notFound("カラムが見つかりません");
	if (col.createdById !== userId)
		throw Errors.forbidden("この操作は作成者のみ行えます");
	return col;
};

// ─────────────────────────────────────────────────────────────
// レスポンス整形ヘルパー
// ─────────────────────────────────────────────────────────────

export function formatColumnDef(
	col: ColumnFull,
	userId: string,
	canEdit: boolean
) {
	const options =
		col.type === "FORM_ITEM" && col.formItem?.options?.length
			? col.formItem.options
			: col.type === "PROJECT_REGISTRATION_FORM_ITEM" &&
					col.projectRegistrationFormItem?.options?.length
				? col.projectRegistrationFormItem.options
				: col.options;

	return {
		id: col.id,
		type: col.type,
		name: col.name,
		description: col.description,
		sortOrder: col.sortOrder,
		createdById: col.createdById,
		createdByName: col.createdBy.name,
		isOwner: col.createdById === userId,
		canEdit,
		formItemId: col.formItemId,
		formItemType: col.formItem?.type ?? null,
		projectRegistrationFormItemId: col.projectRegistrationFormItemId,
		projectRegistrationFormItemType:
			col.projectRegistrationFormItem?.type ?? null,
		dataType: col.dataType,
		visibility: col.visibility,
		viewers: col.viewers.map(v => ({
			id: v.id,
			scope: v.scope,
			bureauValue: v.bureauValue,
			userId: v.userId,
			userName: v.user?.name ?? null,
		})),
		options,
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
// データ組み立てヘルパー
// ─────────────────────────────────────────────────────────────

export type FormResponseWithAnswers = Prisma.FormResponseGetPayload<{
	include: {
		answers: {
			include: {
				files: {
					orderBy: { sortOrder: "asc" };
					include: { file: { select: typeof formAnswerFileSelect } };
				};
				selectedOptions: { select: { formItemOptionId: true } };
			};
		};
	};
}>;

export type HistoryWithOptions = Prisma.FormItemEditHistoryGetPayload<{
	include: {
		files: {
			orderBy: { sortOrder: "asc" };
			include: { file: { select: typeof formAnswerFileSelect } };
		};
		selectedOptions: { select: { formItemOptionId: true } };
	};
}>;

/** formItemId × projectId ごとに最新1件の編集履歴を取得 */
export async function fetchLatestHistoryByCell(
	formItemIds: string[]
): Promise<Map<string, HistoryWithOptions>> {
	const result = new Map<string, HistoryWithOptions>();
	if (formItemIds.length === 0) return result;

	const allHistory = await prisma.formItemEditHistory.findMany({
		where: { formItemId: { in: formItemIds } },
		orderBy: { createdAt: "desc" },
		include: {
			files: {
				orderBy: { sortOrder: "asc" },
				include: { file: { select: formAnswerFileSelect } },
			},
			selectedOptions: { select: { formItemOptionId: true } },
		},
	});

	for (const h of allHistory) {
		const key = `${h.formItemId}:${h.projectId}`;
		if (!result.has(key)) result.set(key, h);
	}

	return result;
}

export function buildFormItemCell(
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
				files: mapAnswerFiles(latestHistory.files),
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
				files: mapAnswerFiles(answer.files),
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
// 企画登録情報設問のデータ組み立てヘルパー
// ─────────────────────────────────────────────────────────────

export type PrfResponseWithAnswers =
	Prisma.ProjectRegistrationFormResponseGetPayload<{
		include: {
			answers: {
				include: {
					files: {
						orderBy: { sortOrder: "asc" };
						include: {
							file: {
								select: typeof formAnswerFileSelect;
							};
						};
					};
					selectedOptions: {
						select: { formItemOptionId: true };
					};
				};
			};
		};
	}>;

export function buildPrfItemCell(
	colId: string,
	prfItem: { id: string; formId: string },
	projectId: string,
	responseByFormProject: Map<string, Map<string, PrfResponseWithAnswers>>
) {
	const responseMap = responseByFormProject.get(prfItem.formId);
	const response = responseMap?.get(projectId);

	if (!response) {
		return {
			columnId: colId,
			status: "NOT_APPLICABLE" as const,
			formValue: null,
		};
	}

	const answer = response.answers.find(a => a.formItemId === prfItem.id);
	const formValue = answer
		? {
				textValue: answer.textValue,
				numberValue: answer.numberValue,
				files: mapAnswerFiles(answer.files),
				selectedOptionIds: answer.selectedOptions.map(s => s.formItemOptionId),
			}
		: null;

	return {
		columnId: colId,
		status: "SUBMITTED" as const,
		formValue,
	};
}

// ─────────────────────────────────────────────────────────────
// トランザクション用ヘルパー
// ─────────────────────────────────────────────────────────────

export type TxClient = Prisma.TransactionClient;

export async function syncColumnViewers(
	tx: TxClient,
	columnId: string,
	viewers: { scope: ViewerScope; bureauValue?: Bureau; userId?: string }[]
) {
	await tx.mastersheetColumnViewer.deleteMany({ where: { columnId } });
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

export async function syncColumnOptions(
	tx: TxClient,
	columnId: string,
	options: { label: string; sortOrder: number }[]
) {
	await tx.mastersheetColumnOption.deleteMany({ where: { columnId } });
	if (options.length > 0) {
		await tx.mastersheetColumnOption.createMany({
			data: options.map(o => ({
				columnId,
				label: o.label,
				sortOrder: o.sortOrder,
			})),
		});
	}
}
