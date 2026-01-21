import { CheckboxGroup as RadixCheckboxGroup, Text } from "@radix-ui/themes";
import type { ReactNode } from "react";
import styles from "./CheckboxGroup.module.scss";

/**
 * CheckboxGroup - チェックボックスグループ
 *
 * @see https://www.radix-ui.com/themes/docs/components/checkbox-group
 *
 * ## 制限していること
 * - size: "1" | "2" のみ（"3" は大きすぎるため不可）
 * - variant: "surface" 固定（デザイン統一）
 * - highContrast, color: 指定不可
 *
 * ## 付加している振る舞い
 * - label 必須（a11y 保証）
 * - required マークの表示
 *
 * ## 注意点
 * CheckboxGroup.Item は children でラベルを受け取る（label prop ではない）
 *
 * ## 使い方
 * ```tsx
 * import { CheckboxGroup, CheckboxGroupItem } from "@/components/patterns";
 *
 * <CheckboxGroup label="興味のある分野" value={value} onValueChange={setValue}>
 *   <CheckboxGroupItem value="tech">テクノロジー</CheckboxGroupItem>
 *   <CheckboxGroupItem value="design">デザイン</CheckboxGroupItem>
 * </CheckboxGroup>
 * ```
 */

type CheckboxGroupProps = {
	label: string;
	children: ReactNode;
	size?: "1" | "2";
	value?: string[];
	defaultValue?: string[];
	onValueChange?: (value: string[]) => void;
	disabled?: boolean;
	required?: boolean;
	name?: string;
};

export function CheckboxGroup({
	label,
	children,
	size = "2",
	value,
	defaultValue,
	onValueChange,
	disabled,
	required,
	name,
}: CheckboxGroupProps) {
	return (
		<fieldset className={styles.fieldset}>
			<legend className={styles.legend}>
				<Text size="2" weight="medium">
					{label}
					{required && <span aria-hidden="true"> *</span>}
				</Text>
			</legend>
			<RadixCheckboxGroup.Root
				size={size}
				variant="surface"
				value={value}
				defaultValue={defaultValue}
				onValueChange={onValueChange}
				disabled={disabled}
				required={required}
				name={name}
				className={styles.group}
			>
				{children}
			</RadixCheckboxGroup.Root>
		</fieldset>
	);
}

/**
 * CheckboxGroupItem - CheckboxGroup 内で使用するチェックボックス
 *
 * children でラベルテキストを受け取る（Radix の API に準拠）
 */
type CheckboxGroupItemProps = {
	children: ReactNode;
	value: string;
	disabled?: boolean;
};

export function CheckboxGroupItem({
	children,
	value,
	disabled,
}: CheckboxGroupItemProps) {
	return (
		<RadixCheckboxGroup.Item value={value} disabled={disabled}>
			{children}
		</RadixCheckboxGroup.Item>
	);
}
