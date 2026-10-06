import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../prisma", () => ({
	prisma: {
		user: { findMany: vi.fn() },
		noticeAttachment: { findMany: vi.fn() },
		inquiryAttachment: { findMany: vi.fn() },
		formAttachment: { findMany: vi.fn() },
		formAnswerFile: { findMany: vi.fn() },
		formItemEditHistoryFile: { findMany: vi.fn() },
		projectRegistrationFormItemEditHistoryFile: { findMany: vi.fn() },
		projectRegistrationFormAnswerFile: { findMany: vi.fn() },
		projectPublicInfo: { findMany: vi.fn() },
		projectPublicMapImage: { findMany: vi.fn() },
		projectPublicInfoModeration: { findMany: vi.fn() },
	},
}));

import { prisma } from "../prisma";
import { findReferencedFileIds } from "./references";

const mockPrisma = vi.mocked(prisma, true);

const FILE_ID = "clfffffffffffffff01";

function resetAllToEmpty() {
	for (const model of Object.values(mockPrisma)) {
		(
			model as { findMany: ReturnType<typeof vi.fn> }
		).findMany.mockResolvedValue([]);
	}
}

describe("findReferencedFileIds", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		resetAllToEmpty();
	});

	it("空配列を渡すとDBに問い合わせず空集合を返す", async () => {
		const result = await findReferencedFileIds([]);

		expect(result.size).toBe(0);
		expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
	});

	it("どこからも参照されていなければ空集合を返す", async () => {
		const result = await findReferencedFileIds([FILE_ID]);

		expect(result.size).toBe(0);
	});

	it("ユーザーのアバターとして参照されていれば含める", async () => {
		mockPrisma.user.findMany.mockResolvedValue([
			{ avatarFileId: FILE_ID },
		] as any);

		const result = await findReferencedFileIds([FILE_ID]);

		expect(result.has(FILE_ID)).toBe(true);
	});

	it("お知らせ添付として参照されていれば含める", async () => {
		mockPrisma.noticeAttachment.findMany.mockResolvedValue([
			{ fileId: FILE_ID },
		] as any);

		const result = await findReferencedFileIds([FILE_ID]);

		expect(result.has(FILE_ID)).toBe(true);
	});

	it("問い合わせ添付として参照されていれば含める", async () => {
		mockPrisma.inquiryAttachment.findMany.mockResolvedValue([
			{ fileId: FILE_ID },
		] as any);

		const result = await findReferencedFileIds([FILE_ID]);

		expect(result.has(FILE_ID)).toBe(true);
	});

	it("フォーム添付として参照されていれば含める", async () => {
		mockPrisma.formAttachment.findMany.mockResolvedValue([
			{ fileId: FILE_ID },
		] as any);

		const result = await findReferencedFileIds([FILE_ID]);

		expect(result.has(FILE_ID)).toBe(true);
	});

	it("フォーム回答の添付として参照されていれば含める", async () => {
		mockPrisma.formAnswerFile.findMany.mockResolvedValue([
			{ fileId: FILE_ID },
		] as any);

		const result = await findReferencedFileIds([FILE_ID]);

		expect(result.has(FILE_ID)).toBe(true);
	});

	it("企画公開情報のアイコンとして参照されていれば含める", async () => {
		mockPrisma.projectPublicInfo.findMany.mockResolvedValue([
			{ iconFileId: FILE_ID },
		] as any);

		const result = await findReferencedFileIds([FILE_ID]);

		expect(result.has(FILE_ID)).toBe(true);
	});

	it("企画公開情報の掲載画像として参照されていれば含める", async () => {
		mockPrisma.projectPublicMapImage.findMany.mockResolvedValue([
			{ fileId: FILE_ID },
		] as any);

		const result = await findReferencedFileIds([FILE_ID]);

		expect(result.has(FILE_ID)).toBe(true);
	});

	it("実委人が修正したアイコン・掲載画像の修正前の値として残っていれば含める", async () => {
		mockPrisma.projectPublicInfoModeration.findMany.mockResolvedValue([
			{ previousValue: "clother" },
			{ previousValue: ["clother2", FILE_ID] },
		] as any);

		const result = await findReferencedFileIds([FILE_ID]);

		expect([...result]).toEqual([FILE_ID]);
	});

	it("修正の記録は、指定した fileId を修正前の値に持つものだけを読む", async () => {
		await findReferencedFileIds([FILE_ID]);

		expect(
			mockPrisma.projectPublicInfoModeration.findMany
		).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					OR: [
						{ previousValue: { equals: FILE_ID } },
						{ previousValue: { array_contains: [FILE_ID] } },
					],
				}),
			})
		);
	});

	it("削除済みのお知らせ添付は参照とみなさない", async () => {
		await findReferencedFileIds([FILE_ID]);

		expect(mockPrisma.noticeAttachment.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({ deletedAt: null }),
			})
		);
	});
});
