import type { User } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../prisma", () => ({
	prisma: {
		project: {
			findFirst: vi.fn(),
		},
		form: {
			findFirst: vi.fn(),
		},
		formAnswerFile: {
			findMany: vi.fn(),
		},
		formItemEditHistoryFile: {
			findMany: vi.fn(),
		},
	},
}));

import { prisma } from "../../prisma";
import { canAccessFormFile } from "./form-access";

const mockPrisma = vi.mocked(prisma, true);
const mockUser = { id: "user-1" } as User;

describe("canAccessFormFile", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockPrisma.formAnswerFile.findMany.mockResolvedValue([]);
		mockPrisma.formItemEditHistoryFile.findMany.mockResolvedValue([]);
		mockPrisma.project.findFirst.mockResolvedValue(null);
		mockPrisma.form.findFirst.mockResolvedValue(null);
	});

	it("関連がなければ false", async () => {
		await expect(canAccessFormFile("file-1", mockUser)).resolves.toBe(false);
	});

	it("FormAnswer 経由で配信先企画メンバーなら true", async () => {
		mockPrisma.formAnswerFile.findMany.mockResolvedValue([
			{
				answer: {
					formResponse: {
						submittedAt: null,
						formDelivery: {
							projectId: "project-1",
							formAuthorization: {
								formId: "form-1",
							},
						},
					},
				},
			},
		] as never);
		mockPrisma.project.findFirst.mockResolvedValue({
			id: "project-1",
		} as never);

		await expect(canAccessFormFile("file-1", mockUser)).resolves.toBe(true);
		expect(mockPrisma.form.findFirst).not.toHaveBeenCalled();
	});

	it("提出済み FormAnswer 経由で form owner / collaborator なら true", async () => {
		mockPrisma.formAnswerFile.findMany.mockResolvedValue([
			{
				answer: {
					formResponse: {
						submittedAt: new Date(),
						formDelivery: {
							projectId: "project-1",
							formAuthorization: {
								formId: "form-1",
							},
						},
					},
				},
			},
		] as never);
		mockPrisma.project.findFirst.mockResolvedValue(null);
		mockPrisma.form.findFirst.mockResolvedValue({ id: "form-1" } as never);

		await expect(canAccessFormFile("file-1", mockUser)).resolves.toBe(true);
	});

	it("下書き FormAnswer だけなら form owner / collaborator でも false", async () => {
		mockPrisma.formAnswerFile.findMany.mockResolvedValue([
			{
				answer: {
					formResponse: {
						submittedAt: null,
						formDelivery: {
							projectId: "project-1",
							formAuthorization: {
								formId: "form-1",
							},
						},
					},
				},
			},
		] as never);
		mockPrisma.project.findFirst.mockResolvedValue(null);
		mockPrisma.form.findFirst.mockResolvedValue({ id: "form-1" } as never);

		await expect(canAccessFormFile("file-1", mockUser)).resolves.toBe(false);
	});

	it("FormItemEditHistory 経由で form owner / collaborator なら true", async () => {
		mockPrisma.formItemEditHistoryFile.findMany.mockResolvedValue([
			{
				editHistory: {
					projectId: "project-1",
					formItem: {
						formId: "form-1",
					},
				},
			},
		] as never);
		mockPrisma.project.findFirst.mockResolvedValue(null);
		mockPrisma.form.findFirst.mockResolvedValue({ id: "form-1" } as never);

		await expect(canAccessFormFile("file-1", mockUser)).resolves.toBe(true);
	});
});
