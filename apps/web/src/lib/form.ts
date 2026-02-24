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
			return answer.numberValue ?? 0;
		case "FILE":
			return answer.fileUrl ?? "";
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
	const itemTypeMap = buildItemTypeMap(form);

	return {
		submit,
		answers: Object.entries(answers).map(([formItemId, value]) => {
			const type = itemTypeMap.get(formItemId);
			if (!type) return { formItemId };
			return buildSingleAnswer(formItemId, value, type);
		}),
	};
}

function buildSingleAnswer(
	formItemId: string,
	value: FormAnswerValue,
	type: FormItemType
): CreateFormResponseRequest["answers"][number] {
	switch (type) {
		case "TEXT":
		case "TEXTAREA":
			return { formItemId, textValue: value as string };
		case "NUMBER":
			return { formItemId, numberValue: value as number };
		case "SELECT":
			return {
				formItemId,
				selectedOptionIds:
					typeof value === "string" ? [value] : (value as string[]),
			};
		case "CHECKBOX":
			return {
				formItemId,
				selectedOptionIds: Array.isArray(value) ? value : [value as string],
			};
		case "FILE":
			return { formItemId, fileUrl: value as string };
		default:
			return { formItemId };
	}
}
