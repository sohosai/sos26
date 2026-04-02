import { Button, Dialog, Flex, Text, TextField } from "@radix-ui/themes";
import { useState } from "react";
import styles from "./ProjectJoinDialog.module.scss";

type ProjectJoinDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onJoin: (inviteCode: string) => Promise<void>;
};

export function ProjectJoinDialog({
	open,
	onOpenChange,
	onJoin,
}: ProjectJoinDialogProps) {
	const [inviteCode, setInviteCode] = useState("");
	const [loading, setLoading] = useState(false);

	const handleOpenChange = (newOpen: boolean) => {
		onOpenChange(newOpen);
		// ダイアログが閉じられた時に入力内容をリセット
		if (!newOpen) {
			setInviteCode("");
			setLoading(false);
		}
	};

	const handleSubmit = async () => {
		if (!inviteCode.trim()) return;

		setLoading(true);
		try {
			await onJoin(inviteCode.trim());
			// 成功時のみダイアログを閉じる
			onOpenChange(false);
		} finally {
			setLoading(false);
		}
	};

	return (
		<Dialog.Root open={open} onOpenChange={handleOpenChange}>
			<Dialog.Content className={styles.content}>
				<Dialog.Title>企画に参加</Dialog.Title>
				<Dialog.Description size="2">
					企画責任者から受け取った参加コードを入力してください。
				</Dialog.Description>

				<Flex direction="column" gap="3" mt="4">
					<Text as="label" size="2" mb="1" weight="medium">
						企画参加コード
					</Text>
					<TextField.Root
						placeholder="例: ABC123XYZ"
						value={inviteCode}
						onChange={e => setInviteCode(e.target.value)}
						onKeyDown={e => {
							if (e.key === "Enter" && !loading) {
								void handleSubmit();
							}
						}}
					/>
				</Flex>

				<Flex gap="3" mt="4" justify="end">
					<Dialog.Close>
						<Button variant="soft" color="gray" disabled={loading}>
							キャンセル
						</Button>
					</Dialog.Close>
					<Button onClick={handleSubmit} loading={loading} disabled={loading}>
						参加する
					</Button>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
}
