import { IconButton as RadixIconButton } from "@radix-ui/themes";
import {
	type ComponentProps,
	forwardRef,
	type MouseEvent,
	type ReactNode,
} from "react";
import styles from "./IconButton.module.scss";

/**
 * IconButton - アプリケーション標準のアイコンボタン
 *
 * @see https://www.radix-ui.com/themes/docs/components/icon-button
 *
 * ## 制限していること
 * - variant/color: intent に集約（ghost/danger）
 * - size: "1" | "2" のみ（"3", "4" は大きすぎるため不可）
 * - highContrast, radius: 指定不可（デザイン統一）
 *
 * ## 付加している振る舞い
 * - type: デフォルト "button"（フォーム誤送信防止）
 * - ref 転送対応（Radix の Popover.Trigger 等と合成可能）
 */

type RadixIconButtonProps = ComponentProps<typeof RadixIconButton>;

const intentMap = {
	ghost: { variant: "ghost", color: undefined },
	danger: { variant: "ghost", color: "red" },
} as const satisfies Record<
	string,
	{
		variant: RadixIconButtonProps["variant"];
		color: RadixIconButtonProps["color"];
	}
>;

type IconButtonProps = {
	children: ReactNode;
	intent?: keyof typeof intentMap;
	size?: "1" | "2";
	disabled?: boolean;
	type?: "button" | "submit" | "reset";
	onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
	"aria-label"?: string;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
	function IconButton(
		{
			children,
			intent = "ghost",
			size = "2",
			disabled = false,
			type = "button",
			onClick,
			"aria-label": ariaLabel,
		},
		ref
	) {
		const { variant, color } = intentMap[intent];

		return (
			<RadixIconButton
				ref={ref}
				className={styles.iconButton}
				variant={variant}
				color={color}
				size={size}
				disabled={disabled}
				type={type}
				onClick={onClick}
				aria-label={ariaLabel}
			>
				{children}
			</RadixIconButton>
		);
	}
);
