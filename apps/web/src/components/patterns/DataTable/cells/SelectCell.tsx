import { Select } from "@radix-ui/themes";
import type { CellContext, RowData } from "@tanstack/react-table";
import { useState } from "react";

export function SelectCell<TData extends RowData>({
	getValue,
	row,
	column,
	table,
}: CellContext<TData, unknown>) {
	const initialValue = getValue() as string;
	const [isFocused, setIsFocused] = useState(false);
	const editable = column.columnDef.meta?.editable ?? true;
	const options = column.columnDef.meta?.options ?? [];

	if (!editable) {
		return <>{initialValue}</>;
	}

	return (
		<Select.Root
			value={initialValue}
			onValueChange={val => {
				table.options.meta?.updateData(row.index, column.id, val);
			}}
			onOpenChange={open => setIsFocused(open)}
		>
			<Select.Trigger
				variant="ghost"
				style={{
					borderRadius: 0,
					cursor: "pointer",
					boxShadow: isFocused ? "inset 0 0 0 2px var(--accent-7)" : undefined,
				}}
			/>
			<Select.Content>
				{options.map(option => (
					<Select.Item key={option} value={option}>
						{option}
					</Select.Item>
				))}
			</Select.Content>
		</Select.Root>
	);
}
