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
	const selectOptions = column.columnDef.meta?.selectOptions;
	const resolvedOptions =
		selectOptions ?? options.map(o => ({ value: o, label: o }));

	if (!editable) {
		return <>{initialValue}</>;
	}

	return (
		<Select
			aria-label={column.id}
			variant="ghost"
			options={resolvedOptions}
			value={initialValue}
			onValueChange={val => {
				table.options.meta?.updateData(row.original, column.id, val);
			}}
		/>
	);
}
