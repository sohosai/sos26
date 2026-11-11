import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * 設問 × 企画ごとに最新の編集履歴の id を返す。
 * 履歴は提出のたびに積まれるため、全件を取ってから最新を選ぶと行数が提出回数に比例して増える。
 * id だけを DISTINCT ON で絞り、本体は呼び出し側が必要なリレーション付きで findMany する。
 */
async function findLatestEditHistoryIds(
	table: Prisma.Sql,
	formItemIds: string[],
	projectIds?: string[]
): Promise<string[]> {
	if (formItemIds.length === 0 || projectIds?.length === 0) return [];

	const projectFilter = projectIds
		? Prisma.sql`AND "projectId" = ANY(${projectIds})`
		: Prisma.empty;
	const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
		SELECT DISTINCT ON ("formItemId", "projectId") "id"
		FROM ${table}
		WHERE "formItemId" = ANY(${formItemIds}) ${projectFilter}
		ORDER BY "formItemId", "projectId", "createdAt" DESC, "id" DESC
	`);
	return rows.map(r => r.id);
}

export const findLatestFormItemEditHistoryIds = (
	formItemIds: string[],
	projectIds?: string[]
) =>
	findLatestEditHistoryIds(
		Prisma.raw('"FormItemEditHistory"'),
		formItemIds,
		projectIds
	);

export const findLatestProjectRegistrationFormItemEditHistoryIds = (
	formItemIds: string[],
	projectIds?: string[]
) =>
	findLatestEditHistoryIds(
		Prisma.raw('"ProjectRegistrationFormItemEditHistory"'),
		formItemIds,
		projectIds
	);
