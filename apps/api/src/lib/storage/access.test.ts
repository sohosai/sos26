import type { User } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	canAccessFile,
	clearFileAccessCheckers,
	registerFileAccessChecker,
} from "./access";

describe("ファイルアクセスチェッカーレジストリ", () => {
	const FILE_ID = "test-file-id";
	const mockUser = { id: "user-1" } as User;

	afterEach(() => {
		clearFileAccessCheckers();
	});

	it("チェッカー未登録時は false を返す", async () => {
		const result = await canAccessFile(FILE_ID, mockUser);
		expect(result).toBe(false);
	});

	it("true を返すチェッカーがあればアクセス許可", async () => {
		registerFileAccessChecker(async () => true);

		const result = await canAccessFile(FILE_ID, mockUser);
		expect(result).toBe(true);
	});

	it("false を返すチェッカーのみならアクセス拒否", async () => {
		registerFileAccessChecker(async () => false);

		const result = await canAccessFile(FILE_ID, mockUser);
		expect(result).toBe(false);
	});

	it("複数チェッカーで最初の true で早期リターン", async () => {
		const firstChecker = vi.fn(async () => true);
		const secondChecker = vi.fn(async () => true);

		registerFileAccessChecker(firstChecker);
		registerFileAccessChecker(secondChecker);

		const result = await canAccessFile(FILE_ID, mockUser);
		expect(result).toBe(true);
		expect(firstChecker).toHaveBeenCalledOnce();
		expect(secondChecker).not.toHaveBeenCalled();
	});

	it("最初のチェッカーが false でも次のチェッカーが true なら許可", async () => {
		registerFileAccessChecker(async () => false);
		registerFileAccessChecker(async () => true);

		const result = await canAccessFile(FILE_ID, mockUser);
		expect(result).toBe(true);
	});

	it("全チェッカーが false ならアクセス拒否", async () => {
		registerFileAccessChecker(async () => false);
		registerFileAccessChecker(async () => false);
		registerFileAccessChecker(async () => false);

		const result = await canAccessFile(FILE_ID, mockUser);
		expect(result).toBe(false);
	});

	it("チェッカーに正しい引数が渡される", async () => {
		const checker = vi.fn(async () => false);
		registerFileAccessChecker(checker);

		await canAccessFile(FILE_ID, mockUser);

		expect(checker).toHaveBeenCalledWith(FILE_ID, mockUser);
	});

	it("clearFileAccessCheckers でチェッカーがリセットされる", async () => {
		registerFileAccessChecker(async () => true);
		expect(await canAccessFile(FILE_ID, mockUser)).toBe(true);

		clearFileAccessCheckers();
		expect(await canAccessFile(FILE_ID, mockUser)).toBe(false);
	});
});
