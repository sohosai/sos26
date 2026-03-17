export const formAttachmentFileSelect = {
	id: true,
	fileName: true,
	mimeType: true,
	size: true,
	isPublic: true,
} as const;

export const formAttachmentsInclude = {
	where: {
		deletedAt: null,
		file: {
			status: "CONFIRMED" as const,
			deletedAt: null,
		},
	},
	orderBy: { createdAt: "asc" as const },
	include: {
		file: { select: formAttachmentFileSelect },
	},
};

type FormAttachmentWithFile = {
	id: string;
	createdAt: Date;
	file: {
		id: string;
		fileName: string;
		mimeType: string;
		size: number;
		isPublic: boolean;
	};
};

export function mapFormAttachment(attachment: FormAttachmentWithFile) {
	return {
		id: attachment.id,
		fileId: attachment.file.id,
		fileName: attachment.file.fileName,
		mimeType: attachment.file.mimeType,
		size: attachment.file.size,
		isPublic: attachment.file.isPublic,
		createdAt: attachment.createdAt,
	};
}

export function mapFormAttachments(attachments: FormAttachmentWithFile[]) {
	return attachments.map(mapFormAttachment);
}
