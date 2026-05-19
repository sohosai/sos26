import {
	Dialog,
	Separator,
	Spinner,
	Text,
	VisuallyHidden,
} from "@radix-ui/themes";
import { type ComponentProps, useEffect, useState } from "react";
import { responseToAnswers } from "@/lib/form/utils";
import { formatDate } from "@/lib/format";
import type { Form, FormAnswers } from "../type";
import styles from "./AnswerDetailDialog.module.scss";
import { AnswerField } from "./AnswerField";
import { EditableAnswerItem } from "./EditableAnswerItem";

type AnswerResponse = Parameters<typeof responseToAnswers>[0];

type ResponseData = {
	projectId: string;
	projectName: string;
	submittedAt: Date | null;
	answers: FormAnswers;
};

type FetchResponse = (
	formId: string,
	responseId: string
) => Promise<{
	response: AnswerResponse & {
		project: {
			id: string;
			name: string;
		};
		submittedAt: Date | null;
	};
}>;

type SaveAnswer = ComponentProps<typeof EditableAnswerItem>["onSave"];

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	formId: string;
	responseId: string | null;
	form: Form;
	canEditAnswers: boolean;
	fetchResponse: FetchResponse;
	onSave: SaveAnswer;
	submittedAtLabel?: string;
	submittedAtFallback?: string;
};

export function AnswerDetailDialog({
	open,
	onOpenChange,
	formId,
	responseId,
	form,
	canEditAnswers,
	fetchResponse,
	onSave,
	submittedAtLabel = "提出日時",
	submittedAtFallback = "—",
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

		fetchResponse(formId, responseId)
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
	}, [open, responseId, formId, form, fetchResponse]);

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
										{submittedAtLabel}:{" "}
										{data.submittedAt
											? formatDate(data.submittedAt, "datetime")
											: submittedAtFallback}
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
												onSave={onSave}
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
