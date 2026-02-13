import { IconButton, TextField } from "@radix-ui/themes";
import { IconPlus, IconX } from "@tabler/icons-react";
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
					<input
						disabled
						placeholder="回答欄（短文）"
						className={styles.input}
					/>
				</div>
			);

		case "textarea":
			return (
				<div className={styles.preview}>
					{/* 入力用では textarea だが、こちらでは入力を行はないため、見た目のみ */}
					<input
						disabled
						placeholder="回答欄（長文）"
						className={styles.input}
					/>
				</div>
			);

		case "number":
			return (
				<div className={styles.preview}>
					<input type="number" disabled className={styles.input} />
				</div>
			);

		case "file":
			return (
				<div className={styles.preview}>
					<input type="file" disabled />
				</div>
			);

		case "select":
		case "checkbox":
			return (
				<div className={styles.options}>
					{/* <Text size="2" weight="medium">
						選択肢
					</Text> */}

					{(item.options ?? []).map((option, index) => (
						<div key={option.id} className={styles.optionRow}>
							<input
								type={item.type === "select" ? "radio" : "checkbox"}
								disabled
							/>
							<TextField.Root
								value={option.label}
								placeholder={`選択肢 ${index + 1}`}
								onChange={e => {
									const newOptions = [...(item.options ?? [])];
									newOptions[index] = {
										...option,
										label: e.target.value,
									};
									onUpdate({ options: newOptions });
								}}
							/>
							<IconButton
								variant="ghost"
								color="red"
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

					<button
						type="button"
						className={styles.addOption}
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
						<IconPlus size={16} stroke={1.5} /> 選択肢を追加
					</button>
				</div>
			);

		default:
			return null;
	}
}
