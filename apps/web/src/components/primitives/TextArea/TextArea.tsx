import { TextArea as RadixTextArea, Text } from "@radix-ui/themes";
import { useId } from "react";
import styles from "./TextArea.module.scss";

/**
 * TextArea - アプリケーション標準のテキストエリア
 *
 * @see https://www.radix-ui.com/themes/docs/components/text-area
 *
 * ## 制限していること
 * - size: "2" のみ（統一）
 * - variant: "surface" 固定
 * - radius: 指定不可（デザイン統一）
 *
 * ## 付加している振る舞い
 * - label 必須（a11y 保証）
 * - error 時の統一的なスタイル + aria-invalid
 * - id 自動生成（label と textarea の紐付け）
 * - resize: "vertical" デフォルト
 * - required マークの表示
 *
 * ## 例外を許す場合
 * - 特殊なレイアウトが必要な場合は patterns/ で対応
 */

type TextAreaProps = {
	label: string;
	error?: string;
	placeholder?: string;
	value?: string;
	defaultValue?: string;
	onChange?: (value: string) => void;
	required?: boolean;
	disabled?: boolean;
	rows?: number;
	resize?: "none" | "vertical" | "horizontal" | "both";
	name?: string;
};

export function TextArea({
	label,
	error,
	placeholder,
	value,
	defaultValue,
	onChange,
	required,
	disabled,
	rows,
	resize = "vertical",
	name,
}: TextAreaProps) {
	const id = useId();
	const errorId = `${id}-error`;

	return (
		<div className={styles.container}>
			<Text as="label" size="2" weight="medium" htmlFor={id}>
				{label}
				{required && <span aria-hidden="true"> *</span>}
			</Text>

			<RadixTextArea
				id={id}
				size="2"
				variant="surface"
				placeholder={placeholder}
				value={value}
				defaultValue={defaultValue}
				onChange={e => onChange?.(e.target.value)}
				required={required}
				disabled={disabled}
				rows={rows}
				resize={resize}
				name={name}
				aria-invalid={!!error}
				aria-describedby={error ? errorId : undefined}
			/>

			{error && (
				<Text id={errorId} size="1" color="red" role="alert">
					{error}
				</Text>
			)}
		</div>
	);
}
