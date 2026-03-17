import { Dialog, Text } from "@radix-ui/themes";
import { IconSend } from "@tabler/icons-react";
import Avatar from "boring-avatars";
import { useState } from "react";
import { toast } from "sonner";
import { Button, Select } from "@/components/primitives";
import { requestProjectRegistrationFormAuthorization } from "@/lib/api/committee-project-registration-form";
import styles from "./RequestAuthorizationDialog.module.scss";

type Approver = {
	userId: string;
	name: string;
};

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	formId: string;
	approvers: Approver[];
	onSuccess: () => void;
};

export function RequestAuthorizationDialog({
	open,
	onOpenChange,
	formId,
	approvers,
	onSuccess,
}: Props) {
	const [requestedToId, setRequestedToId] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const approverOptions = approvers.map(a => ({
		value: a.userId,
		label: a.name,
		icon: <Avatar size={16} name={a.name} variant="beam" />,
	}));

	const handleOpenChange = (o: boolean) => {
		onOpenChange(o);
		if (!o) {
			setRequestedToId("");
		}
	};

	const handleSubmit = async () => {
		if (!requestedToId) return;
		setIsSubmitting(true);
		try {
			await requestProjectRegistrationFormAuthorization(formId, {
				requestedToId,
			});
			handleOpenChange(false);
			onSuccess();
			toast.success("承認依頼を送信しました");
		} catch {
			toast.error("承認依頼の送信に失敗しました");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog.Root open={open} onOpenChange={handleOpenChange}>
			<Dialog.Content maxWidth="420px">
				<Dialog.Title>承認依頼</Dialog.Title>
				<Dialog.Description size="2" mb="4" color="gray">
					企画登録フォームの承認を依頼します。承認されると、即座に企画登録時に表示されるようになります。
				</Dialog.Description>

				<div className={styles.field}>
					<Text as="label" size="2" weight="medium">
						承認依頼先
					</Text>
					{approverOptions.length === 0 ? (
						<Text size="2" color="red">
							承認可能なメンバーがいません。PROJECT_REGISTRATION_FORM_DELIVER
							権限を持つメンバーを追加してください。
						</Text>
					) : (
						<Select
							options={approverOptions}
							value={requestedToId}
							onValueChange={setRequestedToId}
							placeholder="承認者を選択"
							size="2"
						/>
					)}
				</div>

				<div className={styles.actions}>
					<Button
						intent="secondary"
						size="2"
						onClick={() => handleOpenChange(false)}
						disabled={isSubmitting}
					>
						キャンセル
					</Button>
					<Button
						intent="primary"
						size="2"
						onClick={handleSubmit}
						loading={isSubmitting}
						disabled={!requestedToId}
					>
						<IconSend size={16} />
						申請を送信
					</Button>
				</div>
			</Dialog.Content>
		</Dialog.Root>
	);
}
