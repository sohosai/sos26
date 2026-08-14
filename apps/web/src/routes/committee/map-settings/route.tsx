import { Card, Flex, Heading, Text } from "@radix-ui/themes";
import type { MapAppSetting, UpdateMapAppSettingRequest } from "@sos26/shared";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/primitives";
import {
	getMapAppSetting,
	updateMapAppSetting,
} from "@/lib/api/map-app-setting";
import { ForbiddenError, useAuthStore } from "@/lib/auth";
import { reportHandledError } from "@/lib/error/report";
import styles from "./route.module.scss";

export const Route = createFileRoute("/committee/map-settings")({
	// サイドバーでも非表示にしている画面なので、URL直打ちでも同じ扱いにする。
	// 権限は GET /auth/me で取得済みのため再取得しない。
	beforeLoad: () => {
		const { permissions } = useAuthStore.getState();
		if (!permissions?.has("MAP_APP_SETTING_EDIT")) {
			throw new ForbiddenError();
		}
	},
	loader: async () => {
		const { setting } = await getMapAppSetting();
		return { setting };
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
	const { setting: loadedSetting } = Route.useLoaderData();
	const [setting, setSetting] = useState(loadedSetting);
	/**
	 * 保存中のスイッチ。操作中のものだけを無効化する。
	 * 全スイッチを無効化すると、Radix の disabled スタイルで
	 * ON のスイッチまで灰色になり、一斉に OFF になったように見えるため。
	 */
	const [savingKeys, setSavingKeys] = useState<
		ReadonlySet<keyof MapAppSetting>
	>(new Set());

	const setSaving = (key: keyof MapAppSetting, saving: boolean) => {
		setSavingKeys(prev => {
			const next = new Set(prev);
			if (saving) {
				next.add(key);
			} else {
				next.delete(key);
			}
			return next;
		});
	};

	// スイッチ操作でそのまま反映する（変更した項目のみ送信し、他の管理者の変更を上書きしない）
	const handleToggle = async (key: keyof MapAppSetting, checked: boolean) => {
		const previous = setting[key];
		setSetting(prev => ({ ...prev, [key]: checked }));
		setSaving(key, true);

		try {
			const payload: UpdateMapAppSettingRequest = {};
			payload[key] = checked;
			const { setting: saved } = await updateMapAppSetting(payload);
			// 操作したキーだけをサーバーの値で確定させる。
			// レスポンス全体を反映すると、同時に操作した別のキーを巻き戻してしまう
			setSetting(prev => ({ ...prev, [key]: saved[key] }));
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
			setSaving(key, false);
		}

		toast.success("設定を保存しました");
	};

	return (
		<div>
			<div className={styles.header}>
				<Heading size="6">雙峰祭オンラインマップ</Heading>
				<Text size="2" color="gray">
					企画側で編集できる項目を設定します。変更は即時反映されます。
				</Text>
			</div>

			<Card className={styles.card}>
				<Flex direction="column" gap="4">
					{SWITCHES.map(({ key, label }) => (
						<Flex key={key} justify="between" align="center">
							<Switch
								label={label}
								checked={setting[key]}
								onCheckedChange={checked => void handleToggle(key, checked)}
								disabled={savingKeys.has(key)}
							/>
						</Flex>
					))}
				</Flex>
			</Card>
		</div>
	);
}
