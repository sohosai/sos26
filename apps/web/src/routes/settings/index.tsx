import { Card, Flex, Heading, Text } from "@radix-ui/themes";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/primitives";
import { enablePush } from "@/lib/api/push";
import { requireAuth } from "@/lib/auth";
import {
	disablePushByPreference,
	ensurePushPermission,
	getPushEnabledPreference,
	getSubscribedFlag,
	isPushSupported,
	setPushEnabledPreference,
	setSubscribedFlag,
} from "@/lib/push";
import styles from "./index.module.scss";

export const Route = createFileRoute("/settings/")({
	beforeLoad: async ({ location }) => {
		await requireAuth(location.pathname);
	},
	component: SettingsPage,
});

function SettingsPage() {
	const [pushEnabled, setPushEnabled] = useState(getPushEnabledPreference());

	useEffect(() => {
		setPushEnabled(getPushEnabledPreference());
	}, []);

	const handleTogglePush = async (checked: boolean) => {
		if (!isPushSupported()) {
			toast.error("このブラウザはPush通知に対応していません");
			return;
		}

		if (!checked) {
			disablePushByPreference();
			setPushEnabled(false);
			toast.success("Push通知を無効にしました（仮設定）");
			return;
		}

		try {
			setPushEnabledPreference(true);

			const permission = await ensurePushPermission();
			if (permission !== "granted") {
				if (permission === "denied") {
					setPushEnabledPreference(false);
					toast.error("通知が拒否されています");
				}
				setPushEnabled(false);
				return;
			}

			if (!getSubscribedFlag()) {
				await enablePush();
				setSubscribedFlag(true);
			}

			setPushEnabled(true);
			toast.success("Push通知を有効化しました");
		} catch (error) {
			console.error(error);
			setPushEnabled(false);
			toast.error("Push通知の有効化に失敗しました");
		}
	};

	return (
		<div className={styles.container}>
			<Heading size="7">設定</Heading>
			<Text color="gray">通知関連の設定（仮）です。</Text>

			<Card className={styles.card}>
				<Flex justify="between" align="center" gap="4">
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
