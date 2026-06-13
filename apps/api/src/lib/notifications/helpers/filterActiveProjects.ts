import { prisma } from "../../prisma";

export async function filterActiveProjectIds(
	projectIds: string[]
): Promise<string[]> {
	const projects = await prisma.project.findMany({
		where: {
			id: { in: projectIds },
			deletedAt: null,
			deletionStatus: null,
		},
		select: { id: true },
	});
	return projects.map(p => p.id);
}
