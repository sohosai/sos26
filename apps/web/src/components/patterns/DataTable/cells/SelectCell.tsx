import type { CellContext, RowData } from "@tanstack/react-table";
import { Select } from "@/components/primitives";

export function SelectCell<TData extends RowData>({
	getValue,
	row,
	column,
	table,
}: CellContext<TData, unknown>) {
	const initialValue = getValue() as string;
	const editable = column.columnDef.meta?.editable ?? false;
	const options = column.columnDef.meta?.options ?? [];

	if (!editable) {
		return <>{initialValue}</>;
	}

	return (
		<Select
			aria-label={column.id}
			variant="ghost"
			options={options.map(o => ({ value: o, label: o }))}
			value={initialValue}
			onValueChange={val => {
				table.options.meta?.updateData(row.index, column.id, val);
			}}
		/>
	);
}
