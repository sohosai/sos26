import { Select as RadixSelect } from "@radix-ui/themes";
import type { ReactNode } from "react";
import styles from "./Select.module.scss";

/**
 * Select - アプリケーション標準のセレクト
 *
 * @see https://www.radix-ui.com/themes/docs/components/select
 *
 * ## 制限していること
 * - size: "1" | "2" のみ（"3" は大きすぎるため不可）
 * - variant: "surface" | "ghost" のみ
 *
 * ## 付加している振る舞い
 * - options を配列で受け取り、統一的なレンダリング
 * - aria-label サポート（テーブルセルなど視覚的ラベルが不要な場合）
 * - icon サポート（オプション項目にアイコンを表示）
 *
 * ## 例外を許す場合
 * - 複雑なカスタムドロップダウンが必要な場合は patterns/ で対応
 */

type SelectOption = {
	value: string;
	label: string;
	icon?: ReactNode;
};

type SelectProps = {
	options: SelectOption[];
	value?: string;
	defaultValue?: string;
	onValueChange?: (value: string) => void;
	onOpenChange?: (open: boolean) => void;
	placeholder?: string;
	disabled?: boolean;
	size?: "1" | "2";
	variant?: "surface" | "ghost";
	"aria-label"?: string;
};

export function Select({
	options,
	value,
	defaultValue,
	onValueChange,
	onOpenChange,
	placeholder,
	disabled,
	size = "2",
	variant = "surface",
	"aria-label": ariaLabel,
}: SelectProps) {
	return (
		<RadixSelect.Root
			value={value}
			defaultValue={defaultValue}
			onValueChange={onValueChange}
			onOpenChange={onOpenChange}
			disabled={disabled}
			size={size}
		>
			<RadixSelect.Trigger
				className={styles.trigger}
				variant={variant}
				placeholder={placeholder}
				aria-label={ariaLabel}
			/>
			<RadixSelect.Content position="popper">
				{options.map(option => (
					<RadixSelect.Item
						key={option.value}
						value={option.value}
						textValue={option.label}
					>
						{option.icon ? (
							<span className={styles.itemWithIcon}>
								<span className={styles.itemIcon}>{option.icon}</span>
								{option.label}
							</span>
						) : (
							option.label
						)}
					</RadixSelect.Item>
				))}
			</RadixSelect.Content>
		</RadixSelect.Root>
	);
}
