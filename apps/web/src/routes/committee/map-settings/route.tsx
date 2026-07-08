import { Card, Flex, Heading, Text } from "@radix-ui/themes";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/primitives";
import {
	getMapAppSetting,
	updateMapAppSetting,
} from "@/lib/api/map-app-setting";
import { reportHandledError } from "@/lib/error/report";
import styles from "./route.module.scss";

export const Route = createFileRoute("/committee/map-settings")({
	loader: async () => {
		const res = await getMapAppSetting();
		return res.setting;
	},
	component: MapSettingsPage,
});

function MapSettingsPage() {
	const initialSetting = Route.useLoaderData();
	const [setting, setSetting] = useState(initialSetting);

	const handleToggle = async (key: keyof typeof setting, checked: boolean) => {
		const originalValue = setting[key];
		try {
			setSetting(prev => ({ ...prev, [key]: checked }));
			await updateMapAppSetting({ [key]: checked });
			toast.success("設定を保存しました", {
				description: "マップアプリの設定が更新されました。",
			});
		} catch (error) {
			setSetting(prev => ({ ...prev, [key]: originalValue }));
			reportHandledError({
				error,
				operation: "update_map_setting",
				userMessage: "設定の保存に失敗しました。",
				ui: { type: "toast" },
			});
		}
	};

	const switches = [
		{ key: "isDescriptionEditable", label: "紹介文の編集" },
		{ key: "isIconEditable", label: "アイコン画像の編集" },
		{ key: "isMapImagesEditable", label: "Map掲載画像の編集" },
		{ key: "isOpenStatusEditable", label: "開店・閉店状態の編集" },
		{ key: "isStockStatusEditable", label: "在庫状態の編集" },
	] as const;

	return (
		<div className={styles.page}>
			<div className={styles.header}>
				<Heading size="6">マップ設定</Heading>
				<Text size="2" color="gray">
					雙峰祭オンラインマップに公開する企画情報の編集可否を設定します。編集を無効にすると、企画側の画面で該当項目が編集できなくなります。
				</Text>
			</div>

			<Card className={styles.card}>
				<Flex direction="column" gap="4">
					{switches.map(({ key, label }) => (
						<Flex
							key={key}
							justify="between"
							align="center"
							className={styles.settingRow}
						>
							<div className={styles.settingLabel}>
								<Heading size="4">{label}</Heading>
							</div>
							<div className={styles.settingControl}>
								<Switch
									label={label}
									checked={setting[key]}
									onCheckedChange={checked => handleToggle(key, checked)}
								/>
							</div>
						</Flex>
					))}
				</Flex>
			</Card>
		</div>
	);
}
