import { Hono } from "hono";
import { formAnswerFileSelect } from "../../lib/form-answer-files";
import { prisma } from "../../lib/prisma";
import { requireAuth, requireCommitteeMember } from "../../middlewares/auth";
import type { AuthEnv } from "../../types/auth-env";
import {
	buildFormItemCell,
	buildPrfItemCell,
	type ColumnFull,
	canEditColumn,
	canViewColumn,
	fetchLatestHistoryByCell,
	formatColumnDef,
	getEditableFormIds,
	getViewableFormIds,
} from "./helpers";

export const dataRoute = new Hono<AuthEnv>();

// ─────────────────────────────────────────────────────────────
// GET /committee/mastersheet/data
// ─────────────────────────────────────────────────────────────

dataRoute.get("/data", requireAuth, requireCommitteeMember, async c => {
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
	});

	const [editableFormIds, viewableFormIds] = await Promise.all([
		getEditableFormIds(userId),
		getViewableFormIds(userId, committeeMember),
	]);
	const visibleColumns = allColumns.filter(col =>
		canViewColumn(col as ColumnFull, userId, committeeMember, viewableFormIds)
	);

	const formItemCols = visibleColumns.filter(c => c.type === "FORM_ITEM");
	const customCols = visibleColumns.filter(c => c.type === "CUSTOM");
	const prfItemCols = visibleColumns.filter(
		c => c.type === "PROJECT_REGISTRATION_FORM_ITEM"
	);

	// 2. 企画一覧
	const projects = await prisma.project.findMany({
		where: { deletedAt: null },
		include: {
			owner: { select: { id: true, name: true, avatarFileId: true } },
			subOwner: { select: { id: true, name: true, avatarFileId: true } },
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
		: [];

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

	// FormItemEditHistory: formItemId × projectId ごとに最新1件のみ取得
	const formItemIds = [
		...new Set(formItemCols.flatMap(c => (c.formItem ? [c.formItem.id] : []))),
	];
	const latestHistoryByCell = await fetchLatestHistoryByCell(formItemIds);

	// 4. PROJECT_REGISTRATION_FORM_ITEM: 回答・編集履歴をバッチ取得
	const visiblePrfFormIds = [
		...new Set(
			prfItemCols.flatMap(c =>
				c.projectRegistrationFormItem
					? [c.projectRegistrationFormItem.formId]
					: []
			)
		),
	];

	const prfResponses = visiblePrfFormIds.length
		? await prisma.projectRegistrationFormResponse.findMany({
				where: {
					formId: { in: visiblePrfFormIds },
					deletedAt: null,
				},
				include: {
					answers: {
						where: {
							deletedAt: null,
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
		: [];

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

	// 5. CUSTOM: セル値をバッチ取得
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

	// 6. レスポンス組み立て
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
					prfResponseByFormProject
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
				organizationName: project.organizationName,
				deletionStatus: project.deletionStatus ?? null,
				organizationNamePhonetic: project.organizationNamePhonetic,
				owner: project.owner,
				subOwner: project.subOwner ?? null,
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
					editableFormIds
				)
			)
		),
		rows,
	});
});
