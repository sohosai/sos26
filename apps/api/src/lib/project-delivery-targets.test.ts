// @ts-nocheck - テストファイルでは Prisma のモック型を厳密に扱わない
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	ensureFormDeliveriesForAuthorization,
	ensureNoticeDeliveriesForAuthorization,
	syncCategoryDeliveriesForProject,
} from "./project-delivery-targets";

const tx = {
	project: { findFirst: vi.fn(), findMany: vi.fn() },
	formAuthorization: { findFirst: vi.fn(), findMany: vi.fn() },
	noticeAuthorization: { findFirst: vi.fn(), findMany: vi.fn() },
	formDelivery: { createMany: vi.fn(), deleteMany: vi.fn() },
	noticeDelivery: { createMany: vi.fn(), deleteMany: vi.fn() },
};

const project = { id: "project-1", type: "NORMAL", location: "INDOOR" };

const matchesProject = {
	AND: [
		{
			OR: [
				{ filterTypes: { isEmpty: true } },
				{ filterTypes: { has: "NORMAL" } },
			],
		},
		{
			OR: [
				{ filterLocations: { isEmpty: true } },
				{ filterLocations: { has: "INDOOR" } },
			],
		},
	],
};

const expectedCategoryWhere = {
	deliveryMode: "CATEGORY",
	status: "APPROVED",
	...matchesProject,
};

beforeEach(() => {
	vi.clearAllMocks();
	tx.project.findFirst.mockResolvedValue(project);
	tx.project.findMany.mockResolvedValue([]);
	tx.formAuthorization.findMany.mockResolvedValue([]);
	tx.noticeAuthorization.findMany.mockResolvedValue([]);
});

describe("syncCategoryDeliveriesForProject", () => {
	it("企画の区分・場所に合う承認済みのカテゴリ配信の delivery を作る", async () => {
		tx.formAuthorization.findMany.mockResolvedValue([
			{ id: "form-auth-1" },
			{ id: "form-auth-2" },
		]);
		tx.noticeAuthorization.findMany.mockResolvedValue([
			{ id: "notice-auth-1" },
		]);

		await syncCategoryDeliveriesForProject(tx, project.id);

		expect(tx.formAuthorization.findMany).toHaveBeenCalledWith({
			where: { ...expectedCategoryWhere, form: { deletedAt: null } },
			select: { id: true },
		});
		expect(tx.noticeAuthorization.findMany).toHaveBeenCalledWith({
			where: { ...expectedCategoryWhere, notice: { deletedAt: null } },
			select: { id: true },
		});
		expect(tx.formDelivery.createMany).toHaveBeenCalledWith({
			data: [
				{ formAuthorizationId: "form-auth-1", projectId: project.id },
				{ formAuthorizationId: "form-auth-2", projectId: project.id },
			],
			skipDuplicates: true,
		});
		expect(tx.noticeDelivery.createMany).toHaveBeenCalledWith({
			data: [{ noticeAuthorizationId: "notice-auth-1", projectId: project.id }],
			skipDuplicates: true,
		});
	});

	it("配信前に対象外になった delivery を削除し、配信後のものは残す", async () => {
		await syncCategoryDeliveriesForProject(tx, project.id);

		const formWhere = tx.formDelivery.deleteMany.mock.calls[0][0].where;
		expect(formWhere.projectId).toBe(project.id);
		expect(formWhere.formAuthorization).toMatchObject({
			deliveryMode: "CATEGORY",
			NOT: matchesProject,
		});
		expect(formWhere.formAuthorization.scheduledSendAt.gt).toBeInstanceOf(Date);

		const noticeWhere = tx.noticeDelivery.deleteMany.mock.calls[0][0].where;
		expect(noticeWhere.projectId).toBe(project.id);
		expect(noticeWhere.noticeAuthorization).toMatchObject({
			deliveryMode: "CATEGORY",
			NOT: matchesProject,
		});
		expect(noticeWhere.noticeAuthorization.deliveredAt.gt).toBeInstanceOf(Date);
	});

	it("対象の配信が無ければ delivery を作らない", async () => {
		await syncCategoryDeliveriesForProject(tx, project.id);

		expect(tx.formDelivery.createMany).not.toHaveBeenCalled();
		expect(tx.noticeDelivery.createMany).not.toHaveBeenCalled();
	});

	it("削除済みの企画には delivery を作らない", async () => {
		tx.project.findFirst.mockResolvedValue(null);

		await syncCategoryDeliveriesForProject(tx, project.id);

		expect(tx.formDelivery.deleteMany).not.toHaveBeenCalled();
		expect(tx.formAuthorization.findMany).not.toHaveBeenCalled();
		expect(tx.noticeAuthorization.findMany).not.toHaveBeenCalled();
	});
});

describe("ensureFormDeliveriesForAuthorization", () => {
	it("承認時点の対象企画に delivery を作る", async () => {
		tx.formAuthorization.findFirst.mockResolvedValue({
			id: "form-auth-1",
			filterTypes: ["NORMAL"],
			filterLocations: [],
		});
		tx.project.findMany.mockResolvedValue([{ id: "p1" }, { id: "p2" }]);

		await ensureFormDeliveriesForAuthorization(tx, "form-auth-1");

		expect(tx.project.findMany).toHaveBeenCalledWith({
			where: { deletedAt: null, type: { in: ["NORMAL"] } },
			select: { id: true },
		});
		expect(tx.formDelivery.createMany).toHaveBeenCalledWith({
			data: [
				{ formAuthorizationId: "form-auth-1", projectId: "p1" },
				{ formAuthorizationId: "form-auth-1", projectId: "p2" },
			],
			skipDuplicates: true,
		});
	});

	it("承認済みのカテゴリ配信でなければ delivery を作らない", async () => {
		tx.formAuthorization.findFirst.mockResolvedValue(null);

		await ensureFormDeliveriesForAuthorization(tx, "form-auth-1");

		expect(tx.project.findMany).not.toHaveBeenCalled();
		expect(tx.formDelivery.createMany).not.toHaveBeenCalled();
	});
});

describe("ensureNoticeDeliveriesForAuthorization", () => {
	it("承認時点の対象企画に delivery を作る", async () => {
		tx.noticeAuthorization.findFirst.mockResolvedValue({
			id: "notice-auth-1",
			filterTypes: [],
			filterLocations: ["INDOOR"],
		});
		tx.project.findMany.mockResolvedValue([{ id: "p1" }]);

		await ensureNoticeDeliveriesForAuthorization(tx, "notice-auth-1");

		expect(tx.project.findMany).toHaveBeenCalledWith({
			where: { deletedAt: null, location: { in: ["INDOOR"] } },
			select: { id: true },
		});
		expect(tx.noticeDelivery.createMany).toHaveBeenCalledWith({
			data: [{ noticeAuthorizationId: "notice-auth-1", projectId: "p1" }],
			skipDuplicates: true,
		});
	});

	it("承認済みのカテゴリ配信でなければ delivery を作らない", async () => {
		tx.noticeAuthorization.findFirst.mockResolvedValue(null);

		await ensureNoticeDeliveriesForAuthorization(tx, "notice-auth-1");

		expect(tx.project.findMany).not.toHaveBeenCalled();
		expect(tx.noticeDelivery.createMany).not.toHaveBeenCalled();
	});
});
