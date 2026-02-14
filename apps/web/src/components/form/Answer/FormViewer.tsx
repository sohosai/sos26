import { Dialog, Text, VisuallyHidden } from "@radix-ui/themes";
import { IconCheck } from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "@/components/primitives";
import type { Form, FormAnswers, FormAnswerValue } from "../type";
import { AnswerField } from "./AnswerField";
import styles from "./FormViewer.module.scss";

type Props = {
	form: Form;
	onSubmit?: (answers: FormAnswers) => void;
	onClose?: () => void;
};

export function FormViewer({ form, onSubmit, onClose }: Props) {
	const [answers, setAnswers] = useState<FormAnswers>({});
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [submitted, setSubmitted] = useState(false);
	const [completeOpen, setCompleteOpen] = useState(false);

	const handleCompleteClose = () => {
		setCompleteOpen(false);
		onClose?.();
	};

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

	const handleSaveDraft = () => {
		// TODO: 下書きを保存する処理を実装
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!validate()) return;
		setSubmitted(true);
		setCompleteOpen(true);
		onSubmit?.(answers);
	};

	if (submitted) {
		return (
			<Dialog.Root
				open={completeOpen}
				onOpenChange={open => {
					if (!open) handleCompleteClose();
				}}
			>
				<Dialog.Content>
					<VisuallyHidden>
						<Dialog.Title>送信完了</Dialog.Title>
					</VisuallyHidden>
					<div className={styles.complete}>
						<span className={styles.completeHeader}>
							<IconCheck size={24} />
							<Text size="5" weight="bold">
								送信しました
							</Text>
						</span>
						<Text size="2">ご回答ありがとうございました。</Text>
						<Button onClick={handleCompleteClose}>閉じる</Button>
					</div>
				</Dialog.Content>
			</Dialog.Root>
		);
	}

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
				<Button intent="secondary" type="button" onClick={handleSaveDraft}>
					下書きを保存
				</Button>
				<Button type="submit">送信する</Button>
			</div>
		</form>
	);
}
