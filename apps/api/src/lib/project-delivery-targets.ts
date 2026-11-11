import type {
	DeliveryMode,
	Prisma,
	PrismaClient,
	ProjectLocation,
	ProjectType,
} from "@prisma/client";

type ProjectDeliveryDb = Prisma.TransactionClient | PrismaClient;

type ProjectDeliveryTarget = {
	id: string;
};

type CategoryTargetFilters = {
	filterTypes: ProjectType[];
	filterLocations: ProjectLocation[];
};

type FormDeliveryProject = {
	formAuthorizationId: string;
	projectId: string;
};

type NoticeDeliveryProject = {
	noticeAuthorizationId: string;
	projectId: string;
};

// カテゴリ指定配信の対象企画を解決する。
// filterTypes/filterLocations の空配列は「全種別/全場所」を表す。
async function findCategoryDeliveryTargetProjects(
	db: ProjectDeliveryDb,
	{ filterTypes, filterLocations }: CategoryTargetFilters
): Promise<ProjectDeliveryTarget[]> {
	return db.project.findMany({
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

// 配信モードごとの対象企画IDを解決する。
// 個別指定は既に保持している delivery の projectId を使い、カテゴリ指定は現在の企画属性から引き直す。
export async function resolveDeliveryTargetProjectIds(
	db: ProjectDeliveryDb,
	input: {
		deliveryMode: DeliveryMode;
		filterTypes: ProjectType[];
		filterLocations: ProjectLocation[];
		deliveryProjectIds: string[];
	}
): Promise<string[]> {
	if (input.deliveryMode === "INDIVIDUAL") {
		return [...new Set(input.deliveryProjectIds)];
	}

	const projects = await findCategoryDeliveryTargetProjects(db, {
		filterTypes: input.filterTypes,
		filterLocations: input.filterLocations,
	});

	return projects.map(project => project.id);
}

export async function createFormDeliveries(
	db: ProjectDeliveryDb,
	deliveries: FormDeliveryProject[]
): Promise<void> {
	if (deliveries.length === 0) return;

	await db.formDelivery.createMany({
		data: deliveries,
		skipDuplicates: true,
	});
}

export async function createNoticeDeliveries(
	db: ProjectDeliveryDb,
	deliveries: NoticeDeliveryProject[]
): Promise<void> {
	if (deliveries.length === 0) return;

	await db.noticeDelivery.createMany({
		data: deliveries,
		skipDuplicates: true,
	});
}

// 承認時点で存在する対象企画に delivery を作成する。
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
	await createFormDeliveries(
		tx,
		targetProjects.map(project => ({
			formAuthorizationId: authorization.id,
			projectId: project.id,
		}))
	);
}

// 承認時点で存在する対象企画に delivery を作成する。
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
	await createNoticeDeliveries(
		tx,
		targetProjects.map(project => ({
			noticeAuthorizationId: authorization.id,
			projectId: project.id,
		}))
	);
}

// カテゴリ指定配信の filterTypes/filterLocations が企画に一致する条件。
function categoryMatchesProjectWhere(project: {
	type: ProjectType;
	location: ProjectLocation;
}) {
	return {
		AND: [
			{
				OR: [
					{ filterTypes: { isEmpty: true } },
					{ filterTypes: { has: project.type } },
				],
			},
			{
				OR: [
					{ filterLocations: { isEmpty: true } },
					{ filterLocations: { has: project.location } },
				],
			},
		],
	};
}

// 企画の作成時と種別/場所の変更時に、カテゴリ指定配信の delivery を現在の企画属性に合わせる。
// 配信時刻を過ぎた delivery は、後から対象外になっても削除しない。
// 配信前に対象外になった delivery は、配信通知の対象からも外れるため削除する。
export async function syncCategoryDeliveriesForProject(
	tx: Prisma.TransactionClient,
	projectId: string
): Promise<void> {
	const project = await tx.project.findFirst({
		where: { id: projectId, deletedAt: null },
		select: { id: true, type: true, location: true },
	});
	if (!project) return;

	const now = new Date();
	const matchesProject = categoryMatchesProjectWhere(project);

	await tx.formDelivery.deleteMany({
		where: {
			projectId: project.id,
			formAuthorization: {
				deliveryMode: "CATEGORY",
				scheduledSendAt: { gt: now },
				NOT: matchesProject,
			},
		},
	});
	await tx.noticeDelivery.deleteMany({
		where: {
			projectId: project.id,
			noticeAuthorization: {
				deliveryMode: "CATEGORY",
				deliveredAt: { gt: now },
				NOT: matchesProject,
			},
		},
	});

	const [formAuthorizations, noticeAuthorizations] = await Promise.all([
		tx.formAuthorization.findMany({
			where: {
				deliveryMode: "CATEGORY",
				status: "APPROVED",
				form: { deletedAt: null },
				...matchesProject,
			},
			select: { id: true },
		}),
		tx.noticeAuthorization.findMany({
			where: {
				deliveryMode: "CATEGORY",
				status: "APPROVED",
				notice: { deletedAt: null },
				...matchesProject,
			},
			select: { id: true },
		}),
	]);

	await createFormDeliveries(
		tx,
		formAuthorizations.map(authorization => ({
			formAuthorizationId: authorization.id,
			projectId: project.id,
		}))
	);
	await createNoticeDeliveries(
		tx,
		noticeAuthorizations.map(authorization => ({
			noticeAuthorizationId: authorization.id,
			projectId: project.id,
		}))
	);
}
