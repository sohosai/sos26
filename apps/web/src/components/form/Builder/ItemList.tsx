// FormItemList.tsx

import { useState } from "react";
import type { FormItem } from "../type";
import { FormItemEditor } from "./ItemEditor";

type Props = {
	items: FormItem[];
	setItems: (items: FormItem[]) => void;
	onUpdate: (id: string, update: Partial<FormItem>) => void;
	onRemove: (id: string) => void;
};

export function FormItemList({ items, setItems, onUpdate, onRemove }: Props) {
	const [dragIndex, setDragIndex] = useState<number | null>(null);

	const handleDragStart = (index: number) => {
		setDragIndex(index);
	};

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault(); // 必須
	};

	const handleDrop = (dropIndex: number) => {
		if (dragIndex === null || dragIndex === dropIndex) return;
		setItems(arrayMove(items, dragIndex, dropIndex));
		setDragIndex(null);
	};

	function arrayMove<T extends {}>(array: T[], from: number, to: number): T[] {
		const newArray = [...array];
		const [moved] = newArray.splice(from, 1);
		if (moved === undefined) return newArray;
		newArray.splice(to, 0, moved);
		return newArray;
	}

	return (
		<ul>
			{items.map((item, index) => (
				<FormItemEditor
					key={item.id}
					item={item}
					index={index}
					onUpdate={onUpdate}
					onRemove={onRemove}
					onDragStart={() => handleDragStart(index)}
					onDragOver={handleDragOver}
					onDrop={() => handleDrop(index)}
					isDragging={dragIndex === index}
				/>
			))}
		</ul>
	);
}
