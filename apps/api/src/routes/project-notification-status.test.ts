// @ts-nocheck - テストファイルでは res.json() の unknown 型を許容
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/env", () => ({
	env: {
		PORT: 3000,
		CORS_ORIGIN: ["http://localhost:5173"],
		SENDGRID_API_KEY: "test-sendgrid-key",
		EMAIL_FROM: "test@example.com",
		EMAIL_SANDBOX: true,
		FIREBASE_PROJECT_ID: "test-project",
		FIREBASE_CLIENT_EMAIL: "test@test.iam.gserviceaccount.com",
		FIREBASE_PRIVATE_KEY: "test-private-key",
		APP_URL: "http://localhost:5173",
	},
}));

vi.mock("../lib/prisma", () => {
	const prisma = {
		$transaction: vi.fn(callback => callback(prisma)),
		user: { findFirst: vi.fn() },
		project: {
			findFirst: vi.fn(),
			findUnique: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
		},
		projectMember: { findFirst: vi.fn() },
		projectRegistrationForm: { findMany: vi.fn() },
		formDelivery: { count: vi.fn(), findMany: vi.fn(), createMany: vi.fn() },
		formResponse: { findMany: vi.fn() },
		noticeDelivery: { count: vi.fn(), findMany: vi.fn(), createMany: vi.fn() },
		inquiry: { findMany: vi.fn() },
	};
	return { prisma, handlePrismaError: vi.fn(e => Promise.reject(e)) };
});

vi.mock("../lib/firebase", () => ({
	auth: { verifyIdToken: vi.fn() },
}));

vi.mock("../lib/project-check", () => ({
	findOtherPrivilegedProject: vi.fn().mockResolvedValue(null),
}));

vi.mock("../lib/project-delivery-targets", () => ({
	syncCategoryDeliveriesForProject: vi.fn(),
}));

import { errorHandler } from "../lib/error-handler";
import { auth as firebaseAuth } from "../lib/firebase";
import { prisma } from "../lib/prisma";
import { syncCategoryDeliveriesForProject } from "../lib/project-delivery-targets";
import { projectRoute } from "./project";
import { projectFormRoute } from "./project-form";
import { projectNoticeRoute } from "./project-notice";

const user = { id: "user-1", firebaseUid: "uid-1", committeeMember: null };
const project = {
	id: "project-1",
	name: "テスト企画",
	type: "NORMAL",
	location: "INDOOR",
	ownerId: "owner-1",
	subOwnerId: null,
	deletedAt: null,
};
const headers = {
	Authorization: "Bearer valid-token",
	"Content-Type": "application/json",
};

function makeApp() {
	const app = new Hono();
	app.onError(errorHandler);
	app.route("/project/:projectId/forms", projectFormRoute);
	app.route("/project", projectRoute);
	app.route("/project", projectNoticeRoute);
	return app;
}

beforeEach(() => {
	vi.clearAllMocks();
	firebaseAuth.verifyIdToken.mockResolvedValue({ uid: user.firebaseUid });
	prisma.user.findFirst.mockResolvedValue(user);
	prisma.project.findFirst.mockResolvedValue(project);
	prisma.projectMember.findFirst.mockResolvedValue({ id: "member-1" });
	prisma.formDelivery.count.mockResolvedValue(0);
	prisma.noticeDelivery.count.mockResolvedValue(0);
	prisma.inquiry.findMany.mockResolvedValue([]);
});

