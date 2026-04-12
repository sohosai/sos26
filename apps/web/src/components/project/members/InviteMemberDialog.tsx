import { AlertDialog, Dialog, Popover, Text } from "@radix-ui/themes";
import { IconCopy, IconRefresh, IconX } from "@tabler/icons-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button, IconButton } from "@/components/primitives";
import { regenerateInviteCode } from "@/lib/api/project";
import { useAuthStore } from "@/lib/auth";
import { useProject } from "@/lib/project/store";
import styles from "./InviteMemberDialog.module.scss";

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export function InviteMemberDialog({ open, onOpenChange }: Props) {
	const project = useProject();
	const { user } = useAuthStore();
	const [copied, setCopied] = useState(false);
	const [inviteCode, setInviteCode] = useState(project.inviteCode ?? "");
	const timerRef = useRef<number | null>(null);
	const [regenerateConfirmOpen, setRegenerateConfirmOpen] = useState(false);

	const isOwner = project.ownerId === user?.id;

	const handleRegenerate = async () => {
		try {
			const res = await regenerateInviteCode(project.id);
			setInviteCode(res.inviteCode);
			setRegenerateConfirmOpen(false);
		} catch {
			toast.error("企画参加コードの再生成に失敗しました");
		}
	};

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Content className={styles.dialogContent}>
				<Dialog.Title>メンバーを招待</Dialog.Title>
				<Dialog.Description>
					このコードを共有して、メンバーを招待できます
				</Dialog.Description>
				<div className={styles.closeButton}>
					<IconButton onClick={() => onOpenChange(false)}>
						<IconX size={16} />
					</IconButton>
				</div>
				<div className={styles.content}>
					<Text weight="bold" size="9" className={styles.inviteCode}>
						{inviteCode}
					</Text>
					<Popover.Root open={copied}>
						<Popover.Trigger>
							<IconButton
								onClick={() => {
									navigator.clipboard.writeText(inviteCode);

									setCopied(true);

									if (timerRef.current) {
										clearTimeout(timerRef.current);
									}

									timerRef.current = window.setTimeout(() => {
										setCopied(false);
									}, 2000);
								}}
							>
								<IconCopy size={24} />
							</IconButton>
						</Popover.Trigger>

						<Popover.Content side="top" align="center">
							<Text size="2">コピーしました</Text>
						</Popover.Content>
					</Popover.Root>
					{isOwner && (
						<IconButton onClick={() => setRegenerateConfirmOpen(true)}>
							<IconRefresh size={24} />
						</IconButton>
					)}
				</div>

				<AlertDialog.Root
					open={regenerateConfirmOpen}
					onOpenChange={setRegenerateConfirmOpen}
				>
					<AlertDialog.Content maxWidth="400px">
						<AlertDialog.Title>企画参加コードの再生成</AlertDialog.Title>
						<AlertDialog.Description size="2">
							企画参加コードを再生成しますか？現在のコードは無効になります。
						</AlertDialog.Description>
						<div
							style={{
								display: "flex",
								gap: "8px",
								justifyContent: "flex-end",
								marginTop: "16px",
							}}
						>
							<AlertDialog.Cancel>
								<Button intent="secondary" size="2">
									キャンセル
								</Button>
							</AlertDialog.Cancel>
							<Button intent="primary" size="2" onClick={handleRegenerate}>
								再生成する
							</Button>
						</div>
					</AlertDialog.Content>
				</AlertDialog.Root>
			</Dialog.Content>
		</Dialog.Root>
	);
}
