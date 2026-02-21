import { Dialog, TextField as RadixTextField, Text } from "@radix-ui/themes";
import { IconPlus, IconSearch, IconX } from "@tabler/icons-react";
import Avatar from "boring-avatars";
import { useMemo, useState } from "react";
import { Button, IconButton } from "@/components/primitives";
import styles from "./AddCollaboratorDialog.module.scss";

type Member = {
	userId: string;
	name: string;
};

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	availableMembers: Member[];
	onAdd: (userId: string) => Promise<void>;
};

export function AddCollaboratorDialog({
	open,
	onOpenChange,
	availableMembers,
	onAdd,
}: Props) {
	const [query, setQuery] = useState("");
	const [addingId, setAddingId] = useState<string | null>(null);

	const filtered = useMemo(() => {
		if (!query) return availableMembers;
		const q = query.toLowerCase();
		return availableMembers.filter(m => m.name.toLowerCase().includes(q));
	}, [availableMembers, query]);

	const handleAdd = async (userId: string) => {
		setAddingId(userId);
		try {
			await onAdd(userId);
		} finally {
			setAddingId(null);
		}
	};

	return (
		<Dialog.Root
			open={open}
			onOpenChange={o => {
				onOpenChange(o);
				if (!o) setQuery("");
			}}
		>
			<Dialog.Content maxWidth="480px">
				<div className={styles.header}>
					<Dialog.Title mb="0">共同編集者を追加</Dialog.Title>
					<IconButton aria-label="閉じる" onClick={() => onOpenChange(false)}>
						<IconX size={16} />
					</IconButton>
				</div>
				<Dialog.Description size="2" mb="4" color="gray">
					一覧からメンバーを選択して追加できます。
				</Dialog.Description>

				<div className={styles.search}>
					<RadixTextField.Root
						placeholder="名前で検索..."
						aria-label="名前で検索"
						size="2"
						value={query}
						onChange={e => setQuery(e.target.value)}
					>
						<RadixTextField.Slot>
							<IconSearch size={16} />
						</RadixTextField.Slot>
					</RadixTextField.Root>
				</div>

				<div className={styles.list}>
					{filtered.length === 0 ? (
						<Text size="2" color="gray" className={styles.empty}>
							{query
								? "該当するメンバーが見つかりません"
								: "追加可能なメンバーがいません"}
						</Text>
					) : (
						filtered.map(m => (
							<div key={m.userId} className={styles.memberRow}>
								<Avatar size={28} name={m.name} variant="beam" />
								<Text size="2" className={styles.memberName}>
									{m.name}
								</Text>
								<Button
									intent="secondary"
									size="1"
									onClick={() => handleAdd(m.userId)}
									loading={addingId === m.userId}
									disabled={addingId !== null}
								>
									<IconPlus size={14} />
									追加
								</Button>
							</div>
						))
					)}
				</div>
			</Dialog.Content>
		</Dialog.Root>
	);
}
