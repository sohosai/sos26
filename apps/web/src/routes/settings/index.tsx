import { Card, Flex, Heading, Text } from "@radix-ui/themes";
import { IconUpload } from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/common/UserAvatar";
import { Button, Switch } from "@/components/primitives";
import { uploadFile } from "@/lib/api/files";
import { getUserSettings, updateUserSettings } from "@/lib/api/user";
import { useAuthStore } from "@/lib/auth";
import {
	disablePushByPreference,
	enablePushByPreference,
	getPushEnabledPreference,
} from "@/lib/push";
import styles from "./index.module.scss";

export const Route = createFileRoute("/settings/")({
	component: SettingsPage,
});

function SettingsPage() {
	const { user, refreshUser } = useAuthStore();
	const [pushEnabled, setPushEnabled] = useState(getPushEnabledPreference());
	const [avatarFileId, setAvatarFileId] = useState<string | null>(null);
	// TODO: 送信キー機能が実装されたら有効化する
	// const [sendKey, setSendKey] = useState<SendKey>("ENTER");
	const [isUploading, setIsUploading] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		setPushEnabled(getPushEnabledPreference());
	}, []);

	useEffect(() => {
		async function loadSettings() {
			try {
				const settings = await getUserSettings();
				setAvatarFileId(settings.avatarFileId);
				// TODO: 送信キー機能が実装されたら有効化する
				// setSendKey(settings.sendKey);
			} catch {
				// デフォルト値で継続
			}
		}
		loadSettings();
	}, []);

	const handleTogglePush = async (checked: boolean) => {
		if (!checked) {
			await disablePushByPreference();
			setPushEnabled(false);
		} else {
			if (await enablePushByPreference()) {
				setPushEnabled(true);
			}
		}
	};

	const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		// 画像ファイル以外は拒否
		if (!file.type.startsWith("image/")) {
			toast.error("画像ファイルを選択してください");
			return;
		}

		setIsUploading(true);
		try {
			const result = await uploadFile(file, { isPublic: true });
			await updateUserSettings({ avatarFileId: result.file.id });
			setAvatarFileId(result.file.id);
			await refreshUser();
			toast.success("アイコンを更新しました");
		} catch {
			toast.error("アイコンのアップロードに失敗しました");
		} finally {
			setIsUploading(false);
			// input をリセット
			if (fileInputRef.current) {
				fileInputRef.current.value = "";
			}
		}
	};

	// TODO: 送信キー機能が実装されたら有効化する
	// const handleSendKeyChange = async (value: string) => {
	// 	const newSendKey = value as SendKey;
	// 	try {
	// 		await updateUserSettings({ sendKey: newSendKey });
	// 		setSendKey(newSendKey);
	// 		toast.success("送信キー設定を更新しました");
	// 	} catch {
	// 		toast.error("設定の更新に失敗しました");
	// 	}
	// };

	return (
		<div className={styles.page}>
			<div className={styles.header}>
				<Heading size="6">設定</Heading>
				<Text size="2" color="gray">
					アカウントやアプリの設定を管理できます。
				</Text>
			</div>

			{/* アイコン設定 */}
			<Card className={styles.card}>
				<Flex direction="column" gap="3">
					<Heading size="4">アイコン</Heading>
					<Text color="gray" size="2">
						プロフィールに表示されるアイコンを設定します
					</Text>
					<Flex align="center" gap="4" className={styles.settingRow}>
						<div className={styles.avatarContainer}>
							<UserAvatar
								size={96}
								name={user?.name ?? ""}
								avatarFileId={avatarFileId}
							/>
						</div>
						<Flex direction="column" gap="2">
							<input
								ref={fileInputRef}
								type="file"
								accept="image/jpeg,image/png,image/gif,image/webp"
								onChange={handleAvatarUpload}
								className={styles.fileInput}
							/>
							<Button
								onClick={() => fileInputRef.current?.click()}
								disabled={isUploading}
							>
								<IconUpload size={16} />
								{isUploading ? "アップロード中..." : "画像をアップロード"}
							</Button>
						</Flex>
					</Flex>
				</Flex>
			</Card>

			{/* TODO: 送信キー機能が実装されたら有効化する */}
			{/* 送信キー設定 */}
			{/* <Card className={styles.card}>
				<Flex justify="between" align="center" gap="4">
					<div className={styles.settingLabel}>
						<Heading size="4">送信キー</Heading>
						<Text color="gray" size="2">
							メッセージの送信と改行に使用するキーを設定します
						</Text>
					</div>
					<div className={styles.settingControl}>
						<Select
							options={[
								{ value: "ENTER", label: "Enter で送信" },
								{ value: "CTRL_ENTER", label: "Ctrl+Enter で送信" },
							]}
							value={sendKey}
							onValueChange={handleSendKeyChange}
							aria-label="送信キー設定"
						/>
					</div>
				</Flex>
			</Card> */}

			{/* Push通知設定 */}
			<Card className={styles.card}>
				<Flex
					justify="between"
					align="center"
					gap="4"
					className={styles.settingRow}
				>
					<div>
						<Heading size="4">Push通知</Heading>
						<Text color="gray" size="2">
							アプリを開いたときの通知許可・通知受信設定
						</Text>
					</div>
					<Switch
						label="Push通知を受け取る"
						checked={pushEnabled}
						onCheckedChange={handleTogglePush}
					/>
				</Flex>
			</Card>
		</div>
	);
}
