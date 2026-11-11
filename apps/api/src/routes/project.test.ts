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

vi.mock("../lib/project-notification-status", () => ({
	getProjectNotificationStatus: vi.fn(),
}));

import { errorHandler } from "../lib/error-handler";
import { auth as firebaseAuth } from "../lib/firebase";
import { prisma } from "../lib/prisma";
import { syncCategoryDeliveriesForProject } from "../lib/project-delivery-targets";
import { getProjectNotificationStatus } from "../lib/project-notification-status";
import { projectRoute } from "./project";

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
	app.route("/project", projectRoute);
	return app;
}

beforeEach(() => {
	vi.clearAllMocks();
	firebaseAuth.verifyIdToken.mockResolvedValue({ uid: user.firebaseUid });
	prisma.user.findFirst.mockResolvedValue(user);
	prisma.project.findFirst.mockResolvedValue(project);
	prisma.projectMember.findFirst.mockResolvedValue({ id: "member-1" });
});

describe("GET /project/:projectId/notification-status", () => {
	const status = {
		hasUnansweredForms: true,
		hasUncheckedNotices: false,
		hasUnreadInquiryComments: false,
		latestActivityAt: null,
	};
	const request = () =>
		makeApp().request(`/project/${project.id}/notification-status`, {
			headers,
		});

	beforeEach(() => {
		getProjectNotificationStatus.mockResolvedValue(status);
	});

	it("一般メンバーには責任者限定の申請を含めない", async () => {
		const res = await request();

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual(status);
		expect(getProjectNotificationStatus).toHaveBeenCalledWith({
			projectId: project.id,
			userId: user.id,
			canAccessOwnerOnly: false,
		});
	});

	it("責任者には責任者限定の申請を含める", async () => {
		prisma.project.findFirst.mockResolvedValue({
			...project,
			ownerId: user.id,
		});

		await request();

		expect(getProjectNotificationStatus).toHaveBeenCalledWith({
			projectId: project.id,
			userId: user.id,
			canAccessOwnerOnly: true,
		});
	});
});

describe("POST /project/create", () => {
	it("作成した企画のカテゴリ配信の delivery を同期する", async () => {
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
});

describe("PATCH /project/:projectId/detail", () => {
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

	it("区分の変更時に delivery を同期する", async () => {
		const res = await patchDetail({ type: "FOOD" });

		expect(res.status).toBe(200);
		expect(syncCategoryDeliveriesForProject).toHaveBeenCalledWith(
			prisma,
			project.id
		);
	});

	it("場所の変更時に delivery を同期する", async () => {
		const res = await patchDetail({ location: "OUTDOOR" });

		expect(res.status).toBe(200);
		expect(syncCategoryDeliveriesForProject).toHaveBeenCalledWith(
			prisma,
			project.id
		);
	});

	it("区分・場所を変えない更新では delivery を同期しない", async () => {
		const res = await patchDetail({ organizationName: "別の団体" });

		expect(res.status).toBe(200);
		expect(syncCategoryDeliveriesForProject).not.toHaveBeenCalled();
	});
});
