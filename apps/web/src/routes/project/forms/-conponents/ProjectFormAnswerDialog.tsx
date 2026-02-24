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
import { buildAnswerBody, responseToAnswers } from "@/lib/form";

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
