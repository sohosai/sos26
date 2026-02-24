import { Popover, TextField as RadixTextField, Text } from "@radix-ui/themes";
import {
	IconCheck,
	IconChevronDown,
	IconSearch,
	IconX,
} from "@tabler/icons-react";
import Avatar from "boring-avatars";
import styles from "./NewInquiryForm.module.scss";

type UserSummary = { id: string; name: string };

export function MemberSelectPopover({
	open,
	onOpenChange,
	members,
	selected,
	searchQuery,
	onSearchChange,
	onToggle,
	triggerLabel,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	members: UserSummary[];
	selected: UserSummary[];
	searchQuery: string;
	onSearchChange: (q: string) => void;
	onToggle: (person: UserSummary) => void;
	triggerLabel: string;
}) {
	return (
		<Popover.Root open={open} onOpenChange={onOpenChange}>
			<Popover.Trigger>
				<button type="button" className={styles.assignTrigger}>
					<Text size="2" color="gray">
						{triggerLabel}
					</Text>
					<IconChevronDown size={16} />
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
						size="2"
						value={searchQuery}
						onChange={e => onSearchChange(e.target.value)}
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
							const isSelected = selected.some(p => p.id === person.id);
							return (
								<button
									key={person.id}
									type="button"
									className={`${styles.assignOption} ${isSelected ? styles.assignOptionSelected : ""}`}
									onClick={() => onToggle(person)}
								>
									<Avatar size={20} name={person.name} variant="beam" />
									<div className={styles.assignOptionText}>
										<Text size="2">{person.name}</Text>
									</div>
									{isSelected && (
										<IconCheck size={14} className={styles.assignOptionCheck} />
									)}
								</button>
							);
						})}
				</div>
			</Popover.Content>
		</Popover.Root>
	);
}

export function SelectedChips({
	items,
	onRemove,
}: {
	items: UserSummary[];
	onRemove: (person: UserSummary) => void;
}) {
	if (items.length === 0) return null;

	return (
		<div className={styles.assignChips}>
			{items.map(person => (
				<span key={person.id} className={styles.assignChip}>
					<Avatar size={16} name={person.name} variant="beam" />
					<Text size="1">{person.name}</Text>
					<button
						type="button"
						className={styles.assignChipRemove}
						onClick={() => onRemove(person)}
					>
						<IconX size={12} />
					</button>
				</span>
			))}
		</div>
	);
}
