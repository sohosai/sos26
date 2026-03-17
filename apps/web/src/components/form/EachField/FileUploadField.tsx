import { Text } from "@radix-ui/themes";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/primitives";
import styles from "./FileUploadField.module.scss";

type FileUploadProps = {
	label: string;
	value?: File[];
	onChange: (files: File[]) => void;
	required?: boolean;
	disabled?: boolean;
	uploadedFileNames?: string[];
	minFiles?: number;
	maxFiles?: number;
	helperText?: string;
	error?: string;
};

export function FileUploadField({
	label,
	onChange,
	required,
	disabled,
	helperText,
	error,
	maxFiles,
}: FileUploadProps) {
	const id = useId();
	const inputRef = useRef<HTMLInputElement>(null);
	const [selectionError, setSelectionError] = useState<string | null>(null);

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
						const nextFiles = Array.from(e.target.files ?? []);
						if (maxFiles !== undefined && nextFiles.length > maxFiles) {
							onChange(nextFiles.slice(0, maxFiles));
							setSelectionError(`${maxFiles}個以内で添付してください`);
						} else {
							onChange(nextFiles);
							setSelectionError(null);
						}
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
			{helperText && (
				<Text size="2" color="gray">
					{helperText}
				</Text>
			)}
			{(selectionError ?? error) && (
				<Text size="2" color="red">
					{selectionError ?? error}
				</Text>
			)}
		</div>
	);
}
