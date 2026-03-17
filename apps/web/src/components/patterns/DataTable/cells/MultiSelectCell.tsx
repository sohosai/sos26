import { Badge, Text } from "@radix-ui/themes";
import type { CellContext, RowData } from "@tanstack/react-table";
import styles from "./MultiSelectCell.module.scss";

export function MultiSelectCell<TData extends RowData>({
	getValue,
	column,
}: CellContext<TData, unknown>) {
	const ids = (getValue() as string[] | null | undefined) ?? [];
	const optionMap = new Map(
		(column.columnDef.meta?.selectOptions ?? []).map(o => [o.value, o.label])
	);

	if (ids.length === 0) {
		return (
			<Text color="gray" size="1">
				-
			</Text>
		);
	}

	return (
		<div className={styles.badges}>
			{ids.map(id => (
				<Badge key={id} variant="soft" color="blue" size="1">
					{optionMap.get(id) ?? id}
				</Badge>
			))}
		</div>
	);
}
