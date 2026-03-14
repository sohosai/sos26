import type {
	Bureau,
	CommitteeMember,
	Prisma,
	ViewerScope,
} from "@prisma/client";
import { Errors } from "../../lib/error";
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

/** 自分がアクセス可能なフォーム ID セットを返す */
export const getAccessibleFormIds = async (userId: string) => {
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

/** 自分がアクセス可能な企画登録フォーム ID セットを返す */
export const getAccessiblePrfFormIds = async (userId: string) => {
	const forms = await prisma.projectRegistrationForm.findMany({
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

/** カラムアクセス権チェック（accessibleFormIds / accessiblePrfFormIds はバッチ取得済みのものを渡す） */
export function canViewColumn(
	col: ColumnFull,
	userId: string,
	committeeMember: CommitteeMember,
	accessibleFormIds: Set<string>,
	accessiblePrfFormIds: Set<string>
): boolean {
	if (col.type === "FORM_ITEM") {
		return col.formItem !== null && accessibleFormIds.has(col.formItem.formId);
	}
	if (col.type === "PROJECT_REGISTRATION_FORM_ITEM") {
		return (
			col.projectRegistrationFormItem !== null &&
			accessiblePrfFormIds.has(col.projectRegistrationFormItem.formId)
		);
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

export function formatColumnDef(col: ColumnFull, userId: string) {
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
			include: { selectedOptions: { select: { formItemOptionId: true } } };
		};
	};
}>;

export type HistoryWithOptions = Prisma.FormItemEditHistoryGetPayload<{
	include: {
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
				fileId: latestHistory.fileId,
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
				fileId: answer.fileId,
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
// 企画登録フォーム設問のデータ組み立てヘルパー
// ─────────────────────────────────────────────────────────────

export type PrfResponseWithAnswers =
	Prisma.ProjectRegistrationFormResponseGetPayload<{
		include: {
			answers: {
				include: {
					selectedOptions: {
						select: { formItemOptionId: true };
					};
				};
			};
		};
	}>;

export type PrfHistoryWithOptions =
	Prisma.ProjectRegistrationFormItemEditHistoryGetPayload<{
		include: {
			selectedOptions: {
				select: { projectRegistrationFormItemOptionId: true };
			};
		};
	}>;

/** prfItemId × projectId ごとに最新1件の編集履歴を取得 */
export async function fetchLatestPrfHistoryByCell(
	prfItemIds: string[]
): Promise<Map<string, PrfHistoryWithOptions>> {
	const result = new Map<string, PrfHistoryWithOptions>();
	if (prfItemIds.length === 0) return result;

	const allHistory =
		await prisma.projectRegistrationFormItemEditHistory.findMany({
			where: { projectRegistrationFormItemId: { in: prfItemIds } },
			orderBy: { createdAt: "desc" },
			include: {
				selectedOptions: {
					select: { projectRegistrationFormItemOptionId: true },
				},
			},
		});

	for (const h of allHistory) {
		const key = `${h.projectRegistrationFormItemId}:${h.projectId}`;
		if (!result.has(key)) result.set(key, h);
	}

	return result;
}

export function buildPrfItemCell(
	colId: string,
	prfItem: { id: string; formId: string },
	projectId: string,
	responseByFormProject: Map<string, Map<string, PrfResponseWithAnswers>>,
	latestPrfHistoryByCell: Map<string, PrfHistoryWithOptions>
) {
	const responseMap = responseByFormProject.get(prfItem.formId);
	const response = responseMap?.get(projectId);
	const historyKey = `${prfItem.id}:${projectId}`;
	const latestHistory = latestPrfHistoryByCell.get(historyKey);

	if (!response) {
		return {
			columnId: colId,
			status: "NOT_APPLICABLE" as const,
			formValue: null,
		};
	}

	if (latestHistory) {
		return {
			columnId: colId,
			status:
				latestHistory.trigger === "COMMITTEE_EDIT"
					? ("COMMITTEE_EDITED" as const)
					: ("SUBMITTED" as const),
			formValue: {
				textValue: latestHistory.textValue,
				numberValue: latestHistory.numberValue,
				fileId: latestHistory.fileId,
				selectedOptionIds: latestHistory.selectedOptions.map(
					s => s.projectRegistrationFormItemOptionId
				),
			},
		};
	}

	// フォールバック: ProjectRegistrationFormAnswer
	const answer = response.answers.find(a => a.formItemId === prfItem.id);
	const formValue = answer
		? {
				textValue: answer.textValue,
				numberValue: answer.numberValue,
				fileId: answer.fileId,
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
