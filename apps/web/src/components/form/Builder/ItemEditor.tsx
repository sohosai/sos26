import {
	CaretDownIcon,
	CaretUpIcon,
	CheckIcon,
	CubeIcon,
	DragHandleDots2Icon,
	FileIcon,
	RadiobuttonIcon,
	TextAlignLeftIcon,
	TextIcon,
	TrashIcon,
} from "@radix-ui/react-icons";
// import { DragHandleDots2Icon, CaretUpIcon, CaretDownIcon, TrashIcon, ChevronDownIcon } from "@radix-ui/react-icons";
import { IconButton, Select } from "@radix-ui/themes";
import { useState } from "react";
import { Switch } from "@/components/primitives";
import type { FormItem } from "../type";
import { AnswerFieldEditor } from "./AnswerFieldEditor";
import styles from "./ItemEditor.module.scss";

const FIELD_TYPES = [
	{ value: "text", label: "記述式（短文）", icon: <TextIcon /> },
	{ value: "textarea", label: "記述式（長文）", icon: <TextAlignLeftIcon /> },
	{ value: "select", label: "ラジオボタン", icon: <RadiobuttonIcon /> },
	{ value: "checkbox", label: "チェックボックス", icon: <CheckIcon /> },
	{ value: "number", label: "数値", icon: <CubeIcon /> },
	{ value: "file", label: "ファイル", icon: <FileIcon /> },
] as const;

type Props = {
	item: FormItem;
	index: number;
	onUpdate: (id: string, update: Partial<FormItem>) => void;
	onRemove: (id: string) => void;
	onDragStart: () => void;
	onDragOver: (e: React.DragEvent) => void;
	onDrop: () => void;
	isDragging: boolean;
	isDragOver: boolean;
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
	isDragOver,
}: Props) {
	const [isOpen, setIsOpen] = useState(false);
	const currentType = FIELD_TYPES.find(f => f.value === item.type);

	return (
		<li
			className={`${styles.formLi} ${isDragging ? styles.dragging : ""} ${isDragOver ? styles.dragOver : ""}`}
		>
			{/* ドラッグを広い範囲で受け取るためのイベントを置くためのdiv、biomeの無視は後で直す */}
			{/* biome-ignore lint: ドラッグとドロップの範囲の違いの表現のため */}
			<div className={styles.card} onDragOver={onDragOver} onDrop={onDrop}>
				{/* ドラッグハンドル */}
				{/* IconButtonにすると、ドラッグがうごかなくなる */}
				<button
					type="button"
					className={styles.dragHandle}
					draggable
					onDragStart={onDragStart}
				>
					<DragHandleDots2Icon />
				</button>

				<div className={styles.itemOperateButtons}>
					<IconButton variant="ghost">
						<CaretUpIcon />
					</IconButton>

					<IconButton variant="ghost">
						<CaretDownIcon />
					</IconButton>

					<IconButton variant="ghost" onClick={() => onRemove(item.id)}>
						<TrashIcon />
					</IconButton>
				</div>
				{/* 質問 */}
				<input
					className={styles.questionInput}
					value={item.label}
					onChange={e => onUpdate(item.id, { label: e.target.value })}
					placeholder={`質問 ${index + 1}`}
				/>

				{/* タイプ選択 */}
				{/* <select
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
			</select> */}
				<div className={styles.selectWrapper}>
					<Select.Root
						value={item.type}
						onValueChange={value =>
							onUpdate(item.id, { type: value as FormItem["type"] })
						}
						open={isOpen}
						onOpenChange={setIsOpen}
					>
						<Select.Trigger className={styles.trigger}>
							<div className={styles.triggerContent}>
								<span className={styles.icon}>{currentType?.icon}</span>
								{isOpen && (
									<span className={styles.label}>{currentType?.label}</span>
								)}
							</div>
						</Select.Trigger>

						<Select.Content
							position="popper"
							side="bottom"
							align="start"
							className={styles.content}
						>
							<Select.Group>
								{FIELD_TYPES.map(type => (
									<Select.Item key={type.value} value={type.value}>
										<div className={styles.itemContent}>
											<span className={styles.itemIcon}>{type.icon}</span>
											<span>{type.label}</span>
										</div>
									</Select.Item>
								))}
							</Select.Group>
						</Select.Content>
					</Select.Root>
				</div>

				{/* 解答欄 */}
				<AnswerFieldEditor
					item={item}
					onUpdate={(update: Partial<FormItem>) => onUpdate(item.id, update)}
				/>

				{/* フッター */}
				<div className={styles.footer}>
					<Switch
						label={"必須"}
						onCheckedChange={checked =>
							onUpdate(item.id, { required: checked })
						}
					/>
				</div>
			</div>
		</li>
	);
}
