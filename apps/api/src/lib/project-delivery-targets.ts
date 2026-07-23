import type { Prisma, ProjectLocation, ProjectType } from "@prisma/client";

type ProjectDeliveryTarget = {
	id: string;
};

type CategoryTargetFilters = {
	filterTypes: ProjectType[];
	filterLocations: ProjectLocation[];
};

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
