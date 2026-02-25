import { Popover } from "@radix-ui/themes";
import { IconDotsVertical } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { Button } from "@/components/primitives";
import styles from "./ActionMenu.module.scss";

export type ActionItem<T> = {
	key: string;
	label: string;
	icon?: ReactNode;
	disabled?: boolean;
	hidden?: boolean;
	onClick: (item: T) => void | Promise<void>;
};

type ActionsMenuProps<T> = {
	item: T;
	actions: ActionItem<T>[];
};

export function ActionsMenu<T>({ item, actions }: ActionsMenuProps<T>) {
	const visibleActions = actions.filter(a => !a.hidden);

	if (visibleActions.length === 0) return null;

	return (
		<Popover.Root>
			<Popover.Trigger>
				{/* 色を表の中身で揃えたいため、<IconButton>は使わない */}
				<button type="button" className={styles.trigger}>
					<IconDotsVertical size={16} />
				</button>
			</Popover.Trigger>

			<Popover.Content align="start" sideOffset={4}>
				<div className={styles.menu}>
					{visibleActions.map(action => (
						<Button
							key={action.key}
							intent="ghost"
							size="2"
							disabled={action.disabled}
							onClick={() => action.onClick(item)}
						>
							{action.icon}
							{action.label}
						</Button>
					))}
				</div>
			</Popover.Content>
		</Popover.Root>
	);
}