describe("GET /project/:projectId/notification-status", () => {
	const request = () =>
		makeApp().request(`/project/${project.id}/notification-status`, {
			headers,
		});

	const inquiry = (overrides = {}) => ({
		creatorRole: "PROJECT",
		createdAt: new Date("2026-01-01T00:00:00Z"),
		sentAt: null,
		comments: [{ createdAt: new Date("2026-01-02T00:00:00Z"), sentAt: null }],
		commentReadStatuses: [],
		...overrides,
	});

	it("未処理が無ければすべて false を返す", async () => {
		const res = await request();

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			hasUnansweredForms: false,
			hasUncheckedNotices: false,
			hasUnreadInquiryComments: false,
		});
	});

	it("未回答の申請と未確認のお知らせを true で返す", async () => {
		prisma.formDelivery.count.mockResolvedValue(2);
		prisma.noticeDelivery.count.mockResolvedValue(1);

		const body = await (await request()).json();

		expect(body.hasUnansweredForms).toBe(true);
		expect(body.hasUncheckedNotices).toBe(true);
	});

	it("配信済みで未回答の申請と、配信済みで未読のお知らせだけを数える", async () => {
		await request();

		const formWhere = prisma.formDelivery.count.mock.calls[0][0].where;
		expect(formWhere.projectId).toBe(project.id);
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
		expect(noticeWhere.projectId).toBe(project.id);
		expect(noticeWhere.readStatuses).toEqual({
			none: { userId: user.id },
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
		await request();

		const { where } = prisma.inquiry.findMany.mock.calls[0][0];
		expect(where).toMatchObject({
			projectId: project.id,
			deletedAt: null,
			isDraft: false,
			assignees: {
				some: { userId: user.id, side: "PROJECT", deletedAt: null },
			},
		});
	});

	it("一般メンバーには責任者限定の申請を数えない", async () => {
		await request();

		const { where } = prisma.formDelivery.count.mock.calls[0][0];
		expect(where.formAuthorization.ownerOnly).toBe(false);
	});

	it("責任者には責任者限定の申請も数える", async () => {
		prisma.project.findFirst.mockResolvedValue({
			...project,
			ownerId: user.id,
		});

		await request();

		const { where } = prisma.formDelivery.count.mock.calls[0][0];
		expect(where.formAuthorization).not.toHaveProperty("ownerOnly");
	});

	it("既読のあとに届いたコメントがあれば未読にする", async () => {
		prisma.inquiry.findMany.mockResolvedValue([
			inquiry({
				commentReadStatuses: [{ lastReadAt: new Date("2026-01-01T12:00:00Z") }],
			}),
		]);

		const body = await (await request()).json();

		expect(body.hasUnreadInquiryComments).toBe(true);
	});

	it("最新のコメントより後に読んでいれば既読にする", async () => {
		prisma.inquiry.findMany.mockResolvedValue([
			inquiry({
				commentReadStatuses: [{ lastReadAt: new Date("2026-01-03T00:00:00Z") }],
			}),
		]);

		const body = await (await request()).json();

		expect(body.hasUnreadInquiryComments).toBe(false);
	});

	it("最新のコメントと同時刻に読んでいれば既読にする", async () => {
		prisma.inquiry.findMany.mockResolvedValue([
			inquiry({
				commentReadStatuses: [{ lastReadAt: new Date("2026-01-02T00:00:00Z") }],
			}),
		]);

		const body = await (await request()).json();

		expect(body.hasUnreadInquiryComments).toBe(false);
	});

	it("実委が作成した問い合わせは未読のコメントが無くても未読にする", async () => {
		prisma.inquiry.findMany.mockResolvedValue([
			inquiry({
				creatorRole: "COMMITTEE",
				sentAt: new Date("2026-01-01T00:00:00Z"),
				comments: [],
			}),
		]);

		const body = await (await request()).json();

		expect(body.hasUnreadInquiryComments).toBe(true);
	});
});

describe("カテゴリ配信の delivery の補完", () => {
	it("企画の作成時に delivery を補完する", async () => {
		prisma.project.findUnique.mockResolvedValue(null);
		prisma.projectRegistrationForm.findMany.mockResolvedValue([]);
		prisma.project.create.mockReturnValue(
			Promise.resolve({ ...project, id: "new-project" })
		);

		const res = await makeApp().request("/project/create", {
			method: "POST",
			headers,
			body: JSON.stringify({
				name: "新しい企画",
				namePhonetic: "あたらしいきかく",
				organizationName: "新しい団体",
				organizationNamePhonetic: "あたらしいだんたい",
				type: "NORMAL",
				location: "INDOOR",
				agreedToRegistrationConstraints: true,
				agreedToInfoImmutability: true,
			}),
		});

		expect(res.status).toBe(200);
		expect(syncCategoryDeliveriesForProject).toHaveBeenCalledWith(
			prisma,
			"new-project"
		);
	});

	const patchDetail = async body => {
		prisma.project.findFirst.mockResolvedValue({
			...project,
			ownerId: user.id,
		});
		prisma.project.update.mockResolvedValue(project);

		return makeApp().request(`/project/${project.id}/detail`, {
			method: "PATCH",
			headers,
			body: JSON.stringify(body),
		});
	};

	it("区分の変更時に delivery を補完する", async () => {
		const res = await patchDetail({ type: "FOOD" });

		expect(res.status).toBe(200);
		expect(syncCategoryDeliveriesForProject).toHaveBeenCalledWith(
			prisma,
			project.id
		);
	});

	it("場所の変更時に delivery を補完する", async () => {
		const res = await patchDetail({ location: "OUTDOOR" });

		expect(res.status).toBe(200);
		expect(syncCategoryDeliveriesForProject).toHaveBeenCalledWith(
			prisma,
			project.id
		);
	});

	it("区分・場所を変えない更新では delivery を補完しない", async () => {
		const res = await patchDetail({ organizationName: "別の団体" });

		expect(res.status).toBe(200);
		expect(syncCategoryDeliveriesForProject).not.toHaveBeenCalled();
	});
});

describe("企画側の一覧取得", () => {
	beforeEach(() => {
		prisma.formDelivery.findMany.mockResolvedValue([]);
		prisma.formResponse.findMany.mockResolvedValue([]);
		prisma.noticeDelivery.findMany.mockResolvedValue([]);
	});

	it("申請一覧の取得では delivery を作らない", async () => {
		const res = await makeApp().request(`/project/${project.id}/forms`, {
			headers,
		});

		expect(res.status).toBe(200);
		expect(prisma.formDelivery.createMany).not.toHaveBeenCalled();
	});

	it("お知らせ一覧の取得では delivery を作らない", async () => {
		const res = await makeApp().request(`/project/${project.id}/notices`, {
			headers,
		});

		expect(res.status).toBe(200);
		expect(prisma.noticeDelivery.createMany).not.toHaveBeenCalled();
	});
});
