import { Dialog, Text } from "@radix-ui/themes";
import { type Bureau, bureauLabelMap, type UserSummary } from "@sos26/shared";
import { IconX } from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";
import { UserSearchSelect } from "@/components/committee/UserSearchSelect";
import { Button, IconButton, Select } from "@/components/primitives";
import { isClientError } from "@/lib/http/error";
import styles from "./AddMemberDialog.module.scss";

const bureauOptions = (
	Object.entries(bureauLabelMap) as [Bureau, string][]
).map(([value, label]) => ({
	value,
	label,
}));

type AddMemberDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (body: {
		userId: string;
		Bureau: Bureau;
		isExecutive?: boolean;
	}) => Promise<unknown>;
	/** 既に実委人であるユーザーIDのリスト（検索結果から除外される） */
	excludeUserIds?: string[];
};

export function AddMemberDialog({
	open,
	onOpenChange,
	onSubmit,
	excludeUserIds,
}: AddMemberDialogProps) {
	const [selectedUsers, setSelectedUsers] = useState<UserSummary[]>([]);
	const [bureau, setBureau] = useState<Bureau | "">("");
	const [loading, setLoading] = useState(false);

	const handleClose = () => {
		onOpenChange(false);
		setSelectedUsers([]);
		setBureau("");
	};

	const handleSubmit = async () => {
		if (selectedUsers.length === 0) {
			toast.error("ユーザーを選択してください");
			return;
		}
		if (!bureau) {
			toast.error("所属局を選択してください");
			return;
		}

		setLoading(true);
		try {
			for (const user of selectedUsers) {
				await onSubmit({ userId: user.id, Bureau: bureau });
			}
			toast.success(
				selectedUsers.length === 1
					? "メンバーを追加しました"
					: `${selectedUsers.length}人のメンバーを追加しました`
			);
			handleClose();
		} catch (error) {
			toast.error(
				isClientError(error)
					? (error as Error).message
					: "メンバーの追加に失敗しました"
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Content maxWidth="480px">
				<div className={styles.header}>
					<Dialog.Title mb="0">メンバーを追加</Dialog.Title>
					<IconButton aria-label="閉じる" onClick={handleClose}>
						<IconX size={16} />
					</IconButton>
				</div>
				<Dialog.Description size="2" mb="4">
					ユーザーを検索して追加するメンバーと所属局を選択してください。
				</Dialog.Description>

				<div className={styles.form}>
					<UserSearchSelect
						label="ユーザー"
						selected={selectedUsers}
						onSelect={user => setSelectedUsers(prev => [...prev, user])}
						onRemove={userId =>
							setSelectedUsers(prev => prev.filter(u => u.id !== userId))
						}
						excludeIds={excludeUserIds}
						required
					/>

					<div className={styles.field}>
						<Text as="label" size="2" weight="medium">
							所属局 <span className={styles.required}>*</span>
						</Text>
						<Select
							options={bureauOptions}
							value={bureau}
							onValueChange={v => setBureau(v as Bureau)}
							placeholder="局を選択"
						/>
					</div>
				</div>

				<div className={styles.actions}>
					<Button intent="secondary" size="2" onClick={handleClose}>
						キャンセル
					</Button>
					<Button
						intent="primary"
						size="2"
						loading={loading}
						onClick={handleSubmit}
					>
						追加
					</Button>
				</div>
			</Dialog.Content>
		</Dialog.Root>
	);
}
