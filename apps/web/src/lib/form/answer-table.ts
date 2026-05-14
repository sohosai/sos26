import type { BadgeProps } from "@radix-ui/themes";

export type TagValue = {
	label: string;
	color: BadgeProps["color"];
};

export type AnswerDisplayValue = string | TagValue[];

export type BaseAnswerRow = {
	id: string;
	projectName: string;
	submittedAt: Date | null;
	answers: Record<string, AnswerDisplayValue>;
};

type SelectOption = {
	id: string;
	label: string;
};

type ResponseAnswer = {
	formItemId: string;
	textValue: string | null;
	numberValue: number | null;
	selectedOptions: SelectOption[];
	files: unknown[];
};

const TAG_COLORS = [
	"gray",
	"blue",
	"green",
	"orange",
	"purple",
	"teal",
	"red",
] as const;

function hashString(str: string): number {
	let hash = 5381;
	for (let i = 0; i < str.length; i++) {
		hash = (hash * 33) ^ str.charCodeAt(i);
	}
	return Math.abs(hash);
}

function getOptionColor(optionId: string): BadgeProps["color"] {
	return TAG_COLORS[hashString(optionId) % TAG_COLORS.length];
}

export function buildAnswerValueMap(
	answers: readonly ResponseAnswer[]
): Record<string, AnswerDisplayValue> {
	const map: Record<string, AnswerDisplayValue> = {};

	for (const answer of answers) {
		if (answer.textValue != null) {
			map[answer.formItemId] = answer.textValue;
			continue;
		}
		if (answer.numberValue != null) {
			map[answer.formItemId] = String(answer.numberValue);
			continue;
		}
		if (answer.selectedOptions.length > 0) {
			map[answer.formItemId] = answer.selectedOptions.map(option => ({
				label: option.label,
				color: getOptionColor(option.id),
			}));
			continue;
		}
		if (answer.files.length > 0) {
			map[answer.formItemId] = `ファイル${answer.files.length}件`;
			continue;
		}
		map[answer.formItemId] = "";
	}

	return map;
}
