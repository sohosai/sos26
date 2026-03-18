import { bureauLabelMap } from "@sos26/shared";
import { prisma } from "./prisma";

type UserAffiliation = {
	committeeBureau?: string;
	affiliatedProjects: string[];
};

function createUserAffiliation(
	committeeBureau?: string,
	affiliatedProjects: string[] = []
): UserAffiliation {
	return {
		...(committeeBureau ? { committeeBureau } : {}),
		affiliatedProjects,
	};
}

/**
 * ユーザーIDリストから所属情報をまとめて取得する。
 * 実委所属は committeeBureau、企画所属は affiliatedProjects に集約する。
 * affiliatedProjects には owner / subOwner / projectMember として所属する
 * 有効な企画名をすべて含める。
 */
function getProjectSet(
	projectMap: Map<string, Set<string>>,
	userId: string
): Set<string> {
	const existing = projectMap.get(userId);
	if (existing) return existing;

	const created = new Set<string>();
	projectMap.set(userId, created);
	return created;
}

async function getProjectAffiliations(
	userIds: string[]
): Promise<Map<string, string[]>> {
	if (userIds.length === 0) return new Map();

	const [ownedProjects, joinedProjects] = await Promise.all([
		prisma.project.findMany({
			where: {
				deletedAt: null,
				OR: [{ ownerId: { in: userIds } }, { subOwnerId: { in: userIds } }],
			},
			select: {
				name: true,
				ownerId: true,
				subOwnerId: true,
			},
		}),
		prisma.projectMember.findMany({
			where: {
				userId: { in: userIds },
				deletedAt: null,
				project: { deletedAt: null },
			},
			select: {
				userId: true,
				project: { select: { name: true } },
			},
		}),
	]);

	const projectMap = new Map<string, Set<string>>();

	for (const project of ownedProjects) {
		getProjectSet(projectMap, project.ownerId).add(project.name);
		if (project.subOwnerId) {
			getProjectSet(projectMap, project.subOwnerId).add(project.name);
		}
	}

	for (const membership of joinedProjects) {
		getProjectSet(projectMap, membership.userId).add(membership.project.name);
	}

	return new Map(
		userIds.map(userId => [
			userId,
			[...(projectMap.get(userId) ?? new Set())].sort((a, b) =>
				a.localeCompare(b, "ja")
			),
		])
	);
}

export async function getUserAffiliations(
	userIds: string[]
): Promise<Map<string, UserAffiliation>> {
	if (userIds.length === 0) return new Map();

	const uniqueIds = [...new Set(userIds)];

	const [committeeMembers, projectAffiliations] = await Promise.all([
		prisma.committeeMember.findMany({
			where: { userId: { in: uniqueIds }, deletedAt: null },
			select: { userId: true, Bureau: true },
		}),
		getProjectAffiliations(uniqueIds),
	]);

	const committeeMemberMap = new Map(committeeMembers.map(m => [m.userId, m]));

	const result = new Map<string, UserAffiliation>();

	for (const userId of uniqueIds) {
		const cm = committeeMemberMap.get(userId);
		const affiliatedProjects = projectAffiliations.get(userId) ?? [];
		if (cm) {
			result.set(
				userId,
				createUserAffiliation(bureauLabelMap[cm.Bureau], affiliatedProjects)
			);
		} else {
			result.set(userId, createUserAffiliation(undefined, affiliatedProjects));
		}
	}

	return result;
}
