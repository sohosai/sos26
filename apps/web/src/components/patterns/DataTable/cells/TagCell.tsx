import type { BadgeProps } from "@radix-ui/themes";
import { Badge } from "@radix-ui/themes";
import type { CellContext, RowData } from "@tanstack/react-table";
import styles from "./TagCell.module.scss";

export function TagCell<TData extends RowData>({
	getValue,
	column,
}: CellContext<TData, unknown>) {
	const tags = getValue() as string[];
	const tagColors = column.columnDef.meta?.tagColors;

	return (
		<div className={styles.container}>
			{tags.map(tag => (
				<Badge
					key={tag}
					variant="soft"
					color={(tagColors?.[tag] ?? "gray") as BadgeProps["color"]}
				>
					{tag}
				</Badge>
			))}
		</div>
	);
}
