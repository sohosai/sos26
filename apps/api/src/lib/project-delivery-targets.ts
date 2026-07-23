import type { Prisma, ProjectLocation, ProjectType } from "@prisma/client";

type ProjectDeliveryTarget = {
	id: string;
};

type CategoryTargetFilters = {
	filterTypes: ProjectType[];
	filterLocations: ProjectLocation[];
};

// カテゴリ指定配信では、空配列は「全種別/全場所」を表す。
export async function findCategoryDeliveryTargetProjects(
	tx: Prisma.TransactionClient,
	{ filterTypes, filterLocations }: CategoryTargetFilters
): Promise<ProjectDeliveryTarget[]> {
	return tx.project.findMany({
		where: {
			deletedAt: null,
			...(filterTypes.length > 0 ? { type: { in: filterTypes } } : {}),
			...(filterLocations.length > 0
				? { location: { in: filterLocations } }
				: {}),
		},
		select: { id: true },
	});
}

// 承認時点で存在する対象企画に delivery を作成する。
// ここで作っておくことで、フォーム一覧取得時に delivery を補完する副作用を持たせない。
export async function ensureFormDeliveriesForAuthorization(
	tx: Prisma.TransactionClient,
	formAuthorizationId: string
): Promise<void> {
	const authorization = await tx.formAuthorization.findFirst({
		where: {
			id: formAuthorizationId,
			deliveryMode: "CATEGORY",
			status: "APPROVED",
			form: { deletedAt: null },
		},
		select: {
			id: true,
			filterTypes: true,
			filterLocations: true,
		},
	});
	if (!authorization) return;

	const targetProjects = await findCategoryDeliveryTargetProjects(tx, {
		filterTypes: authorization.filterTypes,
		filterLocations: authorization.filterLocations,
	});
	if (targetProjects.length === 0) return;

	await tx.formDelivery.createMany({
		data: targetProjects.map(project => ({
			formAuthorizationId: authorization.id,
			projectId: project.id,
		})),
		skipDuplicates: true,
	});
}

// 承認時点で存在する対象企画に delivery を作成する。
// ここで作っておくことで、お知らせ一覧取得時に delivery を補完する副作用を持たせない。
export async function ensureNoticeDeliveriesForAuthorization(
	tx: Prisma.TransactionClient,
	noticeAuthorizationId: string
): Promise<void> {
	const authorization = await tx.noticeAuthorization.findFirst({
		where: {
			id: noticeAuthorizationId,
			deliveryMode: "CATEGORY",
			status: "APPROVED",
			notice: { deletedAt: null },
		},
		select: {
			id: true,
			filterTypes: true,
			filterLocations: true,
		},
	});
	if (!authorization) return;

	const targetProjects = await findCategoryDeliveryTargetProjects(tx, {
		filterTypes: authorization.filterTypes,
		filterLocations: authorization.filterLocations,
	});
	if (targetProjects.length === 0) return;

	await tx.noticeDelivery.createMany({
		data: targetProjects.map(project => ({
			noticeAuthorizationId: authorization.id,
			projectId: project.id,
		})),
		skipDuplicates: true,
	});
}

// 承認後に作成された企画、または種別/場所が変更された企画を対象に、
// 現在の企画属性に一致するカテゴリ指定配信の delivery を補完する。
// 一度作成された delivery は、後から対象外になっても削除しない。
export async function ensureDeliveriesForProject(
	tx: Prisma.TransactionClient,
	projectId: string
): Promise<void> {
	const project = await tx.project.findFirst({
		where: { id: projectId, deletedAt: null },
		select: { id: true, type: true, location: true },
	});
	if (!project) return;

	const [formAuthorizations, noticeAuthorizations] = await Promise.all([
		tx.formAuthorization.findMany({
			where: {
				deliveryMode: "CATEGORY",
				status: "APPROVED",
				form: { deletedAt: null },
				OR: [
					{ filterTypes: { isEmpty: true } },
					{ filterTypes: { has: project.type } },
				],
				AND: [
					{
						OR: [
							{ filterLocations: { isEmpty: true } },
							{ filterLocations: { has: project.location } },
						],
					},
				],
			},
			select: { id: true },
		}),
		tx.noticeAuthorization.findMany({
			where: {
				deliveryMode: "CATEGORY",
				status: "APPROVED",
				notice: { deletedAt: null },
				OR: [
					{ filterTypes: { isEmpty: true } },
					{ filterTypes: { has: project.type } },
				],
				AND: [
					{
						OR: [
							{ filterLocations: { isEmpty: true } },
							{ filterLocations: { has: project.location } },
						],
					},
				],
			},
			select: { id: true },
		}),
	]);

	if (formAuthorizations.length > 0) {
		await tx.formDelivery.createMany({
			data: formAuthorizations.map(authorization => ({
				formAuthorizationId: authorization.id,
				projectId: project.id,
			})),
			skipDuplicates: true,
		});
	}

	if (noticeAuthorizations.length > 0) {
		await tx.noticeDelivery.createMany({
			data: noticeAuthorizations.map(authorization => ({
				noticeAuthorizationId: authorization.id,
				projectId: project.id,
			})),
			skipDuplicates: true,
		});
	}
}
