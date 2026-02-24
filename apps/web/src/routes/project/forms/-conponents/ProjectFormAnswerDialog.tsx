import type {
	CreateFormResponseRequest,
	FormItemType,
	GetProjectFormResponse,
} from "@sos26/shared";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FormAnswerDialog } from "@/components/form/Answer/AnswerDialog";
import { formDetailToForm } from "@/components/form/convert";
import type { Form, FormAnswers } from "@/components/form/type";
import {
	createFormResponse,
	getProjectForm,
	updateFormResponse,
} from "@/lib/api/project-form";

function responseToAnswers(
	response: NonNullable<GetProjectFormResponse["form"]["response"]>,
	form: Form
): FormAnswers {
	const itemTypeMap = new Map<string, FormItemType>(
		// toUpperCase() してからMapに入れる
		form.items.map(i => [i.id, i.type.toUpperCase() as FormItemType])
	);

	const answers: FormAnswers = {};

	for (const answer of response.answers) {
		const type = itemTypeMap.get(answer.formItemId);
		if (!type) continue;

		switch (type) {
			case "SELECT":
				answers[answer.formItemId] = answer.selectedOptionIds[0] ?? "";
				break;
			case "CHECKBOX":
				answers[answer.formItemId] = answer.selectedOptionIds;
				break;
			case "NUMBER":
				if (answer.numberValue !== null) {
					answers[answer.formItemId] = answer.numberValue;
				}
				break;
			case "FILE":
				if (answer.fileUrl !== null) {
					answers[answer.formItemId] = answer.fileUrl;
				}
				break;
			case "TEXT":
			case "TEXTAREA":
			default:
				if (answer.textValue !== null) {
					answers[answer.formItemId] = answer.textValue;
				}
				break;
		}
	}

	return answers;
}

function buildAnswerBody(
	answers: FormAnswers,
	form: Form,
	submit: boolean
): CreateFormResponseRequest {
	const itemTypeMap = new Map<string, FormItemType>(
		// toUpperCase() してからMapに入れる
		form.items.map(i => [i.id, i.type.toUpperCase() as FormItemType])
	);

	return {
		submit,
		answers: Object.entries(answers).map(([formItemId, value]) => {
			const type = itemTypeMap.get(formItemId);

			if (!type) return { formItemId };

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
		}),
	};
}

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	projectId: string;
	formDeliveryId: string;
	onSubmitSuccess: () => void;
	onDraftSaved: (responseId: string) => void;
};

export function ProjectFormAnswerDialog({
	open,
	onOpenChange,
	projectId,
	formDeliveryId,
	onSubmitSuccess,
	onDraftSaved,
}: Props) {
	const [form, setForm] = useState<Form | null>(null);
	const [initialAnswers, setInitialAnswers] = useState<FormAnswers>({});
	const [responseId, setResponseId] = useState<string | null>(null);

	useEffect(() => {
		if (!open) return;
		let cancelled = false;

		getProjectForm(projectId, formDeliveryId)
			.then(res => {
				if (cancelled) return;
				// formDetailToForm と互換の形に変換
				// GetProjectFormResponse の form は GetFormDetailResponse["form"] と
				// items/options の構造が同じなのでキャストして流用
				const convertedForm = formDetailToForm(
					res.form as unknown as Parameters<typeof formDetailToForm>[0]
				);

				setForm(convertedForm);
				setResponseId(res.form.response?.id ?? null);
				setInitialAnswers(
					res.form.response
						? responseToAnswers(res.form.response, convertedForm)
						: {}
				);
			})
			.catch(() => {
				if (!cancelled) toast.error("フォームの取得に失敗しました");
			});

		return () => {
			cancelled = true;
		};
	}, [open, projectId, formDeliveryId]);

	const handleSaveDraft = async (answers: FormAnswers) => {
		if (!form) return;
		const body = buildAnswerBody(answers, form, false);
		if (responseId) {
			await updateFormResponse(projectId, formDeliveryId, responseId, body);
			toast.success("下書きを保存しました");
		} else {
			const res = await createFormResponse(projectId, formDeliveryId, body);
			setResponseId(res.response.id);
			onDraftSaved(res.response.id);
			toast.success("下書きを保存しました");
		}
	};

	const handleSubmit = async (answers: FormAnswers) => {
		if (!form) return;
		const body = buildAnswerBody(answers, form, true);
		if (responseId) {
			await updateFormResponse(projectId, formDeliveryId, responseId, body);
		} else {
			await createFormResponse(projectId, formDeliveryId, body);
		}
		onSubmitSuccess();
	};

	return (
		<FormAnswerDialog
			open={open}
			onOpenChange={open => {
				if (!open) {
					setForm(null);
					setInitialAnswers({});
					setResponseId(null);
				}
				onOpenChange(open);
			}}
			form={form}
			initialAnswers={initialAnswers}
			onSubmit={handleSubmit}
			onSaveDraft={handleSaveDraft}
		/>
	);
}
