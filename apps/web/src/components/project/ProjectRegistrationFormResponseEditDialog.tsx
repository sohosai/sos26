import { Dialog, Text, VisuallyHidden } from "@radix-ui/themes";
import type {
	GetActiveProjectRegistrationFormsResponse,
	ProjectRegistrationFormResponseView,
	RegistrationFormAnswersInput,
} from "@sos26/shared";
import { useEffect, useState } from "react";
import { AnswerField } from "@/components/form/Answer/AnswerField";
import {
	createEmptyFileAnswerValue,
	type FormAnswers,
	type FormAnswerValue,
	isFileAnswerValue,
} from "@/components/form/type";
import { Button } from "@/components/primitives";
import { uploadFile } from "@/lib/api/files";
import {
	createProjectRegistrationFormResponse,
	updateProjectRegistrationFormResponse,
} from "@/lib/api/project";
import { reportHandledError } from "@/lib/error/report";
import styles from "./ProjectRegistrationFormResponseEditDialog.module.scss";

type RegForm = GetActiveProjectRegistrationFormsResponse["forms"][number];
type RegFormItem = RegForm["items"][number];
type RegFormAnswer = RegistrationFormAnswersInput["answers"][number];
type RegFormAnswerType = RegFormAnswer["type"];

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	projectId: string;
	response: ProjectRegistrationFormResponseView | null;
	form: RegForm | null;
	onUpdated?: (response: ProjectRegistrationFormResponseView) => void;
	onCreated?: (response: ProjectRegistrationFormResponseView) => void;
};

function getDefaultAnswerValue(type: string): FormAnswerValue {
	if (type === "CHECKBOX") return [];
	if (type === "FILE") return createEmptyFileAnswerValue();
	if (type === "NUMBER") return null;
	return "";
}

function initFormAnswers(items: RegForm["items"]): FormAnswers {
	const answers: FormAnswers = {};
	for (const item of items) {
		answers[item.id] = getDefaultAnswerValue(item.type);
	}
	return answers;
}

function normalizeSelectedOptionIds(value: FormAnswerValue): string[] {
	if (Array.isArray(value)) {
		return value.filter(v => v !== "");
	}
	if (typeof value === "string" && value !== "") {
		return [value];
	}
	return [];
}

