import { Text } from "@radix-ui/themes";
import { useId, useRef } from "react";
import { Button } from "@/components/primitives";
import styles from "./FileUploadField.module.scss";

type FileUploadProps = {
	label: string;
	value?: File | null;
	onChange: (file: File | null) => void;
	required?: boolean;
	disabled?: boolean;
};

export function FileUploadField({
	label,
	value,
	onChange,
	required,
	disabled,
}: FileUploadProps) {
	const id = useId();
	const inputRef = useRef<HTMLInputElement>(null);

	const handleButtonClick = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();

		// 次のフレームで開くことで、Radix のイベント処理を回避する
		requestAnimationFrame(() => {
			inputRef.current?.click();
		});
	};

	return (
		<div className={styles.container}>
			<Text as="label" size="2" weight="medium" htmlFor={id}>
				{label}
				{required && <span aria-hidden="true"> *</span>}
			</Text>

			<div className={styles.fileLabel}>
				<input
					ref={inputRef}
					type="file"
					className={styles.fileInput}
					onChange={e => {
						const file = e.target.files?.[0] ?? null;
						onChange(file);
					}}
					disabled={disabled}
				/>
				<Button
					intent="secondary"
					onClick={handleButtonClick}
					disabled={disabled}
				>
					ファイルを選択
				</Button>
				<Text size="2">{value?.name ?? "選択されていません"}</Text>
			</div>
		</div>
	);
}
