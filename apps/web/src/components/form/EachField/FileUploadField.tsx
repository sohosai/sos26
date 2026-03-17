import { Text } from "@radix-ui/themes";
import { useId, useRef } from "react";
import { Button } from "@/components/primitives";
import styles from "./FileUploadField.module.scss";

type FileUploadProps = {
	label: string;
	value?: File[];
	onChange: (files: File[]) => void;
	required?: boolean;
	disabled?: boolean;
	uploadedFileNames?: string[];
};

export function FileUploadField({
	label,
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
					id={id}
					ref={inputRef}
					type="file"
					multiple
					className={styles.fileInput}
					required={required}
					onChange={e => {
						onChange(Array.from(e.target.files ?? []));
						e.currentTarget.value = "";
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
			</div>
		</div>
	);
}
