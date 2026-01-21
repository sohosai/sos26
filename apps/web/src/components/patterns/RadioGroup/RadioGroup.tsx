import { RadioGroup as RadixRadioGroup, Text } from "@radix-ui/themes";
import type { ReactNode } from "react";
import styles from "./RadioGroup.module.scss";

/**
 * RadioGroup - ラジオボタングループ
 *
 * @see https://www.radix-ui.com/themes/docs/components/radio-group
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
 * RadioGroup.Item は children でラベルを受け取る（label prop ではない）
 *
 * ## 使い方
 * ```tsx
 * import { RadioGroup, RadioGroupItem } from "@/components/patterns";
 *
 * <RadioGroup label="選択肢" value={value} onValueChange={setValue}>
 *   <RadioGroupItem value="a">選択肢 A</RadioGroupItem>
 *   <RadioGroupItem value="b">選択肢 B</RadioGroupItem>
 * </RadioGroup>
 * ```
 */

type RadioGroupProps = {
	label: string;
	children: ReactNode;
	size?: "1" | "2";
	value?: string;
	defaultValue?: string;
	onValueChange?: (value: string) => void;
	disabled?: boolean;
	required?: boolean;
	name?: string;
};

export function RadioGroup({
	label,
	children,
	size = "2",
	value,
	defaultValue,
	onValueChange,
	disabled,
	required,
	name,
}: RadioGroupProps) {
	return (
		<fieldset className={styles.fieldset}>
			<legend className={styles.legend}>
				<Text size="2" weight="medium">
					{label}
					{required && <span aria-hidden="true"> *</span>}
				</Text>
			</legend>
			<RadixRadioGroup.Root
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
			</RadixRadioGroup.Root>
		</fieldset>
	);
}

/**
 * RadioGroupItem - RadioGroup 内で使用するラジオボタン
 *
 * children でラベルテキストを受け取る（Radix の API に準拠）
 */
type RadioGroupItemProps = {
	children: ReactNode;
	value: string;
	disabled?: boolean;
};

export function RadioGroupItem({
	children,
	value,
	disabled,
}: RadioGroupItemProps) {
	return (
		<RadixRadioGroup.Item value={value} disabled={disabled}>
			{children}
		</RadixRadioGroup.Item>
	);
}
