import {
	DragDropContext,
	Draggable,
	Droppable,
	type DropResult,
} from "@hello-pangea/dnd";
import { Badge, Dialog, Text, VisuallyHidden } from "@radix-ui/themes";
import { IconGripVertical, IconX } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { Button, IconButton } from "@/components/primitives";
import {
	PROJECT_LOCATION_LABELS,
	PROJECT_TYPE_LABELS,
} from "./projectRegistrationLabels";
import styles from "./ReorderFormsDialog.module.scss";

const PLACEHOLDER_ID = "__placeholder__";

type FormPreview = {
	id: string;
	title: string;
	filterTypes: string[];
	filterLocations: string[];
};

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	activeForms: FormPreview[];
	newFormTitle: string;
	initialSortOrder: number;
	onConfirm: (sortOrder: number) => void;
};

export function ReorderFormsDialog({
	open,
	onOpenChange,
	activeForms,
	newFormTitle,
	initialSortOrder,
	onConfirm,
}: Props) {
	const [orderedForms, setOrderedForms] = useState<FormPreview[]>([]);

	useEffect(() => {
		if (open) {
			const placeholder: FormPreview = {
				id: PLACEHOLDER_ID,
				title: newFormTitle || "新しいフォーム",
				filterTypes: [],
				filterLocations: [],
			};
			const list = [...activeForms];
			const pos = Math.min(Math.max(initialSortOrder, 0), list.length);
			list.splice(pos, 0, placeholder);
			setOrderedForms(list);
		}
	}, [open, activeForms, newFormTitle, initialSortOrder]);

	const handleDragEnd = (result: DropResult) => {
		if (!result.destination) return;
		if (result.destination.index === result.source.index) return;

		const next = [...orderedForms];
		const [moved] = next.splice(result.source.index, 1);
		if (moved) next.splice(result.destination.index, 0, moved);
		setOrderedForms(next);
	};

	const handleConfirm = () => {
		const pos = orderedForms.findIndex(f => f.id === PLACEHOLDER_ID);
		onConfirm(pos >= 0 ? pos : 0);
		onOpenChange(false);
	};

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Content className={styles.dialogContent}>
				<VisuallyHidden>
					<Dialog.Title>表示位置を選択</Dialog.Title>
				</VisuallyHidden>
				<div className={styles.dialogHeader}>
					<Text size="5" weight="bold">
						表示位置を選択
					</Text>
					<IconButton aria-label="閉じる" onClick={() => onOpenChange(false)}>
						<IconX size={16} />
					</IconButton>
				</div>

				<div className={styles.dialogInner}>
					<Text size="2" color="gray">
						ドラッグして新しいフォームの表示位置を決めてください。
					</Text>
					<DragDropContext onDragEnd={handleDragEnd}>
						<Droppable droppableId="position-picker">
							{provided => (
								<ul
									className={styles.list}
									ref={provided.innerRef}
									{...provided.droppableProps}
								>
									{orderedForms.map((form, index) => {
										const isPlaceholder = form.id === PLACEHOLDER_ID;
										return (
											<Draggable
												key={form.id}
												draggableId={form.id}
												index={index}
											>
												{(provided, snapshot) => (
													<li
														ref={provided.innerRef}
														{...provided.draggableProps}
														className={`${styles.card} ${snapshot.isDragging ? styles.dragging : ""} ${isPlaceholder ? styles.placeholder : ""}`}
													>
														<span
															className={styles.dragHandle}
															{...provided.dragHandleProps}
														>
															<IconGripVertical size={16} />
														</span>
														<span className={styles.cardOrder}>
															{index + 1}
														</span>
														<span className={styles.cardTitle}>
															{form.title}
															{isPlaceholder && (
																<Badge
																	variant="soft"
																	color="orange"
																	size="1"
																	ml="1"
																>
																	新規
																</Badge>
															)}
														</span>
														<span className={styles.cardTags}>
															{form.filterTypes.length === 0 &&
															form.filterLocations.length === 0 ? (
																!isPlaceholder && (
																	<Badge variant="soft" color="gray" size="1">
																		全対象
																	</Badge>
																)
															) : (
																<>
																	{form.filterTypes.map(t => (
																		<Badge
																			key={t}
																			variant="soft"
																			color="blue"
																			size="1"
																		>
																			{PROJECT_TYPE_LABELS[t] ?? t}
																		</Badge>
																	))}
																	{form.filterLocations.map(l => (
																		<Badge
																			key={l}
																			variant="soft"
																			color="green"
																			size="1"
																		>
																			{PROJECT_LOCATION_LABELS[l] ?? l}
																		</Badge>
																	))}
																</>
															)}
														</span>
													</li>
												)}
											</Draggable>
										);
									})}
									{provided.placeholder}
								</ul>
							)}
						</Droppable>
					</DragDropContext>
				</div>

				<div className={styles.dialogFooter}>
					<Button intent="secondary" onClick={() => onOpenChange(false)}>
						キャンセル
					</Button>
					<Button onClick={handleConfirm}>この位置に決定</Button>
				</div>
			</Dialog.Content>
		</Dialog.Root>
	);
}
