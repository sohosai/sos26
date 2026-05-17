import {
	Dialog,
	Separator,
	Spinner,
	Text,
	VisuallyHidden,
} from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { AnswerField } from "@/components/form/Answer/AnswerField";
import { EditableAnswerItem } from "@/components/form/Answer/EditableAnswerItem";
import type { Form, FormAnswers } from "@/components/form/type";
import { editFormAnswer, getFormResponse } from "@/lib/api/committee-form";
import { responseToAnswers } from "@/lib/form/utils";
import { formatDate } from "@/lib/format";
import styles from "./AnswerDetailDialog.module.scss";

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	formId: string;
	responseId: string | null;
	/** formDetailToForm 済みの Form を渡す（再取得を避ける） */
	form: Form;
	/** 回答編集権限があるか */
	canEditAnswers: boolean;
};

type ResponseData = {
	projectId: string;
	projectName: string;
	submittedAt: Date | null;
	answers: FormAnswers;
};

export function AnswerDetailDialog({
	open,
	onOpenChange,
	formId,
	responseId,
	form,
	canEditAnswers,
}: Props) {
	const [data, setData] = useState<ResponseData | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (!open || !responseId) {
			setData(null);
			setError(null);
			return;
		}

		const controller = new AbortController();
		setLoading(true);
		setError(null);

		getFormResponse(formId, responseId)
			.then(res => {
				if (controller.signal.aborted) return;
				const answers = responseToAnswers(res.response, form);
				setData({
					projectId: res.response.project.id,
					projectName: res.response.project.name,
					submittedAt: res.response.submittedAt,
					answers,
				});
			})
			.catch(() => {
				if (controller.signal.aborted) return;
				setData(null);
				setError("回答の取得に失敗しました。時間をおいて再度お試しください。");
			})
			.finally(() => {
				if (!controller.signal.aborted) setLoading(false);
			});

		return () => controller.abort();
	}, [open, responseId, formId, form]);

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Content className={styles.dialogContent}>
				<VisuallyHidden>
					<Dialog.Title>回答詳細</Dialog.Title>
				</VisuallyHidden>

				<div className={styles.dialogInner}>
					{loading ? (
						<div className={styles.loading}>
							<Spinner size="3" />
						</div>
					) : error ? (
						<div className={styles.error}>
							<Text size="2" color="red">
								{error}
							</Text>
						</div>
					) : !data ? (
						<div className={styles.error}>
							<Text size="2" color="red">
								回答データが見つかりませんでした。
							</Text>
						</div>
					) : (
						<>
							<header className={styles.header}>
								<Text size="3" weight="bold">
									{form.name}
								</Text>
								<div className={styles.meta}>
									<Text size="2" color="gray">
										企画: {data.projectName}
									</Text>
									<Text size="2" color="gray">
										提出日時:{" "}
										{data.submittedAt
											? formatDate(data.submittedAt, "datetime")
											: "—"}
									</Text>
								</div>
							</header>

							<Separator size="4" />

							<ul className={styles.itemList}>
								{form.items.map(item => (
									<li key={item.id}>
										{canEditAnswers ? (
											<EditableAnswerItem
												item={item}
												initialValue={data.answers[item.id]}
												formId={formId}
												projectId={data.projectId}
												onSave={editFormAnswer}
											/>
										) : (
											<AnswerField
												item={item}
												value={data.answers[item.id]}
												onChange={() => {}}
												disabled
											/>
										)}
									</li>
								))}
							</ul>
						</>
					)}
				</div>
			</Dialog.Content>
		</Dialog.Root>
	);
}
