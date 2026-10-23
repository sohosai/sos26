import type { Prisma, PrismaClient } from "@prisma/client";

type ProjectQueryClient = PrismaClient | Prisma.TransactionClient;

/**
 * 指定されたユーザーが、他の有効な企画で責任者・副責任者を務めていないか
 * null で調べる（deletionStatus === null の有効な企画のみ対象）
 *
 * @param client - PrismaClient or トランザクション内のクエリクライアント
 * @param options.userIds - 調べるユーザーIDの配列（1人でも可）
 * @param options.excludeProjectId - 除外する企画ID（現在の企画など）
 * @returns 見つかった企画、または null
 */
export async function findOtherPrivilegedProject(
	client: ProjectQueryClient,
	options: {
		userIds: string[];
		excludeProjectId?: string;
	}
) {
	return client.project.findFirst({
		where: {
			deletedAt: null,
			deletionStatus: null,
			...(options.excludeProjectId && {
				id: { not: options.excludeProjectId },
			}),
			OR: [
				{ ownerId: { in: options.userIds } },
				{ subOwnerId: { in: options.userIds } },
			],
		},
	});
}
