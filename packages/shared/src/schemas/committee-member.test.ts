import { describe, expect, it } from "vitest";
import {
	bureauSchema,
	committeeMemberSchema,
	createCommitteeMemberRequestSchema,
	updateCommitteeMemberRequestSchema,
} from "./committee-member";

describe("bureauSchema", () => {
	it("有効な局の値を受け入れる", () => {
		const validBureaus = [
			"FINANCE",
			"GENERAL_AFFAIRS",
			"PUBLIC_RELATIONS",
			"EXTERNAL",
			"PROMOTION",
			"PLANNING",
			"STAGE_MANAGEMENT",
			"HQ_PLANNING",
			"INFO_SYSTEM",
			"INFORMATION",
		];
		for (const bureau of validBureaus) {
			const result = bureauSchema.safeParse(bureau);
			expect(result.success).toBe(true);
		}
	});

	it("無効な局の値を拒否する", () => {
		const result = bureauSchema.safeParse("INVALID_BUREAU");
		expect(result.success).toBe(false);
	});
});

describe("committeeMemberSchema", () => {
	const now = new Date();
	const validCuid = "cjld2cjxh0000qzrmn831i7rn";

	const createValidMember = (overrides = {}) => ({
		id: validCuid,
		userId: "cjld2cjxh0001qzrmn831i7rn",
		isExecutive: false,
		Bureau: "INFO_SYSTEM",
		joinedAt: now,
		deletedAt: null,
		...overrides,
	});

	it("有効な委員メンバー情報を受け入れる", () => {
		const result = committeeMemberSchema.safeParse(createValidMember());
		expect(result.success).toBe(true);
	});

	it("無効なcuid形式のidを拒否する", () => {
		const result = committeeMemberSchema.safeParse(
			createValidMember({ id: "invalid-id" })
		);
		expect(result.success).toBe(false);
	});

	it("無効なBureauを拒否する", () => {
		const result = committeeMemberSchema.safeParse(
			createValidMember({ Bureau: "INVALID" })
		);
		expect(result.success).toBe(false);
	});

	it("deletedAtにnullを受け入れる", () => {
		const result = committeeMemberSchema.safeParse(
			createValidMember({ deletedAt: null })
		);
		expect(result.success).toBe(true);
	});

	it("deletedAtに日付を受け入れる", () => {
		const result = committeeMemberSchema.safeParse(
			createValidMember({ deletedAt: new Date() })
		);
		expect(result.success).toBe(true);
	});
});

describe("createCommitteeMemberRequestSchema", () => {
	it("有効なリクエストを受け入れる", () => {
		const result = createCommitteeMemberRequestSchema.safeParse({
			userId: "cjld2cjxh0001qzrmn831i7rn",
			Bureau: "FINANCE",
		});
		expect(result.success).toBe(true);
	});

	it("isExecutiveをオプションとして受け入れる", () => {
		const result = createCommitteeMemberRequestSchema.safeParse({
			userId: "cjld2cjxh0001qzrmn831i7rn",
			Bureau: "FINANCE",
			isExecutive: true,
		});
		expect(result.success).toBe(true);
	});

	it("空のuserIdを拒否する", () => {
		const result = createCommitteeMemberRequestSchema.safeParse({
			userId: "",
			Bureau: "FINANCE",
		});
		expect(result.success).toBe(false);
	});

	it("Bureauが必須", () => {
		const result = createCommitteeMemberRequestSchema.safeParse({
			userId: "cjld2cjxh0001qzrmn831i7rn",
		});
		expect(result.success).toBe(false);
	});
});

describe("updateCommitteeMemberRequestSchema", () => {
	it("Bureau のみの更新を受け入れる", () => {
		const result = updateCommitteeMemberRequestSchema.safeParse({
			Bureau: "PLANNING",
		});
		expect(result.success).toBe(true);
	});

	it("isExecutive のみの更新を受け入れる", () => {
		const result = updateCommitteeMemberRequestSchema.safeParse({
			isExecutive: true,
		});
		expect(result.success).toBe(true);
	});

	it("空オブジェクトを受け入れる", () => {
		const result = updateCommitteeMemberRequestSchema.safeParse({});
		expect(result.success).toBe(true);
	});
});
