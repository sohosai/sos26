import { DragDropContext, Droppable, type DropResult } from "@hello-pangea/dnd";
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
	function arrayMove<T extends {}>(array: T[], from: number, to: number): T[] {
		const newArray = [...array];
		const [moved] = newArray.splice(from, 1);
		if (moved === undefined) return newArray;
		newArray.splice(to, 0, moved);
		return newArray;
	}

	const moveUp = (index: number) => {
		if (index === 0) return;
		setItems(arrayMove(items, index, index - 1));
	};

	const moveDown = (index: number) => {
		if (index === items.length - 1) return;
		setItems(arrayMove(items, index, index + 1));
	};

	const handleDragEnd = (result: DropResult) => {
		if (!result.destination) return;
		if (result.destination.index === result.source.index) return;

		setItems(arrayMove(items, result.source.index, result.destination.index));
	};

	return (
		<DragDropContext onDragEnd={handleDragEnd}>
			<Droppable droppableId="form-items">
				{provided => (
					<ul
						className={styles.list}
						ref={provided.innerRef}
						{...provided.droppableProps}
					>
						{items.map((item, index) => (
							<FormItemEditor
								key={item.id}
								item={item}
								index={index}
								onUpdate={onUpdate}
								onRemove={onRemove}
								onMoveUp={() => moveUp(index)}
								onMoveDown={() => moveDown(index)}
								isFirst={index === 0}
								isLast={index === items.length - 1}
							/>
						))}
						{provided.placeholder}
					</ul>
				)}
			</Droppable>
		</DragDropContext>
	);
}
