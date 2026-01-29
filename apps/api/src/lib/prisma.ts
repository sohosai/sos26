import { PrismaClient } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { Errors } from "./error";

const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
	globalForPrisma.prisma = prisma;
}

/**
 * Prisma エラーを AppError に変換して throw する
 *
 * @example
 * try {
 *   await prisma.user.create({ data });
 * } catch (e) {
 *   handlePrismaError(e);
 * }
 */
export function handlePrismaError(e: unknown): never {
	if (e instanceof PrismaClientKnownRequestError) {
		switch (e.code) {
			case "P2002": // ユニーク制約違反
				throw Errors.alreadyExists("既に存在するデータです");
			case "P2025": // レコードが見つからない
				throw Errors.notFound("対象のレコードが見つかりません");
			case "P2003": // 外部キー制約違反
				throw Errors.invalidRequest("関連するデータが存在しません");
		}
	}

	console.error("[Prisma] Unexpected error", e);
	throw Errors.internal("データベースエラーが発生しました");
}
