import { describe, expect, it, vi } from "vitest";

vi.mock("../env", () => ({
	env: {
		FILE_TOKEN_SECRET: "test-secret-key-at-least-32-characters-long",
	},
}));

import { generateFileToken, verifyFileToken } from "./file-token";

describe("file-token ユーティリティ", () => {
	const FILE_ID = "test-file-id-123";
	const USER_ID = "test-user-id-456";

	it("トークンを生成できる", async () => {
		const token = await generateFileToken(FILE_ID, USER_ID);

		expect(typeof token).toBe("string");
		expect(token).toContain(".");
		const parts = token.split(".");
		expect(parts).toHaveLength(2);
	});

	it("有効なトークンを正しく検証できる", async () => {
		const token = await generateFileToken(FILE_ID, USER_ID);
		const result = await verifyFileToken(token, FILE_ID);

		expect(result).not.toBeNull();
		expect(result?.fileId).toBe(FILE_ID);
		expect(result?.userId).toBe(USER_ID);
		expect(result?.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
	});

	it("異なるファイルIDでは検証に失敗する", async () => {
		const token = await generateFileToken(FILE_ID, USER_ID);
		const result = await verifyFileToken(token, "wrong-file-id");

		expect(result).toBeNull();
	});

	it("期限切れトークンは検証に失敗する", async () => {
		// 有効期限 0 秒（即時期限切れ）でトークン生成
		const token = await generateFileToken(FILE_ID, USER_ID, 0);

		// 1秒待って期限切れにする
		vi.useFakeTimers();
		vi.advanceTimersByTime(1000);

		const result = await verifyFileToken(token, FILE_ID);
		expect(result).toBeNull();

		vi.useRealTimers();
	});

	it("改ざんされたトークンは検証に失敗する", async () => {
		const token = await generateFileToken(FILE_ID, USER_ID);
		const tampered = `${token}x`;

		const result = await verifyFileToken(tampered, FILE_ID);
		expect(result).toBeNull();
	});

	it("署名部分が改ざんされたトークンは検証に失敗する", async () => {
		const token = await generateFileToken(FILE_ID, USER_ID);
		const [payload] = token.split(".");
		const fakeToken = `${payload}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;

		const result = await verifyFileToken(fakeToken, FILE_ID);
		expect(result).toBeNull();
	});

	it("不正な形式のトークンは検証に失敗する", async () => {
		expect(await verifyFileToken("", FILE_ID)).toBeNull();
		expect(await verifyFileToken("invalid", FILE_ID)).toBeNull();
		expect(await verifyFileToken("a.b.c", FILE_ID)).toBeNull();
	});
});
