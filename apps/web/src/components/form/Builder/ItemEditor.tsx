import { Draggable } from "@hello-pangea/dnd";
// IconButton: wrapper 未作成のため直接 import
import { IconButton } from "@radix-ui/themes";
import {
	IconChevronDown,
	IconChevronUp,
	IconGripHorizontal,
	IconTrash,
} from "@tabler/icons-react";
import { Select, Switch, TextField } from "@/components/primitives";
import type { FormItem } from "../type";
import { AnswerFieldEditor } from "./AnswerFieldEditor";
import styles from "./ItemEditor.module.scss";

const FIELD_TYPES = [
	{ value: "text", label: "テキスト（短文）" },
	{ value: "textarea", label: "テキスト（長文）" },
	{ value: "select", label: "単一選択" },
	{ value: "checkbox", label: "複数選択" },
	{ value: "number", label: "数値" },
	{ value: "file", label: "ファイル" },
];

type Props = {
	item: FormItem;
	index: number;
	onUpdate: (id: string, update: Partial<FormItem>) => void;
	onRemove: (id: string) => void;
	onMoveUp: () => void;
	onMoveDown: () => void;
};

export function FormItemEditor({
	item,
	index,
	onUpdate,
	onRemove,
	onMoveUp,
	onMoveDown,
}: Props) {
	return (
		<Draggable draggableId={item.id} index={index}>
			{(provided, snapshot) => (
				<li
					ref={provided.innerRef}
					{...provided.draggableProps}
					className={`${styles.formLi} ${snapshot.isDragging ? styles.dragging : ""}`}
				>
					<div className={styles.card}>
						{/* ドラッグハンドル */}
						<button
							type="button"
							className={styles.dragHandle}
							{...provided.dragHandleProps}
						>
							<IconGripHorizontal size={18} />
						</button>

						<div className={styles.itemOperateButtons}>
							<IconButton variant="ghost" onClick={onMoveUp} disabled>
								<IconChevronUp size={18} />
							</IconButton>
							<IconButton variant="ghost" onClick={onMoveDown} disabled>
								<IconChevronDown size={18} />
							</IconButton>
							<IconButton variant="ghost" onClick={() => onRemove(item.id)}>
								<IconTrash size={18} />
							</IconButton>
						</div>

						{/* 質問 */}
						<TextField
							label=""
							aria-label={`質問 ${index + 1}`}
							value={item.label}
							onChange={value => onUpdate(item.id, { label: value })}
							placeholder={`質問 ${index + 1}`}
						/>

						{/* タイプ選択 */}
						<div className={styles.formItemSetting}>
							<Select
								options={FIELD_TYPES}
								value={item.type}
								onValueChange={value =>
									onUpdate(item.id, { type: value as FormItem["type"] })
								}
								aria-label="フィールドタイプ"
							/>

							<Switch
								label="必須"
								onCheckedChange={checked =>
									onUpdate(item.id, { required: checked })
								}
							/>
						</div>

						{/* 解答欄 */}
						<AnswerFieldEditor
							item={item}
							onUpdate={(update: Partial<FormItem>) =>
								onUpdate(item.id, update)
							}
						/>
					</div>
				</li>
			)}
		</Draggable>
	);
}
