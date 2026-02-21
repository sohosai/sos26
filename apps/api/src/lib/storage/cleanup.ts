import { prisma } from "../prisma";

/**
 * 古い PENDING レコードをクリーンアップする。
 * 作成から指定時間が経過した PENDING ファイルをソフトデリートする。
 *
 * @param maxAgeMs - PENDING のまま放置する最大時間（ミリ秒、デフォルト: 24時間）
 * @returns 削除されたレコード数
 */
export async function cleanupStalePendingFiles(
	maxAgeMs = 24 * 60 * 60 * 1000
): Promise<number> {
	const cutoff = new Date(Date.now() - maxAgeMs);
	const result = await prisma.file.updateMany({
		where: {
			status: "PENDING",
			deletedAt: null,
			createdAt: { lt: cutoff },
		},
		data: {
			deletedAt: new Date(),
		},
	});
	return result.count;
}
