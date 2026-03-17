import type { User } from "@prisma/client";
import { prisma } from "../../prisma";

async function isProjectMember(
	projectId: string,
	userId: string
): Promise<boolean> {
	const project = await prisma.project.findFirst({
		where: {
			id: projectId,
			deletedAt: null,
			OR: [
				{ ownerId: userId },
				{ subOwnerId: userId },
				{
					projectMembers: {
						some: {
							userId,
							deletedAt: null,
						},
					},
				},
			],
		},
		select: { id: true },
	});

	return project !== null;
}

async function canAccessFormAsCommittee(
	formId: string,
	userId: string
): Promise<boolean> {
	const form = await prisma.form.findFirst({
		where: {
			id: formId,
			deletedAt: null,
			OR: [
				{ ownerId: userId },
				{
					collaborators: {
						some: {
							userId,
							deletedAt: null,
						},
					},
				},
			],
		},
		select: { id: true },
	});

	return form !== null;
}

type FormFileAssociation = {
	projectId: string;
	formId: string;
	committeeCanAccess: boolean;
};

async function getFormAnswerAssociations(
	fileId: string
): Promise<FormFileAssociation[]> {
	const answerFiles = await prisma.formAnswerFile.findMany({
		where: { fileId },
		select: {
			answer: {
				select: {
					formResponse: {
						select: {
							submittedAt: true,
							formDelivery: {
								select: {
									projectId: true,
									formAuthorization: {
										select: {
											formId: true,
										},
									},
								},
							},
						},
					},
				},
			},
		},
	});

	return answerFiles.map(answerFile => ({
		projectId: answerFile.answer.formResponse.formDelivery.projectId,
		formId:
			answerFile.answer.formResponse.formDelivery.formAuthorization.formId,
		committeeCanAccess: answerFile.answer.formResponse.submittedAt !== null,
	}));
}

async function getEditHistoryAssociations(
	fileId: string
): Promise<FormFileAssociation[]> {
	const historyFiles = await prisma.formItemEditHistoryFile.findMany({
		where: { fileId },
		select: {
			editHistory: {
				select: {
					projectId: true,
					formItem: {
						select: {
							formId: true,
						},
					},
				},
			},
		},
	});

	return historyFiles.map(historyFile => ({
		projectId: historyFile.editHistory.projectId,
		formId: historyFile.editHistory.formItem.formId,
		committeeCanAccess: true,
	}));
}

export async function canAccessFormFile(
	fileId: string,
	user: User
): Promise<boolean> {
	const associations = [
		...(await getFormAnswerAssociations(fileId)),
		...(await getEditHistoryAssociations(fileId)),
	];

	for (const association of associations) {
		if (await isProjectMember(association.projectId, user.id)) {
			return true;
		}

		if (
			association.committeeCanAccess &&
			(await canAccessFormAsCommittee(association.formId, user.id))
		) {
			return true;
		}
	}

	return false;
}
