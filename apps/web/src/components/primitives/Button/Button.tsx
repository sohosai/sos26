import { Button as RadixButton } from "@radix-ui/themes";
import {
	type ComponentProps,
	forwardRef,
	type MouseEvent,
	type ReactNode,
} from "react";
import styles from "./Button.module.scss";

/**
 * Button - アプリケーション標準のボタン
 *
 * @see https://www.radix-ui.com/themes/docs/components/button
 *
 * ## 制限していること
 * - variant/color: intent に集約（primary/secondary/danger/ghost）
 * - size: "1" | "2" のみ（"3", "4" は大きすぎるため不可）
 * - highContrast, radius: 指定不可（デザイン統一）
 *
 * ## 付加している振る舞い
 * - type: デフォルト "button"（フォーム誤送信防止）
 * - ref 転送対応（Radix の Popover.Trigger 等と合成可能）
 *
 * ## 例外を許す場合
 * - アイコンのみのボタンは IconButton を使う
 * - 特殊なレイアウトが必要な場合は patterns/ で対応
 */

type RadixButtonProps = ComponentProps<typeof RadixButton>;

const intentMap = {
	primary: { variant: "solid", color: undefined },
	secondary: { variant: "outline", color: undefined },
	danger: { variant: "solid", color: "red" },
	ghost: { variant: "ghost", color: undefined },
} as const satisfies Record<
	string,
	{
		variant: RadixButtonProps["variant"];
		color: RadixButtonProps["color"];
	}
>;

type ButtonProps = {
	children: ReactNode;
	intent?: keyof typeof intentMap;
	size?: "1" | "2";
	loading?: boolean;
	disabled?: boolean;
	type?: "button" | "submit" | "reset";
	onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
	function Button(
		{
			children,
			intent = "primary",
			size = "2",
			loading = false,
			disabled = false,
			type = "button",
			onClick,
			...rest
		},
		ref
	) {
		const { variant, color } = intentMap[intent];

		return (
			<RadixButton
				{...rest}
				ref={ref}
				className={styles.button}
				variant={variant}
				color={color}
				size={size}
				loading={loading}
				disabled={disabled}
				type={type}
				onClick={onClick}
			>
				{children}
			</RadixButton>
		);
	}
);
