export type FormItemType =
	| "text"
	| "textarea"
	| "select"
	| "checkbox"
	| "number"
	| "file";

export type FormItem = {
	id: string;
	label: string;
	type: FormItemType;
	required: boolean;
	options?: string[];
};

export type Form = {
	id: string;
	name: string;
	items: FormItem[];
	settings?: {
		scheduledSendAt?: string;
		deadlineAt?: string;
		allowLateResponse?: boolean;
	};
};
