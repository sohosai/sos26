import { Dialog, Popover, Text } from "@radix-ui/themes";
import { IconCopy, IconRefresh, IconX } from "@tabler/icons-react";
import { useRef, useState } from "react";
import { IconButton } from "@/components/primitives";
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
	const [inviteCode, setInviteCode] = useState(project?.inviteCode ?? "");
	const timerRef = useRef<number | null>(null);

	const isOwner = project?.ownerId === user?.id;

	if (!project) return null;

	const handleRegenerate = async () => {
		if (
			!confirm("招待コードを再生成しますか？現在のコードは無効になります。")
		) {
			return;
		}
		try {
			const res = await regenerateInviteCode(project.id);
			setInviteCode(res.inviteCode);
		} catch (e) {
			console.error(e);
			alert("招待コードの再生成に失敗しました");
		}
	};

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Content>
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
						<IconButton onClick={handleRegenerate}>
							<IconRefresh size={24} />
						</IconButton>
					)}
				</div>
			</Dialog.Content>
		</Dialog.Root>
	);
}
