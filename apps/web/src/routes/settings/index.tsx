import { Card, Flex, Heading, Text } from "@radix-ui/themes";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Switch } from "@/components/primitives";
import { requireAuth } from "@/lib/auth";
import {
	disablePushByPreference,
	enablePushByPreference,
	getPushEnabledPreference,
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
		if (!checked) {
			await disablePushByPreference();
			setPushEnabled(false);
		} else {
			if (await enablePushByPreference()) {
				setPushEnabled(true);
			}
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
