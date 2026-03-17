import { Flex, Text } from "@radix-ui/themes";
import { IconFileSearch, IconX } from "@tabler/icons-react";
import { useCallback, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import FilePreviewDialog from "@/components/filePreview/FilePreviewDialog";
import type { UploadedFileValue } from "@/components/form/type";
import { Button, IconButton } from "@/components/primitives";
import { downloadFile, fetchFile } from "@/lib/api/files";
import styles from "./FileUploadField.module.scss";

type FileUploadProps = {
	label: string;
	value?: File[];
	uploadedFiles?: UploadedFileValue[];
	onChange: (files: File[]) => void;
	required?: boolean;
	disabled?: boolean;
	minFiles?: number;
	maxFiles?: number;
	error?: string;
	"aria-label"?: string;
	onDeleteUploadedFile?: (file: UploadedFileValue) => void;
};

function buildHelperText(
	selectedCount: number,
	minFiles?: number,
	maxFiles?: number
): string | null {
	if (selectedCount === 0) {
		if (minFiles !== undefined && maxFiles !== undefined) {
			return `${minFiles}〜${maxFiles}個`;
		}
		if (maxFiles !== undefined) {
			return `最大${maxFiles}個`;
		}
		if (minFiles !== undefined) {
			return `最低${minFiles}個`;
		}
		return null;
	}
	if (minFiles !== undefined && maxFiles !== undefined) {
		return `選択中 ${selectedCount}個 (${minFiles}〜${maxFiles}個)`;
	}
	if (maxFiles !== undefined) {
		return `選択中 ${selectedCount}個 / 最大${maxFiles}個`;
	}
	if (minFiles !== undefined) {
		return `選択中 ${selectedCount}個 / 最低${minFiles}個`;
	}
	return null;
}

export function FileUploadField({
	label,
	value = [],
	uploadedFiles = [],
	onChange,
	required,
	disabled,
	minFiles,
	maxFiles,
	error,
	"aria-label": ariaLabel,
	onDeleteUploadedFile,
}: FileUploadProps) {
	const id = useId();
	const inputRef = useRef<HTMLInputElement>(null);
	const [selectionError, setSelectionError] = useState<string | null>(null);
	const [previewFile, setPreviewFile] = useState<File | null>(null);
	const [previewedUploadedFile, setPreviewedUploadedFile] =
		useState<UploadedFileValue | null>(null);
	const [open, setOpen] = useState(false);
	const [loadingFileId, setLoadingFileId] = useState<string | null>(null);

	const sortedUploadedFiles = useMemo(
		() => uploadedFiles.slice().sort((a, b) => a.sortOrder - b.sortOrder),
		[uploadedFiles]
	);
	const previewLabel = ariaLabel ?? (label || "ファイル");

	const handleButtonClick = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();

		// 次のフレームで開くことで、Radix のイベント処理を回避する
		requestAnimationFrame(() => {
			inputRef.current?.click();
		});
	};

	const handlePendingFilePreview = (file: File) => {
		setPreviewFile(file);
		setPreviewedUploadedFile(null);
		setOpen(true);
	};

	const handleUploadedFilePreview = async (file: UploadedFileValue) => {
		setLoadingFileId(file.id);
		try {
			const fetchedFile = await fetchFile(
				file.id,
				file.fileName,
				file.mimeType,
				file.isPublic
			);
			setPreviewFile(fetchedFile);
			setPreviewedUploadedFile(file);
			setOpen(true);
		} catch {
			toast.error("ファイルの取得に失敗しました");
		} finally {
			setLoadingFileId(current => (current === file.id ? null : current));
		}
	};

	const handleDownload = useCallback(() => {
		if (!previewedUploadedFile) {
			return;
		}

		downloadFile(
			previewedUploadedFile.id,
			previewedUploadedFile.fileName,
			previewedUploadedFile.isPublic
		).catch(() => toast.error("ファイルのダウンロードに失敗しました"));
	}, [previewedUploadedFile]);

	const previewItems = [
		...value.map((file, index) => ({
			key: `${file.name}:${file.size}:${file.lastModified}`,
			name: file.name,
			disabled: false,
			onClick: () => handlePendingFilePreview(file),
			onDelete: () => {
				const newFiles = value.filter((_, i) => i !== index);
				onChange(newFiles);
			},
		})),
		...sortedUploadedFiles.map(file => ({
			key: file.id,
			name: file.fileName,
			disabled: loadingFileId === file.id,
			onClick: () => {
				void handleUploadedFilePreview(file);
			},
			onDelete: onDeleteUploadedFile
				? () => onDeleteUploadedFile(file)
				: undefined,
		})),
	];

	const helperText = buildHelperText(previewItems.length, minFiles, maxFiles);

	const fileList = (() => {
		if (previewItems.length > 0) {
			return (
				<Flex direction="column">
					{previewItems.map(item => (
						<div key={item.key}>
							<Text size="2">{item.name}</Text>
							<IconButton
								size="1"
								aria-label={`${previewLabel}「${item.name}」をプレビュー`}
								disabled={item.disabled}
								onClick={item.onClick}
							>
								<IconFileSearch size={16} />
							</IconButton>
							{item.onDelete && (
								<IconButton
									size="1"
									intent="danger"
									aria-label={`${previewLabel}「${item.name}」を削除`}
									disabled={item.disabled || !!disabled}
									onClick={item.onDelete}
								>
									<IconX size={16} />
								</IconButton>
							)}
						</div>
					))}
				</Flex>
			);
		}
		if (!disabled) {
			return <Text size="2">選択されていません</Text>;
		}
		return null;
	})();

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
			{fileList}
			<FilePreviewDialog
				file={previewFile}
				open={open}
				onOpenChange={setOpen}
				onDownload={previewedUploadedFile ? handleDownload : undefined}
			/>
		</div>
	);
}
