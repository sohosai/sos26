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

async function isProjectOwnerOrSubOwner(
	projectId: string,
	userId: string
): Promise<boolean> {
	const project = await prisma.project.findFirst({
		where: {
			id: projectId,
			deletedAt: null,
			OR: [{ ownerId: userId }, { subOwnerId: userId }],
		},
		select: { id: true },
	});

	return project !== null;
}

async function isCommitteeMember(userId: string): Promise<boolean> {
	const committeeMember = await prisma.committeeMember.findFirst({
		where: { userId, deletedAt: null },
		select: { id: true },
	});

	return committeeMember !== null;
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

type FormAttachmentAssociation = {
	formId: string;
	projectId: string;
	ownerOnly: boolean;
};

async function getFormAttachmentAssociations(fileId: string): Promise<{
	hasAttachment: boolean;
	associations: FormAttachmentAssociation[];
}> {
	const attachments = await prisma.formAttachment.findMany({
		where: {
			fileId,
			deletedAt: null,
			form: { deletedAt: null },
		},
		select: {
			form: {
				select: {
					id: true,
					authorizations: {
						where: {
							status: "APPROVED",
							scheduledSendAt: { lte: new Date() },
						},
						select: {
							ownerOnly: true,
							deliveries: {
								select: { projectId: true },
							},
						},
					},
				},
			},
		},
	});

	return {
		hasAttachment: attachments.length > 0,
		associations: attachments.flatMap(attachment =>
			attachment.form.authorizations.flatMap(authorization =>
				authorization.deliveries.map(delivery => ({
					formId: attachment.form.id,
					projectId: delivery.projectId,
					ownerOnly: authorization.ownerOnly,
				}))
			)
		),
	};
}

async function canAccessAssociatedFormFiles(
	associations: FormFileAssociation[],
	userId: string
): Promise<boolean> {
	for (const association of associations) {
		if (await isProjectMember(association.projectId, userId)) {
			return true;
		}

		if (
			association.committeeCanAccess &&
			(await canAccessFormAsCommittee(association.formId, userId))
		) {
			return true;
		}
	}

	return false;
}

async function canAccessFormAttachment(
	fileId: string,
	userId: string
): Promise<boolean> {
	const result = await getFormAttachmentAssociations(fileId);
	if (!result.hasAttachment) {
		return false;
	}

	if (await isCommitteeMember(userId)) {
		return true;
	}

	for (const association of result.associations) {
		if (association.ownerOnly) {
			if (await isProjectOwnerOrSubOwner(association.projectId, userId)) {
				return true;
			}
			continue;
		}

		if (await isProjectMember(association.projectId, userId)) {
			return true;
		}
	}

	return false;
}

export async function canAccessFormFile(
	fileId: string,
	user: User
): Promise<boolean> {
	const [answerAssociations, editHistoryAssociations] = await Promise.all([
		getFormAnswerAssociations(fileId),
		getEditHistoryAssociations(fileId),
	]);
	const associations = [...answerAssociations, ...editHistoryAssociations];

	if (await canAccessAssociatedFormFiles(associations, user.id)) {
		return true;
	}

	return canAccessFormAttachment(fileId, user.id);
}
