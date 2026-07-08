import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { IconGripVertical, IconTrash, IconZoomIn } from "@tabler/icons-react";
import { getFileContentUrl } from "@/lib/api/files";
import styles from "./route.module.scss";

type Props = {
	id: string;
	index: number;
	isEditable: boolean;
	onRemove: () => void;
	onPreview: () => void;
};

export function SortableMapImageItem({
	id,
	index,
	isEditable,
	onRemove,
	onPreview,
}: Props) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		zIndex: isDragging ? 10 : 0,
		opacity: isDragging ? 0.6 : 1,
	};

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={`${styles.mapImageCard} ${isDragging ? styles.mapImageCardDragging : ""}`}
		>
			{/* サムネイル（クリックでプレビュー） */}
			<button
				type="button"
				className={styles.mapImageThumb}
				onClick={onPreview}
				aria-label={`画像 ${index + 1} をプレビュー`}
			>
				<img
					src={getFileContentUrl(id)}
					alt={`Map ${index + 1}`}
					className={styles.mapImageImg}
				/>
				<span className={styles.mapImageOverlay}>
					<IconZoomIn size={24} color="white" />
				</span>
			</button>

			{/* ドラッグハンドル（左下） */}
			{isEditable && (
				<button
					type="button"
					{...attributes}
					{...listeners}
					className={styles.mapImageDragHandle}
					aria-label="ドラッグして並び替え"
				>
					<IconGripVertical size={16} />
				</button>
			)}

			{/* 削除ボタン（右上） */}
			{isEditable && (
				<button
					type="button"
					className={styles.mapImageDeleteBtn}
					onClick={e => {
						e.stopPropagation();
						onRemove();
					}}
					aria-label="画像を削除"
				>
					<IconTrash size={14} />
				</button>
			)}

			{/* 順番バッジ */}
			<span className={styles.mapImageBadge}>{index + 1}</span>
		</div>
	);
}
