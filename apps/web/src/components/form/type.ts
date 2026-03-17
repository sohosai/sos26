import type { FormItemConstraints, FormItemType } from "@sos26/shared";

export type UploadedFileValue = {
	id: string;
	fileName: string;
	mimeType: string;
	size: number;
	isPublic: boolean;
	createdAt?: string;
	sortOrder: number;
};

export type FileAnswerValue = {
	pendingFiles: File[];
	uploadedFiles: UploadedFileValue[];
};

export type DownloadFileNameContext = {
	projectNumber: number;
	formTitle: string;
	projectName: string;
};

export type FormAnswerValue =
	| string
	| number
	| string[]
	| FileAnswerValue
	| null;

export type FormAnswers = {
	[itemId: string]: FormAnswerValue;
};

export function createEmptyFileAnswerValue(): FileAnswerValue {
	return {
		pendingFiles: [],
		uploadedFiles: [],
	};
}

export function isFileAnswerValue(
	value: FormAnswerValue | undefined
): value is FileAnswerValue {
	return (
		typeof value === "object" &&
		value !== null &&
		"pendingFiles" in value &&
		"uploadedFiles" in value
	);
}

export type FormItemOption = {
	id: string;
	label: string;
};

export type FormItem = {
	id: string;
	label: string;
	description?: string;
	type: FormItemType;
	required: boolean;
	options?: FormItemOption[];
	constraints?: FormItemConstraints | null;
};

export type Form = {
	id: string;
	name: string;
	description?: string;
	items: FormItem[];
	settings?: {
		scheduledSendAt?: string;
		deadlineAt?: string;
		allowLateResponse?: boolean;
	};
};
