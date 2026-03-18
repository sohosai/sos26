import { bureauLabelMap } from "@sos26/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./prisma", () => ({
	prisma: {
		committeeMember: {
			findMany: vi.fn(),
		},
		project: {
			findMany: vi.fn(),
		},
		projectMember: {
			findMany: vi.fn(),
		},
	},
}));

import { prisma } from "./prisma";
import { getUserAffiliations } from "./user-affiliation";

const mockPrisma = vi.mocked(prisma, true);

describe("user-affiliation", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockPrisma.committeeMember.findMany.mockResolvedValue([]);
		mockPrisma.project.findMany.mockResolvedValue([]);
		mockPrisma.projectMember.findMany.mockResolvedValue([]);
	});

	it("実委メンバーでも全企画所属を affiliatedProjects に含める", async () => {
		mockPrisma.committeeMember.findMany.mockResolvedValue([
			{
				userId: "user-1",
				Bureau: "INFO_SYSTEM",
			},
		] as never);
		mockPrisma.project.findMany.mockResolvedValue([
			{
				name: "Beta",
				ownerId: "user-1",
				subOwnerId: null,
			},
			{
				name: "Alpha",
				ownerId: "user-x",
				subOwnerId: "user-1",
			},
		] as never);
		mockPrisma.projectMember.findMany.mockResolvedValue([
			{
				userId: "user-1",
				project: { name: "Gamma" },
			},
			{
				userId: "user-1",
				project: { name: "Beta" },
			},
		] as never);

		const affiliations = await getUserAffiliations(["user-1"]);

		expect(affiliations.get("user-1")).toEqual({
			committeeBureau: bureauLabelMap.INFO_SYSTEM,
			affiliatedProjects: ["Alpha", "Beta", "Gamma"],
		});
	});

	it("owner/subOwner/projectMember の所属をまとめて返す", async () => {
		mockPrisma.project.findMany.mockResolvedValue([
			{
				name: "Delta",
				ownerId: "user-2",
				subOwnerId: "user-3",
			},
		] as never);
		mockPrisma.projectMember.findMany.mockResolvedValue([
			{
				userId: "user-2",
				project: { name: "Beta" },
			},
			{
				userId: "user-3",
				project: { name: "Alpha" },
			},
		] as never);

		const affiliations = await getUserAffiliations([
			"user-2",
			"user-3",
			"user-4",
		]);

		expect(affiliations.get("user-2")).toEqual({
			affiliatedProjects: ["Beta", "Delta"],
		});
		expect(affiliations.get("user-3")).toEqual({
			affiliatedProjects: ["Alpha", "Delta"],
		});
		expect(affiliations.get("user-4")).toEqual({
			affiliatedProjects: [],
		});
	});
});
