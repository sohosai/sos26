import { describe, expect, it } from "vitest";
import { userRoleSchema, userSchema, userStatusSchema } from "./user";

describe("userStatusSchema", () => {
	it("有効なステータスを受け入れる", () => {
		expect(userStatusSchema.safeParse("ACTIVE").success).toBe(true);
		expect(userStatusSchema.safeParse("DISABLED").success).toBe(true);
	});

	it("無効なステータスを拒否する", () => {
		expect(userStatusSchema.safeParse("active").success).toBe(false);
		expect(userStatusSchema.safeParse("INACTIVE").success).toBe(false);
	});
});

describe("userRoleSchema", () => {
	it("有効なロールを受け入れる", () => {
		expect(userRoleSchema.safeParse("PLANNER").success).toBe(true);
		expect(userRoleSchema.safeParse("COMMITTEE_MEMBER").success).toBe(true);
		expect(userRoleSchema.safeParse("COMMITTEE_ADMIN").success).toBe(true);
		expect(userRoleSchema.safeParse("SYSTEM_ADMIN").success).toBe(true);
	});

	it("無効なロールを拒否する", () => {
		expect(userRoleSchema.safeParse("admin").success).toBe(false);
		expect(userRoleSchema.safeParse("USER").success).toBe(false);
	});
});

describe("userSchema", () => {
	const now = new Date();
	// 有効なcuid形式のID
	const validCuid = "cjld2cjxh0000qzrmn831i7rn";

	const createValidUser = (overrides = {}) => ({
		id: validCuid,
		firebaseUid: "firebase-uid-123",
		email: "s1234567@u.tsukuba.ac.jp",
		firstName: "太郎",
		lastName: "筑波",
		role: "PLANNER",
		status: "ACTIVE",
		createdAt: now,
		updatedAt: now,
		...overrides,
	});

	it("有効なユーザー情報を受け入れる", () => {
		const result = userSchema.safeParse(createValidUser());
		expect(result.success).toBe(true);
	});

	describe("id", () => {
		it("有効なcuid形式を受け入れる", () => {
			const result = userSchema.safeParse(createValidUser({ id: validCuid }));
			expect(result.success).toBe(true);
		});

		it("無効なcuid形式を拒否する", () => {
			const result = userSchema.safeParse(
				createValidUser({ id: "invalid-id" })
			);
			expect(result.success).toBe(false);
		});
	});

	describe("firebaseUid", () => {
		it("有効なfirebaseUidを受け入れる", () => {
			const result = userSchema.safeParse(
				createValidUser({ firebaseUid: "a".repeat(128) })
			);
			expect(result.success).toBe(true);
		});

		it("空のfirebaseUidを拒否する", () => {
			const result = userSchema.safeParse(createValidUser({ firebaseUid: "" }));
			expect(result.success).toBe(false);
		});

		it("129文字以上のfirebaseUidを拒否する", () => {
			const result = userSchema.safeParse(
				createValidUser({ firebaseUid: "a".repeat(129) })
			);
			expect(result.success).toBe(false);
		});
	});

	describe("email", () => {
		it("筑波大学のメールアドレスを受け入れる", () => {
			const result = userSchema.safeParse(
				createValidUser({ email: "s1234567@u.tsukuba.ac.jp" })
			);
			expect(result.success).toBe(true);
		});

		it("筑波大学以外のメールアドレスを拒否する", () => {
			const result = userSchema.safeParse(
				createValidUser({ email: "test@example.com" })
			);
			expect(result.success).toBe(false);
		});
	});

	it("必須フィールドが欠けている場合は拒否する", () => {
		const invalidUser = {
			id: validCuid,
			email: "s1234567@u.tsukuba.ac.jp",
		};

		const result = userSchema.safeParse(invalidUser);
		expect(result.success).toBe(false);
	});

	it("無効なロールを拒否する", () => {
		const result = userSchema.safeParse(
			createValidUser({ role: "INVALID_ROLE" })
		);
		expect(result.success).toBe(false);
	});

	it("無効なステータスを拒否する", () => {
		const result = userSchema.safeParse(
			createValidUser({ status: "INVALID_STATUS" })
		);
		expect(result.success).toBe(false);
	});
});
