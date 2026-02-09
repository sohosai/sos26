// FormItemEditor.tsx
import { Switch } from "@/components/primitives";
import type { FormItem } from "../type";
import styles from "./ItemEditor.module.scss";

type Props = {
	item: FormItem;
	index: number;
	onUpdate: (id: string, update: Partial<FormItem>) => void;
	onRemove: (id: string) => void;
	onDragStart: () => void;
	onDragOver: (e: React.DragEvent) => void;
	onDrop: () => void;
	isDragging: boolean;
};

export function FormItemEditor({
	item,
	index,
	onUpdate,
	onRemove,
	onDragStart,
	onDragOver,
	onDrop,
	isDragging,
}: Props) {
	return (
		<li className={`${styles.card} ${isDragging ? styles.dragging : ""}`}>
			{/* ドラッグハンドル */}
			<button
				type="button"
				className={styles.dragHandle}
				draggable
				onDragStart={onDragStart}
				onDragOver={onDragOver}
				onDrop={onDrop}
			>
				≡
			</button>

			{/* 質問 */}
			<input
				className={styles.questionInput}
				value={item.label}
				onChange={e => onUpdate(item.id, { label: e.target.value })}
				placeholder={`質問 ${index + 1}`}
			/>

			{/* タイプ選択 */}
			<select
				className={styles.typeSelect}
				value={item.type}
				onChange={e =>
					onUpdate(item.id, {
						type: e.target.value as FormItem["type"],
					})
				}
			>
				<option value="text">記述式（短文）</option>
				<option value="textarea">記述式（長文）</option>
				<option value="select">ラジオボタン</option>
				<option value="checkbox">チェックボックス</option>
				<option value="number">数値</option>
				<option value="file">ファイルのアップロード</option>
			</select>

			{/* フッター */}
			<div className={styles.footer}>
				<Switch
					label={"必須"}
					onCheckedChange={checked => onUpdate(item.id, { required: checked })}
				/>

				<button
					type="button"
					className={styles.deleteButton}
					onClick={() => onRemove(item.id)}
				>
					🗑
				</button>
			</div>
		</li>
	);
}
