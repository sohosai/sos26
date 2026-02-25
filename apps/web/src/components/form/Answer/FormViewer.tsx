import { Text } from "@radix-ui/themes";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/primitives";
import type { Form, FormAnswers, FormAnswerValue } from "../type";
import { AnswerField } from "./AnswerField";
import styles from "./FormViewer.module.scss";

type Props = {
	form: Form;
	onSubmit?: (answers: FormAnswers) => Promise<void>;
	initialAnswers?: FormAnswers;
	onSaveDraft?: (answers: FormAnswers) => Promise<void>;
};

export function FormViewer({
	form,
	onSubmit,
	initialAnswers = {},
	onSaveDraft,
}: Props) {
	const [answers, setAnswers] = useState<FormAnswers>(initialAnswers);
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [isSavingDraft, setIsSavingDraft] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const updateAnswer = (itemId: string, value: FormAnswerValue) => {
		setAnswers(prev => ({ ...prev, [itemId]: value }));
		if (errors[itemId]) {
			setErrors(prev => {
				const next = { ...prev };
				delete next[itemId];
				return next;
			});
		}
	};

	const validate = (): boolean => {
		const newErrors: Record<string, string> = {};
		for (const item of form.items) {
			if (!item.required) continue;
			const value = answers[item.id];
			if (value === undefined || value === null || value === "") {
				newErrors[item.id] = "この項目は必須です";
			} else if (Array.isArray(value) && value.length === 0) {
				newErrors[item.id] = "この項目は必須です";
			}
		}
		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleSaveDraft = async () => {
		setIsSavingDraft(true);
		try {
			await onSaveDraft?.(answers);
			toast.success("下書きを保存しました");
		} catch {
			toast.error("下書きの保存に失敗しました");
		} finally {
			setIsSavingDraft(false);
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!validate()) return;
		setIsSubmitting(true);
		try {
			await onSubmit?.(answers);
			toast.success("送信しました");
		} catch {
			toast.error("送信に失敗しました");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<form className={styles.root} onSubmit={handleSubmit} noValidate>
			<div className={styles.header}>
				<Text size="5" weight="bold">
					{form.name || "無題のフォーム"}
				</Text>
				{form.description && <Text size="2">{form.description}</Text>}
			</div>

			<ul className={styles.itemList}>
				{form.items.map(item => (
					<li key={item.id} className={styles.itemCard}>
						<Text size="2">{item.description}</Text>
						<AnswerField
							item={item}
							value={answers[item.id]}
							onChange={val => updateAnswer(item.id, val)}
						/>
						{errors[item.id] && (
							<Text size="2" color="red">
								{errors[item.id]}
							</Text>
						)}
					</li>
				))}
			</ul>

			<div className={styles.footer}>
				{onSaveDraft && (
					<Button
						intent="secondary"
						type="button"
						onClick={handleSaveDraft}
						loading={isSavingDraft}
						disabled={isSubmitting}
					>
						下書きを保存
					</Button>
				)}
				<Button type="submit" loading={isSubmitting} disabled={isSavingDraft}>
					送信する
				</Button>
			</div>
		</form>
	);
}
