import type {
	DeliveryMode,
	ProjectLocation,
	ProjectType,
} from "@prisma/client";
import { Prisma } from "@prisma/client";
import { Hono } from "hono";
import { env } from "../lib/env";
import { Errors } from "../lib/error";
import {
	notifyFormDelivered,
	notifyNoticeDelivered,
} from "../lib/notifications";
import { prisma } from "../lib/prisma";

type AuthEnv = {
	Variables: Record<string, never>;
};

const internalNotificationRoute = new Hono<AuthEnv>();

function assertPassword(password: string | undefined) {
	if (!password || password !== env.NOTIFICATION_SYNC_PASSWORD) {
		throw Errors.unauthorized("通知同期パスワードが不正です");
	}
}

async function resolveTargetProjectIds(input: {
	deliveryMode: DeliveryMode;
	filterTypes: ProjectType[];
	filterLocations: ProjectLocation[];
	deliveryProjectIds: string[];
}) {
	if (input.deliveryMode === "INDIVIDUAL") {
		return [...new Set(input.deliveryProjectIds)];
	}

	const projects = await prisma.project.findMany({
		where: {
			deletedAt: null,
			type:
				input.filterTypes.length > 0 ? { in: input.filterTypes } : undefined,
			location:
				input.filterLocations.length > 0
					? { in: input.filterLocations }
					: undefined,
		},
		select: { id: true },
	});

	return projects.map(project => project.id);
}

async function ensureFormDeliveries(
	formAuthorizationId: string,
	projectIds: string[]
): Promise<string[]> {
	if (projectIds.length === 0) return [];

	const uniqueProjectIds = [...new Set(projectIds)];

	await prisma.formDelivery.createMany({
		data: uniqueProjectIds.map(projectId => ({
			formAuthorizationId,
			projectId,
		})),
		skipDuplicates: true,
	});

	return uniqueProjectIds;
}

async function ensureNoticeDeliveries(
	noticeAuthorizationId: string,
	projectIds: string[]
): Promise<string[]> {
	if (projectIds.length === 0) return [];

	const uniqueProjectIds = [...new Set(projectIds)];

	await prisma.noticeDelivery.createMany({
		data: uniqueProjectIds.map(projectId => ({
			noticeAuthorizationId,
			projectId,
		})),
		skipDuplicates: true,
	});

	return uniqueProjectIds;
}

function createNoticeBodyPreview(body: string | null): string {
	if (!body) return "";
	const plain = body
		.replace(/<[^>]*>/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	return plain.length <= 120 ? plain : `${plain.slice(0, 120)}...`;
}

async function processFormAuthorizations(formAuthIds: Array<{ id: string }>) {
	let formNotified = 0;

	for (const authId of formAuthIds) {
		const auth = await prisma.formAuthorization.findUnique({
			where: { id: authId.id },
			select: {
				id: true,
				deliveryMode: true,
				filterTypes: true,
				filterLocations: true,
				form: { select: { title: true, deletedAt: true } },
				deliveries: { select: { projectId: true } },
			},
		});
		if (!auth || auth.form.deletedAt) continue;

		const targetProjectIds = await resolveTargetProjectIds({
			deliveryMode: auth.deliveryMode,
			filterTypes: auth.filterTypes,
			filterLocations: auth.filterLocations,
			deliveryProjectIds: auth.deliveries.map(delivery => delivery.projectId),
		});

		const projectIds = await ensureFormDeliveries(auth.id, targetProjectIds);
		if (projectIds.length === 0) {
			continue;
		}

		const ok = await notifyFormDelivered({
			formTitle: auth.form.title,
			projectIds,
		});

		if (ok) {
			await prisma.$executeRaw(Prisma.sql`
				UPDATE "FormAuthorization"
				SET "deliveryNotifiedAt" = NOW()
				WHERE "id" = ${auth.id}
					AND "deliveryNotifiedAt" IS NULL
			`);
			formNotified += 1;
		}
	}

	return formNotified;
}

async function processNoticeAuthorizations(
	noticeAuthIds: Array<{ id: string }>
) {
	let noticeNotified = 0;

	for (const authId of noticeAuthIds) {
		const auth = await prisma.noticeAuthorization.findUnique({
			where: { id: authId.id },
			select: {
				id: true,
				deliveryMode: true,
				filterTypes: true,
				filterLocations: true,
				notice: { select: { title: true, body: true, deletedAt: true } },
				deliveries: { select: { projectId: true } },
			},
		});
		if (!auth || auth.notice.deletedAt) continue;

		const targetProjectIds = await resolveTargetProjectIds({
			deliveryMode: auth.deliveryMode,
			filterTypes: auth.filterTypes,
			filterLocations: auth.filterLocations,
			deliveryProjectIds: auth.deliveries.map(delivery => delivery.projectId),
		});

		const projectIds = await ensureNoticeDeliveries(auth.id, targetProjectIds);
		if (projectIds.length === 0) {
			continue;
		}

		const ok = await notifyNoticeDelivered({
			noticeTitle: auth.notice.title,
			noticeBodyPreview: createNoticeBodyPreview(auth.notice.body),
			projectIds,
		});

		if (ok) {
			await prisma.$executeRaw(Prisma.sql`
				UPDATE "NoticeAuthorization"
				SET "deliveryNotifiedAt" = NOW()
				WHERE "id" = ${auth.id}
					AND "deliveryNotifiedAt" IS NULL
			`);
			noticeNotified += 1;
		}
	}

	return noticeNotified;
}

internalNotificationRoute.post("/sync", async c => {
	assertPassword(c.req.header("x-notification-password"));

	const [formAuthIds, noticeAuthIds] = await Promise.all([
		prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
			SELECT fa."id"
			FROM "FormAuthorization" fa
			JOIN "Form" f ON f."id" = fa."formId"
			WHERE fa."status" = 'APPROVED'
				AND fa."scheduledSendAt" <= NOW()
				AND fa."deliveryNotifiedAt" IS NULL
				AND f."deletedAt" IS NULL
		`),
		prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
			SELECT na."id"
			FROM "NoticeAuthorization" na
			JOIN "Notice" n ON n."id" = na."noticeId"
			WHERE na."status" = 'APPROVED'
				AND na."deliveredAt" <= NOW()
				AND na."deliveryNotifiedAt" IS NULL
				AND n."deletedAt" IS NULL
		`),
	]);

	const [formNotified, noticeNotified] = await Promise.all([
		processFormAuthorizations(formAuthIds),
		processNoticeAuthorizations(noticeAuthIds),
	]);

	return c.json({
		success: true as const,
		notified: {
			forms: formNotified,
			notices: noticeNotified,
		},
		pending: {
			forms: formAuthIds.length - formNotified,
			notices: noticeAuthIds.length - noticeNotified,
		},
	});
});

export { internalNotificationRoute };
