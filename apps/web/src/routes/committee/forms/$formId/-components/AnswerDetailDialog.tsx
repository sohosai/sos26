import {
	Dialog,
	Separator,
	Spinner,
	Text,
	VisuallyHidden,
} from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { EditableAnswerItem } from "@/components/form/Answer/EditableAnswerItem";
import type { Form, FormAnswers } from "@/components/form/type";
import { getFormResponse } from "@/lib/api/committee-form";
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
}: Props) {
	const [data, setData] = useState<ResponseData | null>(null);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (!open || !responseId) {
			setData(null);
			return;
		}

		const controller = new AbortController();
		setLoading(true);

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
				// abort 以外のエラーは無視
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
					{loading || !data ? (
						<div className={styles.loading}>
							<Spinner size="3" />
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
									<li key={item.id} className={styles.itemCard}>
										<EditableAnswerItem
											item={item}
											initialValue={data.answers[item.id]}
											formId={formId}
											projectId={data.projectId}
										/>
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
