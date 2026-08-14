import { Callout, Card, Flex, Heading, Text } from "@radix-ui/themes";
import type { MapAppSetting, UpdateMapAppSettingRequest } from "@sos26/shared";
import { IconInfoCircle } from "@tabler/icons-react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/primitives";
import { getMyPermissions } from "@/lib/api/committee-member";
import {
	getMapAppSetting,
	updateMapAppSetting,
} from "@/lib/api/map-app-setting";
import { reportHandledError } from "@/lib/error/report";
import styles from "./route.module.scss";

export const Route = createFileRoute("/committee/map-settings")({
	loader: async () => {
		const [settingRes, permsRes] = await Promise.all([
			getMapAppSetting(),
			getMyPermissions(),
		]);
		return {
			setting: settingRes.setting,
			canEdit: permsRes.permissions.some(
				p => p.permission === "MAP_APP_SETTING_EDIT"
			),
		};
	},
	component: MapSettingsPage,
});

const SWITCHES: { key: keyof MapAppSetting; label: string }[] = [
	{ key: "isDescriptionEditable", label: "紹介文の編集" },
	{ key: "isIconEditable", label: "アイコン画像の編集" },
	{ key: "isMapImagesEditable", label: "Map掲載画像の編集" },
	{ key: "isOpenStatusEditable", label: "開店・閉店状態の編集" },
	{ key: "isStockStatusEditable", label: "在庫状態の編集" },
];

function MapSettingsPage() {
	const router = useRouter();
	const { setting: loadedSetting, canEdit } = Route.useLoaderData();
	const [setting, setSetting] = useState(loadedSetting);
	/** 保存中は全スイッチを無効化する（保存中の操作が無言で巻き戻るのを防ぐ） */
	const [isSaving, setIsSaving] = useState(false);

	useEffect(() => {
		setSetting(loadedSetting);
	}, [loadedSetting]);

	// スイッチ操作でそのまま反映する（変更した項目のみ送信し、他の管理者の変更を上書きしない）
	const handleToggle = async (key: keyof MapAppSetting, checked: boolean) => {
		const previous = setting[key];
		setSetting(prev => ({ ...prev, [key]: checked }));
		setIsSaving(true);

		try {
			const payload: UpdateMapAppSettingRequest = {};
			payload[key] = checked;
			await updateMapAppSetting(payload);
		} catch (error) {
			setSetting(prev => ({ ...prev, [key]: previous }));
			reportHandledError({
				error,
				operation: "update_map_setting",
				userMessage: "設定の保存に失敗しました。",
				ui: { type: "toast" },
			});
			return;
		} finally {
			setIsSaving(false);
		}

		toast.success("設定を保存しました");
		// 保存自体は成功しているため、再取得の失敗は保存失敗として扱わない
		void router.invalidate();
	};

	return (
		<div>
			<div className={styles.header}>
				<Heading size="6">雙峰祭オンラインマップ</Heading>
				<Text size="2" color="gray">
					企画側で編集できる項目を設定します。変更は即時反映されます。
				</Text>
			</div>

			{!canEdit && (
				<Callout.Root color="gray" className={styles.callout}>
					<Callout.Icon>
						<IconInfoCircle size={16} />
					</Callout.Icon>
					<Callout.Text>
						マップ設定変更権限がないため、閲覧のみ可能です。
					</Callout.Text>
				</Callout.Root>
			)}

			<Card className={styles.card}>
				<Flex direction="column" gap="4">
					{SWITCHES.map(({ key, label }) => (
						<Flex key={key} justify="between" align="center">
							<Switch
								label={label}
								checked={setting[key]}
								onCheckedChange={checked => void handleToggle(key, checked)}
								disabled={!canEdit || isSaving}
							/>
						</Flex>
					))}
				</Flex>
			</Card>
		</div>
	);
}
