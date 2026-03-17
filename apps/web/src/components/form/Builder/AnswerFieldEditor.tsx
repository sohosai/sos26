// Radio/Checkbox: Editor の装飾表示用（disabled 固定）のため直接 import
import { Checkbox, Radio, Text } from "@radix-ui/themes";
import type {
	FileConstraints,
	FormItemConstraints,
	TextConstraints,
} from "@sos26/shared";
import { IconPlus, IconX } from "@tabler/icons-react";
import { Button, IconButton, Select, TextField } from "@/components/primitives";
import { FileUploadField } from "../EachField/FileUploadField";
import { NumberField } from "../EachField/NumberField";
import type { FormItem } from "../type";
import styles from "./AnswerFieldEditor.module.scss";

const PATTERN_OPTIONS = [
	{ value: "none", label: "制限なし" },
	{ value: "katakana", label: "全角カタカナのみ" },
	{ value: "hiragana", label: "ひらがなのみ" },
	{ value: "alphanumeric", label: "半角英数字のみ" },
	{ value: "custom", label: "🔧カスタム（正規表現）" },
];

type TextConstraintEditorProps = {
	constraints: FormItemConstraints | null | undefined;
	onUpdate: (constraints: TextConstraints | null) => void;
};

function pickTextConstraints(
	constraints: FormItemConstraints | null | undefined
): TextConstraints | null {
	if (!constraints) return null;

	const next: TextConstraints = {
		...(constraints.minLength !== undefined && {
			minLength: constraints.minLength,
		}),
		...(constraints.maxLength !== undefined && {
			maxLength: constraints.maxLength,
		}),
		...(constraints.pattern !== undefined && { pattern: constraints.pattern }),
		...(constraints.customPattern !== undefined && {
			customPattern: constraints.customPattern,
		}),
	};

	return Object.keys(next).length > 0 ? next : null;
}

function pickFileConstraints(
	constraints: FormItemConstraints | null | undefined
): FileConstraints | null {
	if (!constraints) return null;

	const next: FileConstraints = {
		...(constraints.minFiles !== undefined && {
			minFiles: constraints.minFiles,
		}),
		...(constraints.maxFiles !== undefined && {
			maxFiles: constraints.maxFiles,
		}),
	};

	return Object.keys(next).length > 0 ? next : null;
}

function TextConstraintEditor({
	constraints,
	onUpdate,
}: TextConstraintEditorProps) {
	const textConstraints = pickTextConstraints(constraints);

	const update = (partial: Partial<TextConstraints>) => {
		const next = { ...(textConstraints ?? {}), ...partial };
		const isEmpty =
			next.minLength === undefined &&
			next.maxLength === undefined &&
			!next.pattern &&
			!next.customPattern;
		onUpdate(isEmpty ? null : next);
	};

	const minMaxError =
		textConstraints?.minLength !== undefined &&
		textConstraints?.maxLength !== undefined &&
		textConstraints.minLength > textConstraints.maxLength
			? "最小文字数は最大文字数以下にしてください"
			: undefined;

	return (
		<div className={styles.constraints}>
			<Text size="2" weight="medium">
				入力制約
			</Text>
			<div className={styles.constraintRow}>
				<NumberField
					label="最小文字数"
					value={textConstraints?.minLength ?? null}
					onChange={n => update({ minLength: n ?? undefined })}
					placeholder="例: 10"
					error={minMaxError}
				/>
				<NumberField
					label="最大文字数"
					value={textConstraints?.maxLength ?? null}
					onChange={n => update({ maxLength: n ?? undefined })}
					placeholder="例: 200"
				/>
			</div>
			<div>
				<Text as="label" size="2" weight="medium">
					文字種制限
				</Text>
				<div className={styles.patternRow}>
					<Select
						options={PATTERN_OPTIONS}
						value={textConstraints?.pattern ?? "none"}
						onValueChange={v => {
							update({
								pattern:
									v === "none" ? undefined : (v as TextConstraints["pattern"]),
								customPattern:
									v !== "custom" ? undefined : textConstraints?.customPattern,
							});
						}}
						aria-label="文字種制限"
					/>
				</div>
			</div>
			{textConstraints?.pattern === "custom" && (
				<TextField
					label="正規表現パターン"
					value={textConstraints.customPattern ?? ""}
					onChange={v => update({ customPattern: v })}
					placeholder="例: ^[ぁ-んー]+$"
				/>
			)}
		</div>
	);
}

