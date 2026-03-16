import type { Prisma } from "@prisma/client";
import { Errors } from "./error";

/**
 * 実委人が指定された権限を持っているかチェックし、なければ例外を投げる。
 * トランザクション内外どちらでも使用可能。
 *
 * @param errorType "forbidden"（自分自身の権限チェック）または "invalidRequest"（依頼先の権限チェック）
 */
export const requireDeliverPermission = async (
	tx: Prisma.TransactionClient,
	userId: string,
	permission: string,
	errorMessage: string,
	errorType: "forbidden" | "invalidRequest" = "forbidden"
): Promise<void> => {
	const member = await tx.committeeMember.findFirst({
		where: { userId, deletedAt: null },
		include: { permissions: true },
	});
	if (!member || !member.permissions.some(p => p.permission === permission)) {
		throw errorType === "invalidRequest"
			? Errors.invalidRequest(errorMessage)
			: Errors.forbidden(errorMessage);
	}
};
