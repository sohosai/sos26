import { Card, Flex, Heading, Text } from "@radix-ui/themes";
import type { MapAppSetting, UpdateMapAppSettingRequest } from "@sos26/shared";
import { createFileRoute, useRouter } from "@tanstack/react-router";
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
	const router = useRouter();
	const { setting: loadedSetting } = Route.useLoaderData();
	/**
	 * loader の値との差分だけを保持する。
	 * state を loader 値のコピーで seed すると、他ページから戻って
	 * loader が裏で再実行されても画面が古い値のまま固定されてしまうため、
	 * 表示値は常に「最新の loader 値 + 未確定の差分」として計算する。
	 */
	const [overrides, setOverrides] = useState<Partial<MapAppSetting>>({});
	const setting: MapAppSetting = { ...loadedSetting, ...overrides };

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

	const setOverride = (
		key: keyof MapAppSetting,
		value: boolean | undefined
	) => {
		setOverrides(prev => {
			const next = { ...prev };
			if (value === undefined) {
				delete next[key];
			} else {
				next[key] = value;
			}
			return next;
		});
	};

	// スイッチ操作でそのまま反映する（変更した項目のみ送信し、他の管理者の変更を上書きしない）
	const handleToggle = async (key: keyof MapAppSetting, checked: boolean) => {
		setOverride(key, checked);
		setSaving(key, true);

		try {
			const payload: UpdateMapAppSettingRequest = {};
			payload[key] = checked;
			await updateMapAppSetting(payload);
			// loader を再取得して他ページから戻った際も最新値が表示されるようにする。
			// 差分は loader 値が追いつくまで保持し、反映が終わってから消す
			// （先に消すと一瞬だけ古い loader 値が表示されてしまう）
			await router.invalidate().catch(() => undefined);
			setOverride(key, undefined);
		} catch (error) {
			setOverride(key, undefined);
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
