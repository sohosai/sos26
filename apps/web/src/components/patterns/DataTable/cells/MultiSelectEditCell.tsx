import { Badge, Popover, Text } from "@radix-ui/themes";
import type { CellContext, RowData } from "@tanstack/react-table";
import { useRef, useState } from "react";
import { Checkbox } from "@/components/primitives";
import styles from "./MultiSelectEditCell.module.scss";

export function MultiSelectEditCell<TData extends RowData>({
	getValue,
	row,
	column,
	table,
}: CellContext<TData, unknown>) {
	const ids = (getValue() as string[] | null | undefined) ?? [];
	const options = column.columnDef.meta?.selectOptions ?? [];
	const optionMap = new Map(options.map(o => [o.value, o.label]));
	const [open, setOpen] = useState(false);
	const [localIds, setLocalIds] = useState<string[]>([]);
	const escapedRef = useRef(false);

	const setsEqual = (a: string[], b: string[]) => {
		if (a.length !== b.length) return false;
		const setB = new Set(b);
		return a.every(v => setB.has(v));
	};

	const handleOpenChange = (isOpen: boolean) => {
		if (isOpen) {
			setLocalIds(ids);
			escapedRef.current = false;
		} else if (!escapedRef.current && !setsEqual(localIds, ids)) {
			table.options.meta?.updateData(row.original, column.id, localIds);
		}
		setOpen(isOpen);
	};

	const toggle = (id: string) => {
		setLocalIds(prev =>
			prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
		);
	};

	return (
		<Popover.Root open={open} onOpenChange={handleOpenChange}>
			<Popover.Trigger
				onClick={() => table.options.meta?.clearSelection?.()}
				className={styles.trigger}
			>
				{ids.length === 0 ? (
					<Text color="gray" size="2">
						─
					</Text>
				) : (
					<div className={styles.badges}>
						{ids.map(id => (
							<Badge key={id} variant="soft" size="1">
								{optionMap.get(id) ?? id}
							</Badge>
						))}
					</div>
				)}
			</Popover.Trigger>
			<Popover.Content
				onEscapeKeyDown={() => {
					escapedRef.current = true;
				}}
			>
				{options.length === 0 ? (
					<Text size="1" color="gray">
						選択肢がありません
					</Text>
				) : (
					<div className={styles.list}>
						{options.map(opt => (
							<Checkbox
								key={opt.value}
								size="1"
								label={opt.label}
								checked={localIds.includes(opt.value)}
								onCheckedChange={() => toggle(opt.value)}
							/>
						))}
					</div>
				)}
			</Popover.Content>
		</Popover.Root>
	);
}
