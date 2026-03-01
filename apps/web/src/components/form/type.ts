import type { FormItemType } from "@sos26/shared";

export type FormAnswerValue = string | number | string[] | File | null;

export type FormAnswers = {
	[itemId: string]: FormAnswerValue;
};

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
