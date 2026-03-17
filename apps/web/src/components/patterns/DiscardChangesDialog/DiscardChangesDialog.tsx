import { AlertDialog } from "@radix-ui/themes";
import { Button } from "@/components/primitives";
import styles from "./DiscardChangesDialog.module.scss";

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
	title?: string;
	description?: string;
	cancelLabel?: string;
	confirmLabel?: string;
};

export function DiscardChangesDialog({
	open,
	onOpenChange,
	onConfirm,
	title = "入力内容を破棄しますか？",
	description = "保存していない入力内容は失われます。",
	cancelLabel = "戻る",
	confirmLabel = "破棄して閉じる",
}: Props) {
	return (
		<AlertDialog.Root open={open} onOpenChange={onOpenChange}>
			<AlertDialog.Content maxWidth="440px">
				<AlertDialog.Title>{title}</AlertDialog.Title>
				<AlertDialog.Description size="2">
					{description}
				</AlertDialog.Description>
				<div className={styles.actions}>
					<Button intent="secondary" onClick={() => onOpenChange(false)}>
						{cancelLabel}
					</Button>
					<Button intent="primary" onClick={onConfirm}>
						{confirmLabel}
					</Button>
				</div>
			</AlertDialog.Content>
		</AlertDialog.Root>
	);
}
