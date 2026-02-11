import { useState } from "react";
import type { FormItem } from "../type";
import { FormItemEditor } from "./ItemEditor";
import styles from "./ItemList.module.scss";

type Props = {
	items: FormItem[];
	setItems: (items: FormItem[]) => void;
	onUpdate: (id: string, update: Partial<FormItem>) => void;
	onRemove: (id: string) => void;
};

export function FormItemList({ items, setItems, onUpdate, onRemove }: Props) {
	const [dragIndex, setDragIndex] = useState<number | null>(null);
	const [overIndex, setOverIndex] = useState<number | null>(null);

	const handleDragStart = (index: number) => {
		setDragIndex(index);
	};

	const handleDragOver = (index: number) => (e: React.DragEvent) => {
		e.preventDefault();
		setOverIndex(index);
	};

	const handleDrop = (dropIndex: number) => {
		if (dragIndex === null || dragIndex === dropIndex) return;
		setItems(arrayMove(items, dragIndex, dropIndex));
		setDragIndex(null);
		setOverIndex(null);
	};

	function arrayMove<T extends {}>(array: T[], from: number, to: number): T[] {
		const newArray = [...array];
		const [moved] = newArray.splice(from, 1);
		if (moved === undefined) return newArray;
		newArray.splice(to, 0, moved);
		return newArray;
	}

	return (
		<ul className={styles.list}>
			{items.map((item, index) => (
				<FormItemEditor
					key={item.id}
					item={item}
					index={index}
					onUpdate={onUpdate}
					onRemove={onRemove}
					onDragStart={() => handleDragStart(index)}
					onDragOver={handleDragOver(index)}
					onDrop={() => handleDrop(index)}
					isDragging={dragIndex === index}
					isDragOver={overIndex === index && dragIndex !== index}
				/>
			))}
		</ul>
	);
}