type FileConstraintEditorProps = {
	constraints: FormItemConstraints | null | undefined;
	onUpdate: (constraints: FileConstraints | null) => void;
};

function FileConstraintEditor({
	constraints,
	onUpdate,
}: FileConstraintEditorProps) {
	const fileConstraints = pickFileConstraints(constraints);

	const update = (partial: Partial<FileConstraints>) => {
		const next = { ...(fileConstraints ?? {}), ...partial };
		const isEmpty = next.minFiles === undefined && next.maxFiles === undefined;
		onUpdate(isEmpty ? null : next);
	};

	const minMaxError =
		fileConstraints?.minFiles !== undefined &&
		fileConstraints?.maxFiles !== undefined &&
		fileConstraints.minFiles > fileConstraints.maxFiles
			? "最小ファイル数は最大ファイル数以下にしてください"
			: undefined;

	return (
		<div className={styles.constraints}>
			<Text size="2" weight="medium">
				添付制約
			</Text>
			<div className={styles.constraintRow}>
				<NumberField
					label="最小ファイル数"
					value={fileConstraints?.minFiles ?? null}
					onChange={n => update({ minFiles: n ?? undefined })}
					placeholder="例: 1"
					error={minMaxError}
				/>
				<NumberField
					label="最大ファイル数"
					value={fileConstraints?.maxFiles ?? null}
					onChange={n => update({ maxFiles: n ?? undefined })}
					placeholder="例: 5"
				/>
			</div>
		</div>
	);
}

type Props = {
	item: FormItem;
	onUpdate: (update: Partial<FormItem>) => void;
};

export function AnswerFieldEditor({ item, onUpdate }: Props) {
	switch (item.type) {
		case "TEXT":
			return (
				<div>
					<div className={styles.preview}>
						<TextField
							disabled
							placeholder="回答欄（短文）"
							label={""}
							aria-label="回答欄（短文）"
						/>
					</div>
					<TextConstraintEditor
						constraints={item.constraints}
						onUpdate={constraints => onUpdate({ constraints })}
					/>
				</div>
			);

		case "TEXTAREA":
			return (
				<div>
					<div className={styles.preview}>
						<TextField
							disabled
							placeholder="回答欄（長文）"
							label={""}
							aria-label="回答欄（長文）"
						/>
					</div>
					<TextConstraintEditor
						constraints={item.constraints}
						onUpdate={constraints => onUpdate({ constraints })}
					/>
				</div>
			);

		case "NUMBER":
			return (
				<div className={styles.preview}>
					<TextField
						disabled
						placeholder="回答欄（数値）"
						label={""}
						aria-label="回答欄（数値）"
					/>
				</div>
			);

		case "FILE":
			return (
				<div>
					<div className={styles.preview}>
						<FileUploadField
							label={""}
							value={[]}
							onChange={() => {}}
							required={false}
							disabled
						/>
					</div>
					<FileConstraintEditor
						constraints={item.constraints}
						onUpdate={constraints => onUpdate({ constraints })}
					/>
				</div>
			);

		case "SELECT":
		case "CHECKBOX":
			return (
				<div className={styles.options}>
					{(item.options ?? []).map((option, index) => (
						<div key={option.id} className={styles.optionRow}>
							{item.type === "SELECT" ? (
								<Radio disabled value={""} />
							) : (
								<Checkbox disabled />
							)}
							<TextField
								value={option.label}
								placeholder={`選択肢 ${index + 1}`}
								onChange={value => {
									const newOptions = [...(item.options ?? [])];
									newOptions[index] = {
										...option,
										label: value,
									};
									onUpdate({ options: newOptions });
								}}
								label={""}
								aria-label={`選択肢 ${index + 1}`}
							/>

							<IconButton
								intent="danger"
								onClick={() => {
									onUpdate({
										options: (item.options ?? []).filter(
											op => op.id !== option.id
										),
									});
								}}
							>
								<IconX size={16} stroke={1.5} />
							</IconButton>
						</div>
					))}

					<Button
						intent="secondary"
						size="1"
						onClick={() =>
							onUpdate({
								options: [
									...(item.options ?? []),
									{
										id: crypto.randomUUID(),
										label: "",
									},
								],
							})
						}
					>
						<IconPlus size={16} stroke={1.5} />
						選択肢を追加
					</Button>
				</div>
			);
		default:
			return null;
	}
}
