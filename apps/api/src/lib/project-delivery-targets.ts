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

function uniqueFormDeliveryProjects(
	deliveries: FormDeliveryProject[]
): FormDeliveryProject[] {
	const seen = new Set<string>();
	return deliveries.filter(delivery => {
		const key = `${delivery.formAuthorizationId}:${delivery.projectId}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

function uniqueNoticeDeliveryProjects(
	deliveries: NoticeDeliveryProject[]
): NoticeDeliveryProject[] {
	const seen = new Set<string>();
	return deliveries.filter(delivery => {
		const key = `${delivery.noticeAuthorizationId}:${delivery.projectId}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

// カテゴリ指定配信の対象企画を解決する。
// filterTypes/filterLocations の空配列は「全種別/全場所」を表す。
export async function findCategoryDeliveryTargetProjects(
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

// authorization と project の組み合わせを一括作成する低水準 helper。
// 呼び出し元が複数 authorization 分をまとめて渡せるよう、重複排除はペア単位で行う。
export async function createFormDeliveryProjects(
	db: ProjectDeliveryDb,
	deliveries: FormDeliveryProject[]
): Promise<void> {
	const uniqueDeliveries = uniqueFormDeliveryProjects(deliveries);
	if (uniqueDeliveries.length === 0) return;

	await db.formDelivery.createMany({
		data: uniqueDeliveries,
		skipDuplicates: true,
	});
}

// authorization と project の組み合わせを一括作成する低水準 helper。
// 呼び出し元が複数 authorization 分をまとめて渡せるよう、重複排除はペア単位で行う。
export async function createNoticeDeliveryProjects(
	db: ProjectDeliveryDb,
	deliveries: NoticeDeliveryProject[]
): Promise<void> {
	const uniqueDeliveries = uniqueNoticeDeliveryProjects(deliveries);
	if (uniqueDeliveries.length === 0) return;

	await db.noticeDelivery.createMany({
		data: uniqueDeliveries,
		skipDuplicates: true,
	});
}

// 1つの authorization に対して複数 project の delivery を作成し、
// 通知同期側が同じ projectIds を通知送信に使えるように返す。
export async function createFormDeliveriesForProjects(
	db: ProjectDeliveryDb,
	formAuthorizationId: string,
	projectIds: string[]
): Promise<string[]> {
	if (projectIds.length === 0) return [];

	const uniqueProjectIds = [...new Set(projectIds)];

	await createFormDeliveryProjects(
		db,
		uniqueProjectIds.map(projectId => ({
			formAuthorizationId,
			projectId,
		}))
	);

	return uniqueProjectIds;
}

// 1つの authorization に対して複数 project の delivery を作成し、
// 通知同期側が同じ projectIds を通知送信に使えるように返す。
export async function createNoticeDeliveriesForProjects(
	db: ProjectDeliveryDb,
	noticeAuthorizationId: string,
	projectIds: string[]
): Promise<string[]> {
	if (projectIds.length === 0) return [];

	const uniqueProjectIds = [...new Set(projectIds)];

	await createNoticeDeliveryProjects(
		db,
		uniqueProjectIds.map(projectId => ({
			noticeAuthorizationId,
			projectId,
		}))
	);

	return uniqueProjectIds;
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

	await createFormDeliveriesForProjects(
		tx,
		authorization.id,
		targetProjects.map(project => project.id)
	);
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

	await createNoticeDeliveriesForProjects(
		tx,
		authorization.id,
		targetProjects.map(project => project.id)
	);
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
		await createFormDeliveryProjects(
			tx,
			formAuthorizations.map(authorization => ({
				formAuthorizationId: authorization.id,
				projectId: project.id,
			}))
		);
	}

	if (noticeAuthorizations.length > 0) {
		await createNoticeDeliveryProjects(
			tx,
			noticeAuthorizations.map(authorization => ({
				noticeAuthorizationId: authorization.id,
				projectId: project.id,
			}))
		);
	}
}
