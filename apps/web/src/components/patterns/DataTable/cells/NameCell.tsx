import type { CellContext, RowData } from "@tanstack/react-table";
import { UserAvatar } from "@/components/common/UserAvatar";
import styles from "./NameCell.module.scss";

export type NameCellValue = {
	name: string;
	avatarFileId?: string | null;
};

export function NameCell<TData extends RowData>({
	getValue,
}: CellContext<TData, unknown>) {
	const value = getValue() as NameCellValue | string;
	const name = typeof value === "string" ? value : value.name;
	const avatarFileId =
		typeof value === "string" ? null : (value.avatarFileId ?? null);

	return (
		<div className={styles.container}>
			<UserAvatar size={20} name={name} avatarFileId={avatarFileId} />
			<span>{name}</span>
		</div>
	);
}
