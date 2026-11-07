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
		committeeMember: { findFirst: vi.fn() },
		noticeAuthorization: { findFirst: vi.fn(), update: vi.fn() },
	};
	return { prisma };
});

vi.mock("../lib/firebase", () => ({
	auth: { verifyIdToken: vi.fn() },
}));

vi.mock("../lib/notifications", () => ({
	notifyNoticeAuthorizationDecided: vi.fn().mockResolvedValue(undefined),
	notifyNoticeAuthorizationRequested: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/project-delivery-targets", () => ({
	ensureNoticeDeliveriesForAuthorization: vi.fn(),
}));

import { errorHandler } from "../lib/error-handler";
import { auth as firebaseAuth } from "../lib/firebase";
import { prisma } from "../lib/prisma";
import { ensureNoticeDeliveriesForAuthorization } from "../lib/project-delivery-targets";
import { committeeNoticeRoute } from "./committee-notice";

const noticeId = "clnotice0000000000000000a";
const noticeAuthorizationId = "clnoticeauth000000000000a";
const user = { id: "user-1", firebaseUid: "uid-1" };
const committeeMember = { id: "member-1", userId: user.id, deletedAt: null };
const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

function makeApp() {
	const app = new Hono();
	app.onError(errorHandler);
	app.route("/committee/notices", committeeNoticeRoute);
	return app;
}

const patch = (path, status) =>
	makeApp().request(path, {
		method: "PATCH",
		headers: {
			Authorization: "Bearer valid-token",
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ status }),
	});

beforeEach(() => {
	vi.clearAllMocks();
	firebaseAuth.verifyIdToken.mockResolvedValue({ uid: user.firebaseUid });
	prisma.user.findFirst.mockResolvedValue({
		...user,
		committeeMember: { ...committeeMember, permissions: [] },
	});
	prisma.committeeMember.findFirst.mockResolvedValue({
		...committeeMember,
		permissions: [],
	});
});

describe("PATCH /committee/notices/:noticeId/authorizations/:authorizationId", () => {
	const setup = deliveryMode => {
		const authorization = {
			id: noticeAuthorizationId,
			noticeId,
			status: "PENDING",
			deliveryMode,
			requestedById: "user-2",
			requestedToId: user.id,
			deliveredAt: future,
			notice: { deletedAt: null, title: "お知らせ" },
		};
		prisma.noticeAuthorization.findFirst.mockResolvedValue(authorization);
		prisma.noticeAuthorization.update.mockResolvedValue({
			...authorization,
			decidedAt: new Date(),
		});
	};
	const path = `/committee/notices/${noticeId}/authorizations/${noticeAuthorizationId}`;

	it("カテゴリ指定の承認時に delivery を作る", async () => {
		setup("CATEGORY");

		const res = await patch(path, "APPROVED");

		expect(res.status).toBe(200);
		expect(ensureNoticeDeliveriesForAuthorization).toHaveBeenCalledWith(
			prisma,
			noticeAuthorizationId
		);
	});

	it("個別指定の承認時は delivery を作らない", async () => {
		setup("INDIVIDUAL");

		const res = await patch(path, "APPROVED");

		expect(res.status).toBe(200);
		expect(ensureNoticeDeliveriesForAuthorization).not.toHaveBeenCalled();
	});

	it("却下時は delivery を作らない", async () => {
		setup("CATEGORY");

		const res = await patch(path, "REJECTED");

		expect(res.status).toBe(200);
		expect(ensureNoticeDeliveriesForAuthorization).not.toHaveBeenCalled();
	});
});
