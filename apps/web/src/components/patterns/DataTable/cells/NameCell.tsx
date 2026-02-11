import type { CellContext, RowData } from "@tanstack/react-table";
import Avatar from "boring-avatars";
import styles from "./NameCell.module.scss";

export function NameCell<TData extends RowData>({
	getValue,
}: CellContext<TData, unknown>) {
	const name = getValue() as string;

	return (
		<div className={styles.container}>
			<Avatar size={20} name={name} variant="beam" />
			<span>{name}</span>
		</div>
	);
}