function buildRegFormAnswer(
	item: RegFormItem,
	answers: FormAnswers
): RegFormAnswer {
	const value = answers[item.id] ?? getDefaultAnswerValue(item.type);
	const type = item.type as RegFormAnswerType;
	const formItemId = item.id;

	switch (type) {
		case "TEXT":
		case "TEXTAREA":
			return { type, formItemId, textValue: value as string | null };
		case "NUMBER":
			return { type, formItemId, numberValue: value as number | null };
		case "SELECT":
		case "CHECKBOX":
			return {
				type,
				formItemId,
				selectedOptionIds: normalizeSelectedOptionIds(value),
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
		default: {
			const _exhaustive: never = type;
			throw new Error(`Unsupported type: ${_exhaustive}`);
		}
	}
}

function validateRegFormAnswers(
	items: RegForm["items"],
	answers: FormAnswers
): Record<string, string> {
	const errors: Record<string, string> = {};
	for (const item of items) {
		if (!item.required) continue;
		const val = answers[item.id];
		if (item.type === "FILE") {
			if (
				!isFileAnswerValue(val) ||
				(val.pendingFiles.length === 0 && val.uploadedFiles.length === 0)
			) {
				errors[item.id] = "この項目は必須です";
			}
			continue;
		}
		if (
			val === undefined ||
			val === null ||
			val === "" ||
			(Array.isArray(val) && val.length === 0)
		) {
			errors[item.id] = "この項目は必須です";
		}
	}
	return errors;
}

async function prepareRegFormAnswersForSubmit(
	form: RegForm,
	formAnswers: FormAnswers
): Promise<FormAnswers> {
	const answers = { ...formAnswers };

	for (const item of form.items) {
		if (item.type !== "FILE") continue;

		const value = answers[item.id];
		if (!isFileAnswerValue(value)) {
			throw new Error(`FILE回答の型が不正です: ${item.id}`);
		}

		if (value.pendingFiles.length > 0) {
			const uploadedFiles = await Promise.all(
				value.pendingFiles.map(async (file, sortOrder) => {
					const result = await uploadFile(file);
					return {
						id: result.file.id,
						fileName: result.file.fileName,
						mimeType: result.file.mimeType,
						size: result.file.size,
						isPublic: result.file.isPublic,
						sortOrder,
					};
				})
			);
			answers[item.id] = {
				pendingFiles: [],
				uploadedFiles,
			};
		}
	}

	return answers;
}

function buildAnswersFromResponse(
	form: RegForm,
	response: ProjectRegistrationFormResponseView
): FormAnswers {
	const answers = initFormAnswers(form.items);
	const answerMap = new Map(
		response.answers.map(answer => [answer.formItemId, answer])
	);

	for (const item of form.items) {
		const stored = answerMap.get(item.id);
		if (!stored) continue;

		switch (item.type) {
			case "TEXT":
			case "TEXTAREA": {
				answers[item.id] = stored.textValue ?? "";
				break;
			}
			case "NUMBER": {
				answers[item.id] =
					stored.numberValue === null ? null : stored.numberValue;
				break;
			}
			case "SELECT": {
				answers[item.id] = stored.selectedOptions[0]?.id ?? "";
				break;
			}
			case "CHECKBOX": {
				answers[item.id] = stored.selectedOptions.map(option => option.id);
				break;
			}
			case "FILE": {
				answers[item.id] = {
					pendingFiles: [],
					uploadedFiles: stored.files.map(file => ({
						id: file.id,
						fileName: file.fileName,
						mimeType: file.mimeType,
						size: file.size,
						isPublic: file.isPublic,
						createdAt: file.createdAt,
						sortOrder: file.sortOrder,
					})),
				};
				break;
			}
			default:
				break;
		}
	}

	return answers;
}

export function ProjectRegistrationFormResponseEditDialog({
	open,
	onOpenChange,
	projectId,
	response,
	form,
	onUpdated,
	onCreated,
}: Props) {
	const [formAnswers, setFormAnswers] = useState<FormAnswers>({});
	const [formErrors, setFormErrors] = useState<Record<string, string>>({});
	const [isSubmitting, setIsSubmitting] = useState(false);
	const isCreateMode = !response && !!form;

	useEffect(() => {
		if (!open || !form) {
			setFormAnswers({});
			setFormErrors({});
			return;
		}
		if (response) {
			setFormAnswers(buildAnswersFromResponse(form, response));
		} else {
			setFormAnswers(initFormAnswers(form.items));
		}
		setFormErrors({});
	}, [open, form, response]);

	const handleAnswerChange = (itemId: string, value: FormAnswerValue) => {
		setFormAnswers(prev => ({ ...prev, [itemId]: value }));
		setFormErrors(prev => {
			if (!prev[itemId]) return prev;
			const next = { ...prev };
			delete next[itemId];
			return next;
		});
	};

	const submitCreate = async (answers: FormAnswers) => {
		if (!form) return;
		const payload = {
			answers: form.items.map(item => buildRegFormAnswer(item, answers)),
		};
		const created = await createProjectRegistrationFormResponse(projectId, {
			formId: form.id,
			...payload,
		});
		onCreated?.(created.response);
	};

	const submitUpdate = async (answers: FormAnswers) => {
		if (!form || !response) return;
		const payload = {
			answers: form.items.map(item => buildRegFormAnswer(item, answers)),
		};
		const updated = await updateProjectRegistrationFormResponse(
			projectId,
			response.id,
			payload
		);
		onUpdated?.(updated.response);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!form || (!response && !isCreateMode)) return;

		const errs = validateRegFormAnswers(form.items, formAnswers);
		setFormErrors(errs);
		if (Object.keys(errs).length > 0) return;

		setIsSubmitting(true);
		try {
			const preparedAnswers = await prepareRegFormAnswersForSubmit(
				form,
				formAnswers
			);
			setFormAnswers(preparedAnswers);
			if (isCreateMode) {
				await submitCreate(preparedAnswers);
			} else {
				await submitUpdate(preparedAnswers);
			}
			onOpenChange(false);
		} catch (error) {
			reportHandledError({
				error,
				operation: "save",
				userMessage: isCreateMode
					? "企画登録フォームの回答作成に失敗しました"
					: "企画登録フォームの回答更新に失敗しました",
				ui: { type: "toast" },
				context: {
					projectId,
					responseId: response?.id,
					formId: form?.id,
				},
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Content maxWidth="640px" className={styles.dialogContent}>
				<VisuallyHidden>
					<Dialog.Title>企画登録フォームの編集</Dialog.Title>
				</VisuallyHidden>
				{!form ? (
					<div className={styles.form}>
						<div className={styles.content}>
							<Text size="3" weight="bold">
								企画登録フォームの編集
							</Text>
							<Text size="2" color="gray">
								フォーム情報の取得に失敗しました。ページを再読み込みしてから再度お試しください。
							</Text>
						</div>
						<div className={styles.footer}>
							<Button type="button" onClick={() => onOpenChange(false)}>
								閉じる
							</Button>
						</div>
					</div>
				) : (
					<form className={styles.form} onSubmit={handleSubmit} noValidate>
						<div className={styles.content}>
							<div className={styles.header}>
								<Text size="5" weight="bold">
									{form.title}
								</Text>
								{form.description && (
									<Text size="2" color="gray" className={styles.description}>
										{form.description}
									</Text>
								)}
							</div>

							<div className={styles.fields}>
								{[...form.items]
									.sort((a, b) => a.sortOrder - b.sortOrder)
									.map(item => (
										<div key={item.id} className={styles.field}>
											<AnswerField
												item={{
													id: item.id,
													label: item.label,
													description: item.description ?? undefined,
													type: item.type as Parameters<
														typeof AnswerField
													>[0]["item"]["type"],
													required: item.required,
													options: item.options,
													constraints: item.constraints,
												}}
												value={formAnswers[item.id]}
												onChange={val => handleAnswerChange(item.id, val)}
											/>
											{formErrors[item.id] && (
												<Text size="1" color="red">
													{formErrors[item.id]}
												</Text>
											)}
										</div>
									))}
							</div>
						</div>
						<div className={styles.footer}>
							<Button
								type="button"
								intent="secondary"
								onClick={() => onOpenChange(false)}
								disabled={isSubmitting}
							>
								キャンセル
							</Button>
							<Button type="submit" loading={isSubmitting}>
								保存する
							</Button>
						</div>
					</form>
				)}
			</Dialog.Content>
		</Dialog.Root>
	);
}
