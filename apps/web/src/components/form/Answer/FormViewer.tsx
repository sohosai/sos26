import { Text } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/primitives";
import type { Form, FormAnswers, FormAnswerValue } from "../type";
import { AnswerField } from "./AnswerField";
import styles from "./FormViewer.module.scss";

const EMPTY_ANSWERS: FormAnswers = {};

type Props = {
	form: Form;
	onSubmit?: (answers: FormAnswers) => Promise<void>;
	initialAnswers?: FormAnswers;
	onSaveDraft?: (answers: FormAnswers) => Promise<void>;
	disableSubmit?: boolean;
	disableSaveDraft?: boolean;
};

function getDefaultValue(type: Form["items"][number]["type"]): FormAnswerValue {
	switch (type) {
		case "CHECKBOX":
			return [];
		case "NUMBER":
			return null;
		default:
			return "";
	}
}

function buildInitialAnswers(
	form: Form,
	initialAnswers: FormAnswers
): FormAnswers {
	const merged: FormAnswers = {};
	for (const item of form.items) {
		merged[item.id] = initialAnswers[item.id] ?? getDefaultValue(item.type);
	}
	return merged;
}

const PATTERN_REGEXES: Record<string, RegExp> = {
	katakana: /^[\u30A0-\u30FF\u30FCー]+$/,
	hiragana: /^[\u3040-\u309F]+$/,
	alphanumeric: /^[a-zA-Z0-9]+$/,
};

const PATTERN_LABELS: Record<string, string> = {
	katakana: "全角カタカナ",
	hiragana: "ひらがな",
	alphanumeric: "半角英数字",
};

export function FormViewer({
	form,
	onSubmit,
	initialAnswers = EMPTY_ANSWERS,
	onSaveDraft,
	disableSubmit = false,
	disableSaveDraft = false,
}: Props) {
	const [answers, setAnswers] = useState<FormAnswers>(() =>
		buildInitialAnswers(form, initialAnswers)
	);
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [isSavingDraft, setIsSavingDraft] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);

	useEffect(() => {
		setAnswers(buildInitialAnswers(form, initialAnswers));
		setErrors({});
	}, [form, initialAnswers]);

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

	// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: validates all items with nested branching per item type and constraint
	const validate = (): boolean => {
		const newErrors: Record<string, string> = {};
		for (const item of form.items) {
			const value = answers[item.id];

			if (item.required) {
				if (value === undefined || value === null || value === "") {
					newErrors[item.id] = "この項目は必須です";
					continue;
				}
				if (Array.isArray(value) && value.length === 0) {
					newErrors[item.id] = "この項目は必須です";
					continue;
				}
			}

			if (
				(item.type === "TEXT" || item.type === "TEXTAREA") &&
				item.constraints &&
				typeof value === "string" &&
				value !== ""
			) {
				const { minLength, maxLength, pattern, customPattern } =
					item.constraints;

				if (minLength !== undefined && value.length < minLength) {
					newErrors[item.id] = `${minLength}文字以上で入力してください`;
					continue;
				}

				if (maxLength !== undefined && value.length > maxLength) {
					newErrors[item.id] = `${maxLength}文字以内で入力してください`;
					continue;
				}

				if (pattern) {
					let regex: RegExp | null = null;
					if (pattern === "custom") {
						if (customPattern) {
							try {
								regex = new RegExp(customPattern);
							} catch {
								// invalid regex - skip
							}
						}
					} else {
						regex = PATTERN_REGEXES[pattern] ?? null;
					}

					if (regex && !regex.test(value)) {
						const label =
							pattern === "custom"
								? `パターン（${customPattern}）`
								: (PATTERN_LABELS[pattern] ?? pattern);
						newErrors[item.id] = `${label}のみで入力してください`;
					}
				}
			}
		}
		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleSaveDraft = async () => {
		if (!onSaveDraft) return;
		setIsSavingDraft(true);
		try {
			await onSaveDraft(answers);
			toast.success("下書きを保存しました");
		} catch {
			toast.error("下書きの保存に失敗しました");
		} finally {
			setIsSavingDraft(false);
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!onSubmit || disableSubmit) return;
		if (!validate()) return;
		setIsSubmitting(true);
		try {
			await onSubmit(answers);
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
						<AnswerField
							item={item}
							value={answers[item.id]}
							onChange={val => updateAnswer(item.id, val)}
							disabled={disableSubmit && disableSaveDraft}
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
				{onSaveDraft && !disableSaveDraft && (
					<Button
						intent="secondary"
						type="button"
						onClick={handleSaveDraft}
						loading={isSavingDraft}
						disabled={isSubmitting || disableSaveDraft}
					>
						下書きを保存
					</Button>
				)}
				<Button
					type="submit"
					loading={isSubmitting}
					disabled={isSavingDraft || disableSubmit}
				>
					送信する
				</Button>
			</div>
		</form>
	);
}
