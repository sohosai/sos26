import { TextField as RadixTextField, Text } from "@radix-ui/themes";
import { useId } from "react";
import styles from "./TextField.module.scss";

/**
 * TextField - アプリケーション標準のテキスト入力
 *
 * @see https://www.radix-ui.com/themes/docs/components/text-field
 *
 * ## 制限していること
 * - size: "2" のみ（統一）
 * - variant: "surface" 固定
 * - radius: 指定不可（デザイン統一）
 *
 * ## 付加している振る舞い
 * - label 必須（a11y 保証）
 * - error 時の統一的なスタイル + aria-invalid
 * - id 自動生成（label と input の紐付け）
 * - required マークの表示
 *
 * ## 例外を許す場合
 * - 検索バーなど label が視覚的に不要な場合は aria-label で対応
 */

type TextFieldProps = {
	label: string;
	error?: string;
	placeholder?: string;
	type?:
		| "text"
		| "email"
		| "password"
		| "tel"
		| "url"
		| "number"
		| "search"
		| "date"
		| "time";
	value?: string;
	defaultValue?: string;
	onChange?: (value: string) => void;
	required?: boolean;
	disabled?: boolean;
	name?: string;
	autoComplete?: string;
};

export function TextField({
	label,
	error,
	placeholder,
	type = "text",
	value,
	defaultValue,
	onChange,
	required,
	disabled,
	name,
	autoComplete,
}: TextFieldProps) {
	const id = useId();
	const errorId = `${id}-error`;

	return (
		<div className={styles.container}>
			<Text as="label" size="2" weight="medium" htmlFor={id}>
				{label}
				{required && <span aria-hidden="true"> *</span>}
			</Text>

			<RadixTextField.Root
				id={id}
				size="2"
				variant="surface"
				type={type}
				placeholder={placeholder}
				value={value}
				defaultValue={defaultValue}
				onChange={e => onChange?.(e.target.value)}
				required={required}
				disabled={disabled}
				name={name}
				autoComplete={autoComplete}
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
