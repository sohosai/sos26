import { Hono } from "hono";
import { formAnswerFileSelect } from "../../lib/form-answer-files";
import { prisma } from "../../lib/prisma";
import {
	getCommitteeMember,
	requireAuth,
	requireCommitteeMember,
} from "../../middlewares/auth";
import type { AuthEnv } from "../../types/auth-env";
import {
	buildFormItemCell,
	buildPrfItemCell,
	type ColumnFull,
	canEditColumn,
	canViewColumn,
	fetchLatestHistoryByCell,
	fetchLatestPrfHistoryByCell,
	formatColumnDef,
	getEditableFormIds,
	getEditableProjectRegistrationFormIds,
	getViewerFormIds,
} from "./helpers";

export const dataRoute = new Hono<AuthEnv>();

// ─────────────────────────────────────────────────────────────
// GET /committee/mastersheet/data
// ─────────────────────────────────────────────────────────────

dataRoute.get("/data", requireAuth, requireCommitteeMember, async c => {
	const userId = c.get("user").id;
	const committeeMember = getCommitteeMember(c);

	// 企画責任者・副企画責任者の連絡先（メール・電話）は PROJECT_VIEW 権限を持つ実委人にのみ含めて返す
	const canViewContacts = c.get("permissions").has("PROJECT_VIEW");

	// 1. カラム一覧・権限・企画一覧
	const [
		allColumns,
		editableFormIds,
		editablePrfFormIds,
		viewerFormIds,
		projects,
	] = await Promise.all([
		prisma.mastersheetColumn.findMany({
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
			orderBy: { sortOrder: "asc" },
		}),
		getEditableFormIds(userId),
		getEditableProjectRegistrationFormIds(userId),
		getViewerFormIds(userId, committeeMember),
		prisma.project.findMany({
			where: { deletedAt: null },
			include: {
				owner: {
					select: {
						id: true,
						name: true,
						avatarFileId: true,
						email: true,
						telephoneNumber: true,
					},
				},
				subOwner: {
					select: {
						id: true,
						name: true,
						avatarFileId: true,
						email: true,
						telephoneNumber: true,
					},
				},
			},
			orderBy: { number: "asc" },
		}),
	]);

	const viewableFormIds = new Set([...editableFormIds, ...viewerFormIds]);
	const visibleColumns = allColumns.filter(col =>
		canViewColumn(col as ColumnFull, userId, committeeMember, viewableFormIds)
	);

	const formItemCols = visibleColumns.filter(c => c.type === "FORM_ITEM");
	const customCols = visibleColumns.filter(c => c.type === "CUSTOM");
	const prfItemCols = visibleColumns.filter(
		c => c.type === "PROJECT_REGISTRATION_FORM_ITEM"
	);

	const visibleFormIds = [
		...new Set(
			formItemCols.flatMap(c => (c.formItem ? [c.formItem.formId] : []))
		),
	];
	const formItemIds = [
		...new Set(formItemCols.flatMap(c => (c.formItem ? [c.formItem.id] : []))),
	];
	const visiblePrfFormIds = [
		...new Set(
			prfItemCols.flatMap(c =>
				c.projectRegistrationFormItem
					? [c.projectRegistrationFormItem.formId]
					: []
			)
		),
	];
	const prfItemIds = [
		...new Set(
			prfItemCols.flatMap(c =>
				c.projectRegistrationFormItem ? [c.projectRegistrationFormItem.id] : []
			)
		),
	];
	const customColIds = customCols.map(c => c.id);

	const approvedDeliveryWhere = {
		formAuthorization: {
			formId: { in: visibleFormIds },
			status: "APPROVED" as const,
			scheduledSendAt: { lte: new Date() },
		},
	};

	// 2. 表示列のセル値をバッチ取得
	// 回答は未提出なら表示に使わないため、提出済みのものだけを表示列の設問に絞って取得する
	const [
		deliveries,
		responses,
		latestHistoryByCell,
		prfResponses,
		latestPrfHistoryByCell,
		cellValues,
	] = await Promise.all([
		visibleFormIds.length
			? prisma.formDelivery.findMany({
					where: approvedDeliveryWhere,
					include: { formAuthorization: { select: { formId: true } } },
				})
			: [],
		visibleFormIds.length
			? prisma.formResponse.findMany({
					where: {
						formDelivery: approvedDeliveryWhere,
						submittedAt: { not: null },
					},
					include: {
						answers: {
							where: { formItemId: { in: formItemIds } },
							include: {
								files: {
									where: {
										file: {
											status: "CONFIRMED",
											deletedAt: null,
										},
									},
									orderBy: { sortOrder: "asc" },
									include: { file: { select: formAnswerFileSelect } },
								},
								selectedOptions: { select: { formItemOptionId: true } },
							},
						},
					},
				})
			: [],
		fetchLatestHistoryByCell(formItemIds),
		visiblePrfFormIds.length
			? prisma.projectRegistrationFormResponse.findMany({
					where: {
						formId: { in: visiblePrfFormIds },
						deletedAt: null,
					},
					include: {
						answers: {
							where: {
								deletedAt: null,
								formItemId: { in: prfItemIds },
							},
							include: {
								files: {
									orderBy: { sortOrder: "asc" },
									include: { file: { select: formAnswerFileSelect } },
								},
								selectedOptions: { select: { formItemOptionId: true } },
							},
						},
					},
				})
			: [],
		fetchLatestPrfHistoryByCell(prfItemIds),
		customColIds.length
			? prisma.mastersheetCellValue.findMany({
					where: { columnId: { in: customColIds } },
					include: { selectedOptions: { select: { optionId: true } } },
				})
			: [],
	]);

	// deliveryByFormProject: formId → projectId → deliveryId
	const deliveryByFormProject = new Map<string, Map<string, string>>();
	for (const d of deliveries) {
		const fid = d.formAuthorization.formId;
		if (!deliveryByFormProject.has(fid))
			deliveryByFormProject.set(fid, new Map());
		deliveryByFormProject.get(fid)?.set(d.projectId, d.id);
	}

	const responseByDelivery = new Map(responses.map(r => [r.formDeliveryId, r]));
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

	// responseByFormProject: formId → projectId → response
	const prfResponseByFormProject = new Map<
		string,
		Map<string, (typeof prfResponses)[0]>
	>();
	for (const r of prfResponses) {
		if (!prfResponseByFormProject.has(r.formId))
			prfResponseByFormProject.set(r.formId, new Map());
		prfResponseByFormProject.get(r.formId)?.set(r.projectId, r);
	}

	const cellByColProject = new Map<
		string,
		Map<string, (typeof cellValues)[0]>
	>();
	for (const cv of cellValues) {
		if (!cellByColProject.has(cv.columnId))
			cellByColProject.set(cv.columnId, new Map());
		cellByColProject.get(cv.columnId)?.set(cv.projectId, cv);
	}

	// 3. レスポンス組み立て
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
			if (
				col.type === "PROJECT_REGISTRATION_FORM_ITEM" &&
				col.projectRegistrationFormItem
			) {
				return buildPrfItemCell(
					col.id,
					col.projectRegistrationFormItem,
					project.id,
					prfResponseByFormProject,
					latestPrfHistoryByCell
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
							files: [],
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
				namePhonetic: project.namePhonetic,
				type: project.type,
				location: project.location,
				organizationName: project.organizationName,
				deletionStatus: project.deletionStatus ?? null,
				organizationNamePhonetic: project.organizationNamePhonetic,
				owner: {
					id: project.owner.id,
					name: project.owner.name,
					avatarFileId: project.owner.avatarFileId,
					email: canViewContacts ? project.owner.email : null,
					telephoneNumber: canViewContacts
						? project.owner.telephoneNumber
						: null,
				},
				subOwner: project.subOwner
					? {
							id: project.subOwner.id,
							name: project.subOwner.name,
							avatarFileId: project.subOwner.avatarFileId,
							email: canViewContacts ? project.subOwner.email : null,
							telephoneNumber: canViewContacts
								? project.subOwner.telephoneNumber
								: null,
						}
					: null,
			},
			cells,
		};
	});

	return c.json({
		columns: visibleColumns.map(col =>
			formatColumnDef(
				col as ColumnFull,
				userId,
				canEditColumn(
					col as ColumnFull,
					userId,
					committeeMember,
					editableFormIds,
					editablePrfFormIds
				)
			)
		),
		rows,
	});
});
