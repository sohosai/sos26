// Radio/Checkbox: Editor の装飾表示用（disabled 固定）のため直接 import
import { Checkbox, Radio, Text } from "@radix-ui/themes";
import { IconPlus, IconX } from "@tabler/icons-react";
import { Button, IconButton, Select, TextField } from "@/components/primitives";
import { FileUploadField } from "../EachField/FileUploadField";
import type { FormItem, TextConstraints } from "../type";
import styles from "./AnswerFieldEditor.module.scss";

const PATTERN_OPTIONS = [
	{ value: "none", label: "制限なし" },
	{ value: "katakana", label: "全角カタカナのみ" },
	{ value: "hiragana", label: "ひらがなのみ" },
	{ value: "alphanumeric", label: "半角英数字のみ" },
	{ value: "custom", label: "🔧カスタム（正規表現）" },
];

type TextConstraintEditorProps = {
	constraints: TextConstraints | null | undefined;
	onUpdate: (constraints: TextConstraints | null) => void;
};

function TextConstraintEditor({
	constraints,
	onUpdate,
}: TextConstraintEditorProps) {
	const update = (partial: Partial<TextConstraints>) => {
		const next = { ...(constraints ?? {}), ...partial };
		const isEmpty =
			next.minLength === undefined &&
			next.maxLength === undefined &&
			!next.pattern &&
			!next.customPattern;
		onUpdate(isEmpty ? null : next);
	};

	return (
		<div className={styles.constraints}>
			<Text size="2" weight="medium">
				入力制約
			</Text>
			<div className={styles.constraintRow}>
				<TextField
					label="最小文字数"
					type="number"
					value={
						constraints?.minLength !== undefined
							? String(constraints.minLength)
							: ""
					}
					onChange={v => {
						const n = v === "" ? undefined : Math.max(0, Math.floor(Number(v)));
						update({ minLength: n });
					}}
					placeholder="例: 10"
				/>
				<TextField
					label="最大文字数"
					type="number"
					value={
						constraints?.maxLength !== undefined
							? String(constraints.maxLength)
							: ""
					}
					onChange={v => {
						const n = v === "" ? undefined : Math.max(1, Math.floor(Number(v)));
						update({ maxLength: n });
					}}
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
						value={constraints?.pattern ?? "none"}
						onValueChange={v => {
							update({
								pattern:
									v === "none" ? undefined : (v as TextConstraints["pattern"]),
								customPattern:
									v !== "custom" ? undefined : constraints?.customPattern,
							});
						}}
						aria-label="文字種制限"
					/>
				</div>
			</div>
			{constraints?.pattern === "custom" && (
				<TextField
					label="正規表現パターン"
					value={constraints.customPattern ?? ""}
					onChange={v => update({ customPattern: v })}
					placeholder="例: ^[ぁ-んー]+$"
				/>
			)}
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
				<div className={styles.preview}>
					<FileUploadField
						label={""}
						value={null}
						onChange={() => {}}
						required={false}
						disabled
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
