import { Button, Card, Flex, Heading, Text } from "@radix-ui/themes";
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

function MapSettingsPage() {
	const router = useRouter();
	const { setting: initialSetting, canEdit } = Route.useLoaderData();
	const [setting, setSetting] = useState(initialSetting);
	const [isSaving, setIsSaving] = useState(false);

	useEffect(() => {
		setSetting(initialSetting);
	}, [initialSetting]);

	const isUnsaved = Object.keys(initialSetting).some(
		key =>
			setting[key as keyof typeof setting] !==
			initialSetting[key as keyof typeof initialSetting]
	);

	const handleToggle = (key: keyof typeof setting, checked: boolean) => {
		setSetting(prev => ({ ...prev, [key]: checked }));
	};

	const handleSave = async () => {
		setIsSaving(true);
		try {
			await updateMapAppSetting({
				isDescriptionEditable: setting.isDescriptionEditable,
				isIconEditable: setting.isIconEditable,
				isMapImagesEditable: setting.isMapImagesEditable,
				isOpenStatusEditable: setting.isOpenStatusEditable,
				isStockStatusEditable: setting.isStockStatusEditable,
			});
			toast.success("設定を保存しました", {
				description: "マップアプリの設定が更新されました。",
			});
			await router.invalidate();
		} catch (error) {
			reportHandledError({
				error,
				operation: "update_map_setting",
				userMessage: "設定の保存に失敗しました。",
				ui: { type: "toast" },
			});
		} finally {
			setIsSaving(false);
		}
	};

	const switches = [
		{
			key: "isDescriptionEditable",
			label: "紹介文の編集",
			desc: "企画紹介文の編集を許可します",
		},
		{
			key: "isIconEditable",
			label: "アイコン画像の編集",
			desc: "アイコン画像の変更を許可します",
		},
		{
			key: "isMapImagesEditable",
			label: "Map掲載画像の編集",
			desc: "Map掲載用画像の追加・削除を許可します",
		},
		{
			key: "isOpenStatusEditable",
			label: "開店・閉店状態の編集",
			desc: "当日の営業状態の変更を許可します",
		},
		{
			key: "isStockStatusEditable",
			label: "在庫状態の編集",
			desc: "商品の在庫状態の変更を許可します",
		},
	] as const;

	return (
		<div className={styles.page}>
			<header className={styles.header}>
				<div>
					<Heading size="6">雙峰祭オンラインマップ設定</Heading>
					<Text size="2" color="gray">
						マップアプリから企画情報の編集を許可するかどうかを一括で設定できます。
					</Text>
				</div>
				{!canEdit && (
					<Text size="2" color="amber" weight="bold">
						※ マップ設定変更権限がありません
					</Text>
				)}
			</header>

			<Card className={styles.card}>
				<Flex direction="column" gap="5">
					{switches.map(({ key, label, desc }) => (
						<Flex
							key={key}
							justify="between"
							align="center"
							className={styles.settingRow}
						>
							<div className={styles.settingLabel}>
								<Heading size="4" mb="1">
									{label}
								</Heading>
								<Text size="2" color="gray">
									{desc}
								</Text>
							</div>
							<div className={styles.settingControl}>
								<Switch
									label={label}
									checked={setting[key] as boolean}
									onCheckedChange={checked => handleToggle(key, checked)}
									disabled={!canEdit}
								/>
							</div>
						</Flex>
					))}
				</Flex>
			</Card>

			<div style={{ maxWidth: 720, marginTop: "24px" }}>
				{canEdit && (
					<Flex justify="end" align="center" gap="4">
						{isUnsaved && (
							<Text size="2" color="amber" weight="bold">
								未保存の変更があります
							</Text>
						)}
						<Button
							size="3"
							onClick={handleSave}
							disabled={isSaving || !isUnsaved}
						>
							保存する
						</Button>
					</Flex>
				)}
			</div>
		</div>
	);
}
