import { Text } from "@radix-ui/themes";
import { PATTERN_LABELS, PATTERN_REGEXES } from "@sos26/shared";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/primitives";
import {
	createEmptyFileAnswerValue,
	type Form,
	type FormAnswers,
	type FormAnswerValue,
	type FormItem,
	isFileAnswerValue,
} from "../type";
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
	onDirtyChange?: (dirty: boolean) => void;
};

function isSameFileValue(
	a: FormAnswerValue | undefined,
	b: FormAnswerValue | undefined
): boolean {
	if (!isFileAnswerValue(a) || !isFileAnswerValue(b)) return false;

	const samePending =
		a.pendingFile === null && b.pendingFile === null
			? true
			: a.pendingFile !== null &&
				b.pendingFile !== null &&
				a.pendingFile.name === b.pendingFile.name &&
				a.pendingFile.size === b.pendingFile.size &&
				a.pendingFile.type === b.pendingFile.type &&
				a.pendingFile.lastModified === b.pendingFile.lastModified;

	const sameUploaded =
		a.uploadedFile === null && b.uploadedFile === null
			? true
			: a.uploadedFile !== null &&
				b.uploadedFile !== null &&
				a.uploadedFile.fileId === b.uploadedFile.fileId;

	return samePending && sameUploaded;
}

function isSameAnswerValue(
	a: FormAnswerValue | undefined,
	b: FormAnswerValue | undefined
): boolean {
	if (Array.isArray(a) || Array.isArray(b)) {
		if (!Array.isArray(a) || !Array.isArray(b)) return false;
		if (a.length !== b.length) return false;
		return a.every((val, idx) => val === b[idx]);
	}

	if (isFileAnswerValue(a) || isFileAnswerValue(b)) {
		return isSameFileValue(a, b);
	}

	return a === b;
}

function getDefaultValue(type: Form["items"][number]["type"]): FormAnswerValue {
	switch (type) {
		case "CHECKBOX":
			return [];
		case "FILE":
			return createEmptyFileAnswerValue();
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

function resolvePatternRegex(
	pattern: string,
	customPattern?: string | null
): RegExp | null {
	if (pattern === "custom") {
		if (!customPattern) return null;
		try {
			return new RegExp(customPattern);
		} catch {
			return null;
		}
	}
	return PATTERN_REGEXES[pattern] ?? null;
}

function validateTextConstraints(
	value: string,
	constraints: NonNullable<FormItem["constraints"]>
): string | null {
	const { minLength, maxLength, pattern, customPattern } = constraints;

	if (minLength !== undefined && value.length < minLength) {
		return `${minLength}文字以上で入力してください`;
	}
	if (maxLength !== undefined && value.length > maxLength) {
		return `${maxLength}文字以内で入力してください`;
	}
	if (pattern) {
		const regex = resolvePatternRegex(pattern, customPattern);
		if (regex && !regex.test(value)) {
			const label =
				pattern === "custom"
					? `パターン（${customPattern}）`
					: (PATTERN_LABELS[pattern] ?? pattern);
			return `${label}のみで入力してください`;
		}
	}
	return null;
}

function validateItem(
	item: FormItem,
	value: FormAnswerValue | undefined
): string | null {
	if (item.required) {
		if (item.type === "FILE") {
			if (
				!isFileAnswerValue(value) ||
				(value.pendingFile === null && value.uploadedFile === null)
			) {
				return "この項目は必須です";
			}
		} else if (
			value === undefined ||
			value === null ||
			value === "" ||
			(Array.isArray(value) && value.length === 0)
		) {
			return "この項目は必須です";
		}
	}

	if (
		(item.type === "TEXT" || item.type === "TEXTAREA") &&
		item.constraints &&
		typeof value === "string" &&
		value !== ""
	) {
		return validateTextConstraints(value, item.constraints);
	}

	return null;
}

export function FormViewer({
	form,
	onSubmit,
	initialAnswers = EMPTY_ANSWERS,
	onSaveDraft,
	disableSubmit = false,
	disableSaveDraft = false,
	onDirtyChange,
}: Props) {
	const [answers, setAnswers] = useState<FormAnswers>(() =>
		buildInitialAnswers(form, initialAnswers)
	);
	const [baselineAnswers, setBaselineAnswers] = useState<FormAnswers>(() =>
		buildInitialAnswers(form, initialAnswers)
	);
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [isSavingDraft, setIsSavingDraft] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);

	useEffect(() => {
		const nextInitialAnswers = buildInitialAnswers(form, initialAnswers);
		setAnswers(nextInitialAnswers);
		setBaselineAnswers(nextInitialAnswers);
		setErrors({});
	}, [form, initialAnswers]);

	const isDirty = useMemo(
		() =>
			form.items.some(
				item => !isSameAnswerValue(answers[item.id], baselineAnswers[item.id])
			),
		[form.items, answers, baselineAnswers]
	);

	useEffect(() => {
		onDirtyChange?.(isDirty);
	}, [isDirty, onDirtyChange]);

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
			const error = validateItem(item, answers[item.id]);
			if (error) newErrors[item.id] = error;
		}
		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleSaveDraft = async () => {
		if (!onSaveDraft) return;
		setIsSavingDraft(true);
		try {
			await onSaveDraft(answers);
			setBaselineAnswers(answers);
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
			setBaselineAnswers(answers);
			toast.success("送信しました");
		} catch {
			toast.error("送信に失敗しました");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<form className={styles.root} onSubmit={handleSubmit} noValidate>
			<div className={styles.content}>
				<div className={styles.header}>
					<Text size="5" weight="bold">
						{form.name || "無題の申請"}
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
			</div>

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
