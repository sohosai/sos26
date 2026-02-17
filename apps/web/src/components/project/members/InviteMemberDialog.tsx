import { Dialog } from "@radix-ui/themes";
import { useContext } from "react";
import { Button, TextField } from "@/components/primitives";
import { ProjectContext } from "@/lib/project/context";
import styles from "./InviteMemberDialog.module.scss";

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export function InviteMemberDialog({ open, onOpenChange }: Props) {
	const project = useContext(ProjectContext);

	if (!project) return null;

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Content>
				<Dialog.Title>メンバーを招待</Dialog.Title>
				<Dialog.Description>
					以下の招待コードを共有してください
				</Dialog.Description>
				<div className={styles.content}>
					<TextField value={project.inviteCode} disabled label={"招待コード"} />

					<Button
						intent="secondary"
						onClick={() => {
							navigator.clipboard.writeText(project.inviteCode);
						}}
					>
						コピー
					</Button>
				</div>
			</Dialog.Content>
		</Dialog.Root>
	);
}
