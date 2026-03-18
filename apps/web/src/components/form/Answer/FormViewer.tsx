import { Text } from "@radix-ui/themes";
import { PATTERN_LABELS, PATTERN_REGEXES } from "@sos26/shared";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AttachmentPreviewButton } from "@/components/filePreview/AttachmentPreviewButton";
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
		a.pendingFiles.length === b.pendingFiles.length &&
		a.pendingFiles.every(
			(f, i) =>
				f.name === b.pendingFiles[i]?.name &&
				f.size === b.pendingFiles[i]?.size &&
				f.type === b.pendingFiles[i]?.type &&
				f.lastModified === b.pendingFiles[i]?.lastModified
		);

	const sameUploaded =
		a.uploadedFiles.length === b.uploadedFiles.length &&
		a.uploadedFiles.every((f, i) => f.id === b.uploadedFiles[i]?.id);

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

function validateFileConstraints(
	value: FormAnswerValue | undefined,
	constraints: NonNullable<FormItem["constraints"]>
): string | null {
	if (!isFileAnswerValue(value)) {
		return null;
	}

	const fileCount = value.pendingFiles.length + value.uploadedFiles.length;

	if (constraints.minFiles !== undefined && fileCount < constraints.minFiles) {
		return `${constraints.minFiles}個以上添付してください`;
	}

	if (constraints.maxFiles !== undefined && fileCount > constraints.maxFiles) {
		return `${constraints.maxFiles}個以内で添付してください`;
	}

	return null;
}

function isRequiredValueMissing(value: FormAnswerValue | undefined): boolean {
	return (
		value === undefined ||
		value === null ||
		value === "" ||
		(Array.isArray(value) && value.length === 0)
	);
}

function isRequiredFileValueMissing(
	value: FormAnswerValue | undefined
): boolean {
	return (
		!isFileAnswerValue(value) ||
		(value.pendingFiles.length === 0 && value.uploadedFiles.length === 0)
	);
}

function validateRequiredItem(
	item: FormItem,
	value: FormAnswerValue | undefined
): string | null {
	if (!item.required) return null;
	if (item.type === "FILE") {
		return isRequiredFileValueMissing(value) ? "この項目は必須です" : null;
	}
	return isRequiredValueMissing(value) ? "この項目は必須です" : null;
}

function validateItem(
	item: FormItem,
	value: FormAnswerValue | undefined
): string | null {
	const requiredError = validateRequiredItem(item, value);
	if (requiredError) return requiredError;

	if (item.type === "FILE" && item.constraints) {
		return validateFileConstraints(value, item.constraints);
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

function summarizeAnswersForLog(answers: FormAnswers) {
	return Object.fromEntries(
		Object.entries(answers).map(([itemId, value]) => {
			if (isFileAnswerValue(value)) {
				return [
					itemId,
					{
						pendingFiles: value.pendingFiles.map(file => ({
							name: file.name,
							size: file.size,
							type: file.type,
						})),
						uploadedFiles: value.uploadedFiles.map(file => ({
							id: file.id,
							fileName: file.fileName,
							size: file.size,
							mimeType: file.mimeType,
							sortOrder: file.sortOrder,
						})),
					},
				];
			}
			return [itemId, value];
		})
	);
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
		const nextErrors: Record<string, string> = {};
		for (const item of form.items) {
			const error = validateItem(item, nextInitialAnswers[item.id]);
			if (error) {
				nextErrors[item.id] = error;
			}
		}
		setErrors(nextErrors);
	}, [form, initialAnswers]);

	const isDirty = useMemo(
		() =>
			form.items.some(
				item => !isSameAnswerValue(answers[item.id], baselineAnswers[item.id])
			),
		[form.items, answers, baselineAnswers]
	);

	const isSubmittable = useMemo(() => {
		if (disableSubmit) return false;
		return form.items.every(item => !errors[item.id]);
	}, [form.items, errors, disableSubmit]);

	useEffect(() => {
		onDirtyChange?.(isDirty);
	}, [isDirty, onDirtyChange]);

	const updateAnswer = (itemId: string, value: FormAnswerValue) => {
		setAnswers(prev => ({ ...prev, [itemId]: value }));
		setErrors(prev => {
			const next = { ...prev };
			const item = form.items.find(i => i.id === itemId);
			if (!item) {
				return next;
			}
			const error = validateItem(item, value);
			if (error) {
				next[itemId] = error;
			} else {
				delete next[itemId];
			}
			return next;
		});
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
		} catch (error) {
			console.error("Form submission failed", {
				formId: form.id,
				formName: form.name,
				answers: summarizeAnswersForLog(answers),
				error,
			});
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
					{form.attachments && form.attachments.length > 0 && (
						<div className={styles.attachmentSection}>
							<Text size="2" weight="medium" color="gray">
								添付ファイル
							</Text>
							<div className={styles.attachmentList}>
								{form.attachments.map(attachment => (
									<AttachmentPreviewButton
										key={attachment.id}
										attachment={attachment}
									/>
								))}
							</div>
						</div>
					)}
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
					intent={isSubmittable ? "primary" : "secondary"}
					loading={isSubmitting}
					disabled={isSubmitting || isSavingDraft || disableSubmit}
				>
					送信する
				</Button>
			</div>
		</form>
	);
}
