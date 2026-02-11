import { describe, expect, it } from "vitest";
import { userSchema } from "./user";

describe("userSchema", () => {
	const now = new Date();
	// 有効なcuid形式のID
	const validCuid = "cjld2cjxh0000qzrmn831i7rn";

	const createValidUser = (overrides = {}) => ({
		id: validCuid,
		firebaseUid: "firebase-uid-123",
		email: "s1234567@u.tsukuba.ac.jp",
		name: "筑波太郎",
		namePhonetic: "ツクバタロウ",
		telephoneNumber: "090-1234-5678",
		deletedAt: null,
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

	describe("name", () => {
		it("空の名前を拒否する", () => {
			const result = userSchema.safeParse(createValidUser({ name: "" }));
			expect(result.success).toBe(false);
		});
	});

	describe("namePhonetic", () => {
		it("空のフリガナを拒否する", () => {
			const result = userSchema.safeParse(
				createValidUser({ namePhonetic: "" })
			);
			expect(result.success).toBe(false);
		});
	});

	describe("telephoneNumber", () => {
		it("空の電話番号を拒否する", () => {
			const result = userSchema.safeParse(
				createValidUser({ telephoneNumber: "" })
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

	describe("deletedAt", () => {
		it("nullを受け入れる", () => {
			const result = userSchema.safeParse(createValidUser({ deletedAt: null }));
			expect(result.success).toBe(true);
		});

		it("有効な日付を受け入れる", () => {
			const result = userSchema.safeParse(
				createValidUser({ deletedAt: new Date() })
			);
			expect(result.success).toBe(true);
		});
	});
});
