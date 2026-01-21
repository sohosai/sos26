import { Switch as RadixSwitch, Text } from "@radix-ui/themes";
import { useId } from "react";
import styles from "./Switch.module.scss";

/**
 * Switch - アプリケーション標準のスイッチ
 *
 * @see https://www.radix-ui.com/themes/docs/components/switch
 *
 * ## 制限していること
 * - size: "1" | "2" のみ（"3" は大きすぎるため不可）
 * - variant: "surface" 固定（デザイン統一）
 * - highContrast, radius: 指定不可
 *
 * ## 付加している振る舞い
 * - label 必須（a11y 保証）
 * - id 自動生成（label と input の紐付け）
 *
 * ## 例外を許す場合
 * - 特殊なレイアウトが必要な場合は patterns/ で対応
 */

type SwitchProps = {
	label: string;
	size?: "1" | "2";
	checked?: boolean;
	defaultChecked?: boolean;
	onCheckedChange?: (checked: boolean) => void;
	disabled?: boolean;
	required?: boolean;
	name?: string;
	value?: string;
};

export function Switch({
	label,
	size = "2",
	checked,
	defaultChecked,
	onCheckedChange,
	disabled,
	required,
	name,
	value = "on",
}: SwitchProps) {
	const id = useId();

	return (
		<label htmlFor={id} className={styles.label}>
			<RadixSwitch
				id={id}
				size={size}
				variant="surface"
				checked={checked}
				defaultChecked={defaultChecked}
				onCheckedChange={onCheckedChange}
				disabled={disabled}
				required={required}
				name={name}
				value={value}
			/>
			<Text size={size} weight="medium">
				{label}
			</Text>
		</label>
	);
}
