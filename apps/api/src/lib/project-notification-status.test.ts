// @ts-nocheck - テストファイルでは Prisma のモック型を厳密に扱わない
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./prisma", () => ({
	prisma: {
		formDelivery: { count: vi.fn(), findFirst: vi.fn() },
		noticeDelivery: { count: vi.fn(), findFirst: vi.fn() },
		inquiry: { findMany: vi.fn() },
	},
}));

import { prisma } from "./prisma";
import { getProjectNotificationStatus } from "./project-notification-status";

const input = {
	projectId: "project-1",
	userId: "user-1",
	canAccessOwnerOnly: false,
};

const inquiry = (overrides = {}) => ({
	creatorRole: "PROJECT",
	createdAt: new Date("2026-01-01T00:00:00Z"),
	sentAt: null,
	comments: [{ createdAt: new Date("2026-01-02T00:00:00Z"), sentAt: null }],
	commentReadStatuses: [],
	...overrides,
});

beforeEach(() => {
	vi.clearAllMocks();
	prisma.formDelivery.count.mockResolvedValue(0);
	prisma.formDelivery.findFirst.mockResolvedValue(null);
	prisma.noticeDelivery.count.mockResolvedValue(0);
	prisma.noticeDelivery.findFirst.mockResolvedValue(null);
	prisma.inquiry.findMany.mockResolvedValue([]);
});

describe("getProjectNotificationStatus", () => {
	it("未処理が無ければすべて false を返す", async () => {
		expect(await getProjectNotificationStatus(input)).toEqual({
			hasUnansweredForms: false,
			hasUncheckedNotices: false,
			hasUnreadInquiryComments: false,
			latestActivityAt: null,
		});
	});

	it("未回答の申請と未確認のお知らせを true で返す", async () => {
		prisma.formDelivery.count.mockResolvedValue(2);
		prisma.noticeDelivery.count.mockResolvedValue(1);

		const status = await getProjectNotificationStatus(input);

		expect(status.hasUnansweredForms).toBe(true);
		expect(status.hasUncheckedNotices).toBe(true);
	});

	it("配信済みで未回答の申請と、配信済みで未読のお知らせだけを数える", async () => {
		await getProjectNotificationStatus(input);

		const formWhere = prisma.formDelivery.count.mock.calls[0][0].where;
		expect(formWhere.projectId).toBe(input.projectId);
		expect(formWhere.responses).toEqual({
			none: { submittedAt: { not: null } },
		});
		expect(formWhere.formAuthorization).toMatchObject({
			status: "APPROVED",
			form: { deletedAt: null },
		});
		expect(formWhere.formAuthorization.scheduledSendAt.lte).toBeInstanceOf(
			Date
		);
		const [noDeadline, lateAllowed, beforeDeadline] =
			formWhere.formAuthorization.OR;
		expect(noDeadline).toEqual({ deadlineAt: null });
		expect(lateAllowed).toEqual({ allowLateResponse: true });
		expect(beforeDeadline.deadlineAt.gte).toBeInstanceOf(Date);

		const noticeWhere = prisma.noticeDelivery.count.mock.calls[0][0].where;
		expect(noticeWhere.projectId).toBe(input.projectId);
		expect(noticeWhere.readStatuses).toEqual({
			none: { userId: input.userId },
		});
		expect(noticeWhere.noticeAuthorization).toMatchObject({
			status: "APPROVED",
			notice: { deletedAt: null },
		});
		expect(noticeWhere.noticeAuthorization.deliveredAt.lte).toBeInstanceOf(
			Date
		);
	});

	it("自分が担当する送信済みの問い合わせだけを見る", async () => {
		await getProjectNotificationStatus(input);

		const { where } = prisma.inquiry.findMany.mock.calls[0][0];
		expect(where).toMatchObject({
			projectId: input.projectId,
			deletedAt: null,
			isDraft: false,
			assignees: {
				some: { userId: input.userId, side: "PROJECT", deletedAt: null },
			},
		});
	});

	it("責任者限定の申請を扱えないユーザーには数えない", async () => {
		await getProjectNotificationStatus(input);

		const { where } = prisma.formDelivery.count.mock.calls[0][0];
		expect(where.formAuthorization.ownerOnly).toBe(false);
	});

	it("責任者限定の申請を扱えるユーザーには数える", async () => {
		await getProjectNotificationStatus({ ...input, canAccessOwnerOnly: true });

		const { where } = prisma.formDelivery.count.mock.calls[0][0];
		expect(where.formAuthorization).not.toHaveProperty("ownerOnly");
	});

	it("既読のあとに届いたコメントがあれば未読にする", async () => {
		prisma.inquiry.findMany.mockResolvedValue([
			inquiry({
				commentReadStatuses: [{ lastReadAt: new Date("2026-01-01T12:00:00Z") }],
			}),
		]);

		const status = await getProjectNotificationStatus(input);

		expect(status.hasUnreadInquiryComments).toBe(true);
	});

	it("最新のコメントより後に読んでいれば既読にする", async () => {
		prisma.inquiry.findMany.mockResolvedValue([
			inquiry({
				commentReadStatuses: [{ lastReadAt: new Date("2026-01-03T00:00:00Z") }],
			}),
		]);

		const status = await getProjectNotificationStatus(input);

		expect(status.hasUnreadInquiryComments).toBe(false);
	});

	it("最新のコメントと同時刻に読んでいれば既読にする", async () => {
		prisma.inquiry.findMany.mockResolvedValue([
			inquiry({
				commentReadStatuses: [{ lastReadAt: new Date("2026-01-02T00:00:00Z") }],
			}),
		]);

		const status = await getProjectNotificationStatus(input);

		expect(status.hasUnreadInquiryComments).toBe(false);
	});

	it("実委が作成した問い合わせはコメントが無くても未読にする", async () => {
		prisma.inquiry.findMany.mockResolvedValue([
			inquiry({
				creatorRole: "COMMITTEE",
				sentAt: new Date("2026-01-01T00:00:00Z"),
				comments: [],
			}),
		]);

		const status = await getProjectNotificationStatus(input);

		expect(status.hasUnreadInquiryComments).toBe(true);
	});

	it("配信と実委からの返信のうち最新の時刻を latestActivityAt で返す", async () => {
		const latest = new Date("2026-01-05T00:00:00Z");
		prisma.formDelivery.findFirst.mockResolvedValue({
			formAuthorization: { scheduledSendAt: new Date("2026-01-03T00:00:00Z") },
		});
		prisma.noticeDelivery.findFirst.mockResolvedValue({
			noticeAuthorization: { deliveredAt: latest },
		});
		prisma.inquiry.findMany.mockResolvedValue([inquiry()]);

		const status = await getProjectNotificationStatus(input);

		expect(status.latestActivityAt).toEqual(latest);
	});

	it("責任者限定の申請も latestActivityAt の対象にする", async () => {
		await getProjectNotificationStatus(input);

		const { where } = prisma.formDelivery.findFirst.mock.calls[0][0];
		expect(where.formAuthorization).not.toHaveProperty("ownerOnly");
	});
});
