import {
	IconButton,
	Popover,
	TextField as RadixTextField,
	Text,
} from "@radix-ui/themes";
import {
	IconCheck,
	IconChevronDown,
	IconSearch,
	IconTrash,
} from "@tabler/icons-react";
import Avatar from "boring-avatars";
import { useState } from "react";
import styles from "./SupportDetail.module.scss";
import type { AssigneeInfo } from "./types";

export function AssigneePopover({
	members,
	assignees,
	side,
	onToggle,
}: {
	members: { id: string; name: string }[];
	assignees: AssigneeInfo[];
	side: "PROJECT" | "COMMITTEE";
	onToggle: (userId: string, side: "PROJECT" | "COMMITTEE") => void;
}) {
	const [open, setOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");

	return (
		<Popover.Root
			open={open}
			onOpenChange={o => {
				setOpen(o);
				if (!o) setSearchQuery("");
			}}
		>
			<Popover.Trigger>
				<button type="button" className={styles.assignTrigger}>
					<Text size="1" color="gray">
						担当者を変更...
					</Text>
					<IconChevronDown size={14} />
				</button>
			</Popover.Trigger>
			<Popover.Content
				className={styles.assignPopover}
				side="bottom"
				align="start"
			>
				<div className={styles.assignSearch}>
					<RadixTextField.Root
						placeholder="検索..."
						size="1"
						value={searchQuery}
						onChange={e => setSearchQuery(e.target.value)}
					>
						<RadixTextField.Slot>
							<IconSearch size={14} />
						</RadixTextField.Slot>
					</RadixTextField.Root>
				</div>
				<div className={styles.assignList}>
					{members
						.filter(person => {
							const q = searchQuery.toLowerCase();
							if (!q) return true;
							return person.name.toLowerCase().includes(q);
						})
						.map(person => {
							const isAssigned = assignees.some(a => a.user.id === person.id);
							return (
								<button
									key={person.id}
									type="button"
									className={`${styles.assignDropdownOption} ${isAssigned ? styles.assignDropdownOptionSelected : ""}`}
									onClick={() => {
										onToggle(person.id, side);
										setOpen(false);
									}}
								>
									<Avatar size={20} name={person.name} variant="beam" />
									<div className={styles.assignDropdownOptionText}>
										<Text size="2">{person.name}</Text>
									</div>
									{isAssigned && (
										<IconCheck
											size={14}
											className={styles.assignDropdownOptionCheck}
										/>
									)}
								</button>
							);
						})}
				</div>
			</Popover.Content>
		</Popover.Root>
	);
}

export function AssigneeList({
	assignees,
	variant,
	canEdit,
	onRemove,
}: {
	assignees: AssigneeInfo[];
	variant: "project" | "committee";
	canEdit: boolean;
	onRemove: (assigneeId: string, userId: string) => void;
}) {
	if (assignees.length === 0) {
		return (
			<Text size="1" color="red">
				未設定
			</Text>
		);
	}

	return (
		<div className={styles.assigneeList}>
			{assignees.map(a => (
				<div key={a.id} className={styles.assigneeItem}>
					<span className={styles.sidebarAvatar} data-variant={variant}>
						<Avatar size={20} name={a.user.name} variant="beam" />
					</span>
					<div>
						<Text size="2">{a.user.name}</Text>
					</div>
					{canEdit && !a.isCreator && (
						<IconButton
							variant="ghost"
							size="1"
							color="red"
							onClick={() => onRemove(a.id, a.user.id)}
						>
							<IconTrash size={12} />
						</IconButton>
					)}
				</div>
			))}
		</div>
	);
}
