import { Text } from "@radix-ui/themes";
import { useCallback, useRef, useState } from "react";
import { TextField } from "@/components/primitives";
import styles from "./NumberField.module.scss";

type Props = {
	label: string;
	value: number | null;
	onChange: (val: number | null) => void;
	allowDecimal?: boolean;
	allowNegative?: boolean;
	placeholder?: string;
	required?: boolean;
};

export function NumberField({
	label,
	value,
	onChange,
	allowDecimal = false,
	allowNegative = false,
	placeholder = "数値を入力してください",
	required = false,
}: Props) {
	const [display, setDisplay] = useState(
		value === null || value === undefined ? "" : String(value)
	);
	const [shake, setShake] = useState(false);
	const [invalidMessage, setInvalidMessage] = useState<string | null>(null);
	const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const triggerShake = useCallback((message: string) => {
		setInvalidMessage(message);
		setShake(false);
		// 一旦falseにしてからtrueにしないとアニメーションが再発火しない
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				setShake(true);
			});
		});
		if (shakeTimer.current) clearTimeout(shakeTimer.current);
		shakeTimer.current = setTimeout(() => {
			setShake(false);
			setInvalidMessage(null);
		}, 1500);
	}, []);

	const handleChange = (v: string) => {
		if (v === "") {
			setDisplay("");
			onChange(null);
			return;
		}

		const isIntermediate =
			(allowNegative && v === "-") ||
			(allowDecimal && /^-?\d+\.$/.test(v)) ||
			(allowDecimal && allowNegative && v === "-.");

		if (isIntermediate) {
			setDisplay(v);
			return;
		}

		// バリデーション
		const pattern = buildPattern(allowDecimal, allowNegative);
		if (!pattern.test(v)) {
			const message = buildErrorMessage(v, allowDecimal, allowNegative);
			triggerShake(message);
			return;
		}

		const num = Number(v);
		setDisplay(v);
		onChange(num);
	};

	return (
		<div className={`${styles.wrapper} ${shake ? styles.shake : ""}`}>
			{/* todo : label を修正 */}
			<TextField
				type="text"
				label={label}
				placeholder={placeholder}
				value={display}
				onChange={handleChange}
				required={required}
			/>
			{invalidMessage && (
				<Text size="2" color="red">
					{invalidMessage}
				</Text>
			)}
		</div>
	);
}

function buildPattern(allowDecimal: boolean, allowNegative: boolean): RegExp {
	if (allowDecimal && allowNegative) return /^-?\d+(\.\d*)?$/;
	if (allowDecimal) return /^\d+(\.\d*)?$/;
	if (allowNegative) return /^-?\d+$/;
	return /^\d+$/;
}

function buildErrorMessage(
	input: string,
	allowDecimal: boolean,
	allowNegative: boolean
): string {
	if (!allowNegative && input.includes("-")) return "マイナスは入力できません";
	if (!allowDecimal && input.includes(".")) return "小数は入力できません";
	return "数値のみ入力できます";
}
