import { Checkbox as RadixCheckbox, Text } from "@radix-ui/themes";
import { useId } from "react";
import styles from "./Checkbox.module.scss";

/**
 * Checkbox - アプリケーション標準のチェックボックス
 *
 * @see https://www.radix-ui.com/themes/docs/components/checkbox
 * @see https://www.radix-ui.com/primitives/docs/components/checkbox
 *
 * ## 制限していること
 * - size: "1" | "2" のみ（"3" は大きすぎるため不可）
 * - variant: "surface" 固定（デザイン統一）
 * - highContrast: 指定不可
 *
 * ## 付加している振る舞い
 * - label 必須（a11y 保証）
 * - id 自動生成（label と input の紐付け）
 *
 * ## 例外を許す場合
 * - テーブル内の一括選択など label が視覚的に不要な場合は aria-label で対応
 */

type CheckboxProps = {
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

export function Checkbox({
	label,
	size = "2",
	checked,
	defaultChecked,
	onCheckedChange,
	disabled,
	required,
	name,
	value = "on",
}: CheckboxProps) {
	const id = useId();

	return (
		<label htmlFor={id} className={styles.label}>
			<RadixCheckbox
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
