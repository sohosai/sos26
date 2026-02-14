// Radio/Checkbox: Editor の装飾表示用（disabled 固定）のため直接 import
import { Checkbox, Radio } from "@radix-ui/themes";
import { IconPlus, IconX } from "@tabler/icons-react";
import { Button, IconButton, TextField } from "@/components/primitives";
import { FileUploadField } from "../EachField/FileUploadField";
import type { FormItem } from "../type";
import styles from "./AnswerFieldEditor.module.scss";

type Props = {
	item: FormItem;
	onUpdate: (update: Partial<FormItem>) => void;
};

export function AnswerFieldEditor({ item, onUpdate }: Props) {
	switch (item.type) {
		case "text":
			return (
				<div className={styles.preview}>
					<TextField
						disabled
						placeholder="回答欄（短文）"
						label={""}
						aria-label="回答欄（短文）"
					/>
				</div>
			);

		case "textarea":
			return (
				<div className={styles.preview}>
					{/* 入力用では textarea だが、こちらでは入力を行わないため、見た目のみ */}
					<TextField
						disabled
						placeholder="回答欄（長文）"
						label={""}
						aria-label="回答欄（長文）"
					/>
				</div>
			);

		case "number":
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

		case "file":
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

		case "select":
		case "checkbox":
			return (
				<div className={styles.options}>
					{(item.options ?? []).map((option, index) => (
						<div key={option.id} className={styles.optionRow}>
							{item.type === "select" ? (
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
						intent="ghost"
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
