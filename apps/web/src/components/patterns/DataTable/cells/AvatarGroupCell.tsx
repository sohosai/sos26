import { Popover, Text } from "@radix-ui/themes";
import type { CellContext, RowData } from "@tanstack/react-table";
import { UserAvatar } from "@/components/common/UserAvatar";
import styles from "./AvatarGroupCell.module.scss";

export type AvatarGroupItem = {
	id: string;
	name: string;
	avatarFileId?: string | null;
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
						<span key={user.id} className={styles.avatar}>
							<UserAvatar
								size={20}
								name={user.name}
								avatarFileId={user.avatarFileId}
							/>
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
						<div key={user.id} className={styles.popoverItem}>
							<UserAvatar
								size={20}
								name={user.name}
								avatarFileId={user.avatarFileId}
							/>
							<Text size="2">{user.name}</Text>
						</div>
					))}
				</div>
			</Popover.Content>
		</Popover.Root>
	);
}
