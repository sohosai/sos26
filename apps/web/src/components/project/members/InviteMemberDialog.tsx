import { Dialog, Popover, Text } from "@radix-ui/themes";
import { IconCopy, IconX } from "@tabler/icons-react";
import { useContext, useRef, useState } from "react";
import { IconButton } from "@/components/primitives";
import { ProjectContext } from "@/lib/project/context";
import styles from "./InviteMemberDialog.module.scss";

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export function InviteMemberDialog({ open, onOpenChange }: Props) {
	const project = useContext(ProjectContext);
	const [copied, setCopied] = useState(false);
	const timerRef = useRef<number | null>(null);

	if (!project) return null;

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
						{project.inviteCode}
					</Text>
					<Popover.Root open={copied}>
						<Popover.Trigger>
							<IconButton
								onClick={() => {
									navigator.clipboard.writeText(project.inviteCode);

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
				</div>
			</Dialog.Content>
		</Dialog.Root>
	);
}
