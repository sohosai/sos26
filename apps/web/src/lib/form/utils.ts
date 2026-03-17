import type {
	CreateFormResponseRequest,
	FormItemType,
	GetProjectFormResponse,
	ListFormResponsesResponse,
} from "@sos26/shared";
import type {
	FileAnswerValue,
	Form,
	FormAnswers,
	FormAnswerValue,
	UploadedFileValue,
} from "@/components/form/type";
import {
	createEmptyFileAnswerValue,
	isFileAnswerValue,
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
			return resolveFileResponseValue(answer);
		default:
			return answer.textValue ?? "";
	}
}

function resolveFileResponseValue(answer: AnyResponseAnswer): FileAnswerValue {
	if (answer.files.length === 0) {
		return createEmptyFileAnswerValue();
	}
	return {
		pendingFiles: [],
		uploadedFiles: answer.files.map(file => ({
			id: file.id,
			fileName: file.fileName,
			mimeType: file.mimeType,
			size: file.size,
			isPublic: file.isPublic,
			createdAt: file.createdAt,
			sortOrder: file.sortOrder,
		})),
	};
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
			return createEmptyFileAnswerValue();
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

			const value = preparedAnswers[item.id];
			if (!isFileAnswerValue(value)) {
				throw new Error(`FILE回答の型が不正です: ${item.id}`);
			}

			if (value.pendingFiles.length > 0) {
				const uploadedFiles = await Promise.all(
					value.pendingFiles.map(async (file, sortOrder) => {
						const result = await uploadFile(file).catch(error => {
							console.error("Failed to upload form answer file", {
								formId: form.id,
								formItemId: item.id,
								fileName: file.name,
								fileSize: file.size,
								fileType: file.type,
								sortOrder,
								error,
							});
							throw error;
						});
						const uploadedFile: UploadedFileValue = {
							id: result.file.id,
							fileName: result.file.fileName,
							mimeType: result.file.mimeType,
							size: result.file.size,
							isPublic: result.file.isPublic,
							sortOrder,
						};
						return uploadedFile;
					})
				);
				preparedAnswers[item.id] = {
					pendingFiles: [],
					uploadedFiles,
				};
			}
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
			if (!isFileAnswerValue(value)) {
				throw new Error(`FILE回答の型が不正です: ${formItemId}`);
			}
			return {
				type,
				formItemId,
				fileIds: value.uploadedFiles
					.slice()
					.sort((a, b) => a.sortOrder - b.sortOrder)
					.map(file => file.id),
			};
	}
	return assertNever(type);
}
function assertNever(x: never): never {
	throw new Error(`Unsupported FormItemType: ${x}`);
}
