// @ts-nocheck - モックの tx を TxClient として渡すため
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/prisma", () => ({ prisma: {} }));

import { syncColumnOptions } from "./helpers";

const tx = {
	mastersheetColumnOption: {
		findMany: vi.fn(),
		deleteMany: vi.fn(),
		update: vi.fn(),
		createMany: vi.fn(),
	},
};

describe("syncColumnOptions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		tx.mastersheetColumnOption.findMany.mockResolvedValue([
			{ id: "opt-a" },
			{ id: "opt-b" },
		]);
	});

	it("id を指定した既存の選択肢は削除せず更新する", async () => {
		await syncColumnOptions(tx, "col-1", [
			{ id: "opt-b", label: "B改", sortOrder: 0 },
			{ id: "opt-a", label: "A", sortOrder: 1 },
		]);

		expect(tx.mastersheetColumnOption.deleteMany).toHaveBeenCalledWith({
			where: { columnId: "col-1", id: { notIn: ["opt-b", "opt-a"] } },
		});
		expect(tx.mastersheetColumnOption.update).toHaveBeenCalledWith({
			where: { id: "opt-b" },
			data: { label: "B改", sortOrder: 0 },
		});
		expect(tx.mastersheetColumnOption.createMany).not.toHaveBeenCalled();
	});

	it("id のない選択肢は新規作成し、含まれない既存の選択肢は削除する", async () => {
		await syncColumnOptions(tx, "col-1", [
			{ id: "opt-a", label: "A", sortOrder: 0 },
			{ label: "C", sortOrder: 1 },
		]);

		expect(tx.mastersheetColumnOption.deleteMany).toHaveBeenCalledWith({
			where: { columnId: "col-1", id: { notIn: ["opt-a"] } },
		});
		expect(tx.mastersheetColumnOption.createMany).toHaveBeenCalledWith({
			data: [{ columnId: "col-1", label: "C", sortOrder: 1 }],
		});
	});

	it("他のカラムの選択肢 id を指定した場合はエラーにする", async () => {
		await expect(
			syncColumnOptions(tx, "col-1", [
				{ id: "opt-other", label: "X", sortOrder: 0 },
			])
		).rejects.toThrow();

		expect(tx.mastersheetColumnOption.deleteMany).not.toHaveBeenCalled();
	});
});
