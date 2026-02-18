import { Popover, Text } from "@radix-ui/themes";
import type { CellContext, RowData } from "@tanstack/react-table";
import Avatar from "boring-avatars";
import styles from "./AvatarGroupCell.module.scss";

export type AvatarGroupItem = {
	name: string;
};

const MAX_VISIBLE = 3;

export function AvatarGroupCell<TData extends RowData>({
	getValue,
}: CellContext<TData, unknown>) {
	const users = (getValue() as AvatarGroupItem[] | undefined) ?? [];

	if (users.length === 0) {
		return <div className={styles.container}>—</div>;
	}

	const visible = users.length <= MAX_VISIBLE ? users : users.slice(0, 2);
	const remaining = users.length - visible.length;

	return (
		<Popover.Root>
			<Popover.Trigger>
				<button type="button" className={styles.trigger}>
					{visible.map(user => (
						<span key={user.name} className={styles.avatar}>
							<Avatar size={20} name={user.name} variant="beam" />
						</span>
					))}
					{remaining > 0 && (
						<span className={styles.moreButton}>+{remaining}</span>
					)}
				</button>
			</Popover.Trigger>
			<Popover.Content side="bottom" align="start" sideOffset={4}>
				<div className={styles.popoverList}>
					{users.map(user => (
						<div key={user.name} className={styles.popoverItem}>
							<Avatar size={20} name={user.name} variant="beam" />
							<Text size="2">{user.name}</Text>
						</div>
					))}
				</div>
			</Popover.Content>
		</Popover.Root>
	);
}
