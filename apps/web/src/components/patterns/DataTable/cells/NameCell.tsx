import type { CellContext, RowData } from "@tanstack/react-table";
import Avatar from "boring-avatars";

export function NameCell<TData extends RowData>({
	getValue,
}: CellContext<TData, unknown>) {
	const name = getValue() as string;

	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: "8px",
				cursor: "default",
				userSelect: "none",
			}}
		>
			<Avatar size={20} name={name} variant="beam" />
			<span>{name}</span>
		</div>
	);
}
