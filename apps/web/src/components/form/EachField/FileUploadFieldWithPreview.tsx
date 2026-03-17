import { Flex, Text } from "@radix-ui/themes";
import { IconFileSearch } from "@tabler/icons-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import FilePreviewDialog from "@/components/filePreview/FilePreviewDialog";
import type { UploadedFileValue } from "@/components/form/type";
import { IconButton } from "@/components/primitives";
import { downloadFile, fetchFile } from "@/lib/api/files";
import { FileUploadField } from "./FileUploadField";
import styles from "./FileUploadFieldWithPreview.module.scss";

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
};

function buildHelperText(
	selectedCount: number,
	minFiles?: number,
	maxFiles?: number
): string | null {
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

export function FileUploadFieldWithPreview({
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
}: FileUploadProps) {
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
		...value.map(file => ({
			key: `${file.name}:${file.size}:${file.lastModified}`,
			name: file.name,
			disabled: false,
			onClick: () => handlePendingFilePreview(file),
		})),
		...sortedUploadedFiles.map(file => ({
			key: file.id,
			name: file.fileName,
			disabled: loadingFileId === file.id,
			onClick: () => {
				void handleUploadedFilePreview(file);
			},
		})),
	];
	const helperText = buildHelperText(previewItems.length, minFiles, maxFiles);

	return (
		<div className={styles.container}>
			<FileUploadField
				label={label}
				value={value}
				onChange={onChange}
				required={required}
				disabled={disabled}
				uploadedFileNames={uploadedFiles.map(file => file.fileName)}
				minFiles={minFiles}
				maxFiles={maxFiles}
				helperText={helperText ?? undefined}
				error={error}
			/>
			{previewItems.length > 0 ? (
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
						</div>
					))}
				</Flex>
			) : (
				<Text size="2">選択されていません</Text>
			)}
			<FilePreviewDialog
				file={previewFile}
				open={open}
				onOpenChange={setOpen}
				onDownload={previewedUploadedFile ? handleDownload : undefined}
			/>
		</div>
	);
}
