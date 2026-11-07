import type { GetProjectNotificationStatusResponse } from "@sos26/shared";
import {
	committeeActivitySelect,
	getLatestCommitteeActivityAt,
	hasUnreadCommitteeActivity,
} from "./inquiry-activity";
import { prisma } from "./prisma";

type ProjectNotificationInput = {
	projectId: string;
	userId: string;
	canAccessOwnerOnly: boolean;
};

async function fetchFormStatus(
	{ projectId, canAccessOwnerOnly }: ProjectNotificationInput,
	now: Date
) {
	const deliveredAuthorization = {
		status: "APPROVED",
		scheduledSendAt: { lte: now },
		form: { deletedAt: null },
	} as const;

	const [unansweredCount, latestDelivery] = await Promise.all([
		prisma.formDelivery.count({
			where: {
				projectId,
				formAuthorization: {
					...deliveredAuthorization,
					OR: [
						{ deadlineAt: null },
						{ allowLateResponse: true },
						{ deadlineAt: { gte: now } },
					],
					...(canAccessOwnerOnly ? {} : { ownerOnly: false }),
				},
				responses: { none: { submittedAt: { not: null } } },
			},
		}),
		// 責任者限定の申請も一覧には表示されるので、権限で絞らない
		prisma.formDelivery.findFirst({
			where: { projectId, formAuthorization: deliveredAuthorization },
			select: { formAuthorization: { select: { scheduledSendAt: true } } },
			orderBy: { formAuthorization: { scheduledSendAt: "desc" } },
		}),
	]);

	return {
		hasUnansweredForms: unansweredCount > 0,
		latestDeliveredAt:
			latestDelivery?.formAuthorization.scheduledSendAt ?? null,
	};
}

async function fetchNoticeStatus(
	{ projectId, userId }: ProjectNotificationInput,
	now: Date
) {
	const deliveredDelivery = {
		projectId,
		noticeAuthorization: {
			status: "APPROVED",
			deliveredAt: { lte: now },
			notice: { deletedAt: null },
		},
	} as const;

	const [uncheckedCount, latestDelivery] = await Promise.all([
		prisma.noticeDelivery.count({
			where: {
				...deliveredDelivery,
				readStatuses: { none: { userId } },
			},
		}),
		prisma.noticeDelivery.findFirst({
			where: deliveredDelivery,
			select: { noticeAuthorization: { select: { deliveredAt: true } } },
			orderBy: { noticeAuthorization: { deliveredAt: "desc" } },
		}),
	]);

	return {
		hasUncheckedNotices: uncheckedCount > 0,
		latestDeliveredAt: latestDelivery?.noticeAuthorization.deliveredAt ?? null,
	};
}

async function fetchInquiryStatus({
	projectId,
	userId,
}: ProjectNotificationInput) {
	const inquiries = await prisma.inquiry.findMany({
		where: {
			projectId,
			deletedAt: null,
			isDraft: false,
			assignees: {
				some: { userId, side: "PROJECT", deletedAt: null },
			},
			OR: [
				{ creatorRole: "COMMITTEE" },
				{
					comments: {
						some: {
							deletedAt: null,
							isDraft: false,
							senderRole: "COMMITTEE",
						},
					},
				},
			],
		},
		select: {
			creatorRole: true,
			createdAt: true,
			sentAt: true,
			...committeeActivitySelect(userId),
		},
	});

	return {
		hasUnreadInquiryComments: inquiries.some(hasUnreadCommitteeActivity),
		latestActivityAts: inquiries.map(getLatestCommitteeActivityAt),
	};
}

function latestOf(dates: Array<Date | null>): Date | null {
	return dates.reduce<Date | null>(
		(latest, date) =>
			date && (!latest || date.getTime() > latest.getTime()) ? date : latest,
		null
	);
}

export async function getProjectNotificationStatus(
	input: ProjectNotificationInput
): Promise<GetProjectNotificationStatusResponse> {
	const now = new Date();
	const [forms, notices, inquiries] = await Promise.all([
		fetchFormStatus(input, now),
		fetchNoticeStatus(input, now),
		fetchInquiryStatus(input),
	]);

	return {
		hasUnansweredForms: forms.hasUnansweredForms,
		hasUncheckedNotices: notices.hasUncheckedNotices,
		hasUnreadInquiryComments: inquiries.hasUnreadInquiryComments,
		latestActivityAt: latestOf([
			forms.latestDeliveredAt,
			notices.latestDeliveredAt,
			...inquiries.latestActivityAts,
		]),
	};
}
