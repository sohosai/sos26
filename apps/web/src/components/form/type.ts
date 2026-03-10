import type { FormItemType, TextConstraints } from "@sos26/shared";

export type UploadedFileValue = {
	fileId: string;
	fileName: string | null;
	mimeType: string | null;
	isPublic: boolean | null;
};

export type FileAnswerValue = {
	pendingFile: File | null;
	uploadedFile: UploadedFileValue | null;
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
		pendingFile: null,
		uploadedFile: null,
	};
}

export function isFileAnswerValue(
	value: FormAnswerValue | undefined
): value is FileAnswerValue {
	return (
		typeof value === "object" &&
		value !== null &&
		"pendingFile" in value &&
		"uploadedFile" in value
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
	constraints?: TextConstraints | null;
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
