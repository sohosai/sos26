import type {
	CreateFormResponseRequest,
	FormItemType,
	GetProjectFormResponse,
	ListFormResponsesResponse,
} from "@sos26/shared";
import type {
	Form,
	FormAnswers,
	FormAnswerValue,
} from "@/components/form/type";
import { uploadFile } from "@/lib/api/files";

type ProjectResponseAnswer = NonNullable<
	GetProjectFormResponse["form"]["response"]
>["answers"][number];
type ListResponseAnswer =
	ListFormResponsesResponse["responses"][number]["answers"][number];
type AnyResponseAnswer = ProjectResponseAnswer | ListResponseAnswer;

function getSelectedOptionIds(answer: AnyResponseAnswer): string[] {
	if ("selectedOptionIds" in answer) return answer.selectedOptionIds;
	return answer.selectedOptions.map(o => o.id);
}

function resolveResponseValue(
	answer: AnyResponseAnswer,
	type: FormItemType
): FormAnswerValue {
	switch (type) {
		case "SELECT":
			return getSelectedOptionIds(answer)[0] ?? "";
		case "CHECKBOX":
			return getSelectedOptionIds(answer);
		case "NUMBER":
			return answer.numberValue;
		case "FILE":
			return answer.fileId ?? null;
		default:
			return answer.textValue ?? "";
	}
}

function buildItemTypeMap(form: Form): Map<string, FormItemType> {
	return new Map(
		form.items.map(i => [i.id, i.type.toUpperCase() as FormItemType])
	);
}

export function responseToAnswers(
	response: { answers: AnyResponseAnswer[] },
	form: Form
): FormAnswers {
	const itemTypeMap = buildItemTypeMap(form);
	const answers: FormAnswers = {};

	for (const answer of response.answers) {
		const type = itemTypeMap.get(answer.formItemId);
		if (!type) continue;
		answers[answer.formItemId] = resolveResponseValue(answer, type);
	}

	return answers;
}

export function buildAnswerBody(
	answers: FormAnswers,
	form: Form,
	submit: boolean
): CreateFormResponseRequest {
	return {
		submit,
		answers: form.items.map(item => {
			const value = answers[item.id] ?? getDefaultAnswerValue(item.type);
			return buildSingleAnswer(item.id, value, item.type);
		}),
	};
}

function getDefaultAnswerValue(type: FormItemType): FormAnswerValue {
	switch (type) {
		case "CHECKBOX":
			return [];
		case "FILE":
			return null;
		case "NUMBER":
			return null;
		default:
			return "";
	}
}

export async function prepareAnswersForSubmit(
	answers: FormAnswers,
	form: Form
): Promise<FormAnswers> {
	const preparedAnswers: FormAnswers = { ...answers };

	await Promise.all(
		form.items.map(async item => {
			if (item.type !== "FILE") return;

			const value = preparedAnswers[item.id] ?? null;
			if (value instanceof File) {
				const result = await uploadFile(value);
				preparedAnswers[item.id] = result.file.id;
				return;
			}
			if (typeof value === "string" || value === null) {
				return;
			}
			throw new Error(`FILE回答の型が不正です: ${item.id}`);
		})
	);

	return preparedAnswers;
}

function normalizeOptionIds(value: FormAnswerValue): string[] {
	if (Array.isArray(value)) {
		return value.filter(v => v !== "");
	}
	if (typeof value === "string" && value !== "") {
		return [value];
	}
	return [];
}

function buildSingleAnswer(
	formItemId: string,
	value: FormAnswerValue,
	type: FormItemType
): CreateFormResponseRequest["answers"][number] {
	switch (type) {
		case "TEXT":
		case "TEXTAREA":
			return { type, formItemId, textValue: value as string };
		case "NUMBER":
			return { type, formItemId, numberValue: value as number };
		case "SELECT":
		case "CHECKBOX":
			return {
				type,
				formItemId,
				selectedOptionIds: normalizeOptionIds(value),
			};
		case "FILE":
			if (typeof value !== "string" && value !== null) {
				throw new Error(`FILE回答の型が不正です: ${formItemId}`);
			}
			return { type, formItemId, fileId: value };
	}
	return assertNever(type);
}
function assertNever(x: never): never {
	throw new Error(`Unsupported FormItemType: ${x}`);
}
