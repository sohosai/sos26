import type { GetProjectFormResponse } from "@sos26/shared";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FormAnswerDialog } from "@/components/form/Answer/AnswerDialog";
import type { Form, FormAnswers } from "@/components/form/type";
import {
	createFormResponse,
	getProjectForm,
	updateFormResponse,
} from "@/lib/api/project-form";
import { ProjectFormToForm } from "@/lib/form/convert";
import {
	buildAnswerBody,
	prepareAnswersForSubmit,
	responseToAnswers,
} from "@/lib/form/utils";

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	projectId: string;
	formDeliveryId: string;
	onSubmitSuccess: (submittedAt: Date | null) => void;
	onDraftSaved: (responseId: string) => void;
};

type FetchState =
	| { status: "idle" }
	| { status: "loading" }
	| { status: "error" }
	| { status: "success"; data: GetProjectFormResponse };

export function ProjectFormAnswerDialog({
	open,
	onOpenChange,
	projectId,
	formDeliveryId,
	onSubmitSuccess,
	onDraftSaved,
}: Props) {
	const [fetchState, setFetchState] = useState<FetchState>({ status: "idle" });
	const [draftResponseId, setDraftResponseId] = useState<string | null>(null);
	const [isDeadlineExpired, setIsDeadlineExpired] = useState(false);

	// 締切の瞬間に1回だけ発火するタイマー
	useEffect(() => {
		if (fetchState.status !== "success") return;
		const { deadlineAt, allowLateResponse } = fetchState.data.form;
		if (!deadlineAt || allowLateResponse) return;

		const now = new Date();
		if (deadlineAt <= now) {
			setIsDeadlineExpired(true);
			return;
		}

		const ms = deadlineAt.getTime() - now.getTime();
		const timer = setTimeout(() => setIsDeadlineExpired(true), ms);
		return () => clearTimeout(timer);
	}, [fetchState]);

	useEffect(() => {
		if (!open) return;

		const controller = new AbortController();
		setFetchState({ status: "loading" });

		getProjectForm(projectId, formDeliveryId)
			.then(data => {
				if (controller.signal.aborted) return;
				setFetchState({ status: "success", data });
				// openのたびにdraftResponseIdをサーバーの値でリセット
				setDraftResponseId(null);
			})
			.catch(() => {
				if (controller.signal.aborted) return;
				setFetchState({ status: "error" });
				toast.error("申請の取得に失敗しました");
			});

		return () => controller.abort();
	}, [open, projectId, formDeliveryId]);

	// fetchStateから導出
	const form: Form | null =
		fetchState.status === "success" ? ProjectFormToForm(fetchState.data) : null;

	const initialAnswers: FormAnswers = useMemo(
		() =>
			fetchState.status === "success" && fetchState.data.form.response && form
				? responseToAnswers(fetchState.data.form.response, form)
				: {},
		[fetchState, form]
	);

	const responseId =
		draftResponseId ??
		(fetchState.status === "success"
			? (fetchState.data.form.response?.id ?? null)
			: null);

	const isSubmitted =
		fetchState.status === "success" &&
		fetchState.data.form.response?.submittedAt != null;

	const handleSaveDraft = async (answers: FormAnswers) => {
		if (!form || isDeadlineExpired) return;
		const preparedAnswers = await prepareAnswersForSubmit(answers, form);
		const body = buildAnswerBody(preparedAnswers, form, false);
		if (responseId) {
			await updateFormResponse(projectId, formDeliveryId, body);
		} else {
			const res = await createFormResponse(projectId, formDeliveryId, body);
			setDraftResponseId(res.response.id);
			onDraftSaved(res.response.id);
		}
	};

	const handleSubmit = async (answers: FormAnswers) => {
		if (!form) return;
		const preparedAnswers = await prepareAnswersForSubmit(answers, form);
		const body = buildAnswerBody(preparedAnswers, form, true);
		const response = responseId
			? await updateFormResponse(projectId, formDeliveryId, body).then(
					r => r.response
				)
			: await createFormResponse(projectId, formDeliveryId, body).then(
					r => r.response
				);
		onSubmitSuccess(response.submittedAt);
	};

	return (
		<FormAnswerDialog
			open={open}
			onOpenChange={open => {
				if (!open) {
					setFetchState({ status: "idle" });
					setDraftResponseId(null);
					setIsDeadlineExpired(false);
				}
				onOpenChange(open);
			}}
			form={fetchState.status === "loading" ? null : form}
			initialAnswers={initialAnswers}
			onSubmit={handleSubmit}
			onSaveDraft={isSubmitted ? undefined : handleSaveDraft}
			disableSubmit={isDeadlineExpired}
			disableSaveDraft={isDeadlineExpired || isSubmitted}
		/>
	);
}
