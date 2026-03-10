import { IconFileSearch } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import FilePreviewDialog from "@/components/filePreview/FilePreviewDialog";
import type { UploadedFileValue } from "@/components/form/type";
import { IconButton } from "@/components/primitives";
import { downloadFile, fetchFile } from "@/lib/api/files";
import { FileUploadField } from "./FileUploadField";
import styles from "./FileUploadFieldWithPreview.module.scss";

type FileUploadProps = {
	label: string;
	value?: File | null;
	uploadedFile?: UploadedFileValue | null;
	onChange: (file: File | null) => void;
	required?: boolean;
	disabled?: boolean;
};

function canPreviewUploadedFile(
	uploadedFile?: UploadedFileValue | null
): uploadedFile is {
	fileId: string;
	fileName: string;
	mimeType: string;
	isPublic: boolean;
} {
	return (
		uploadedFile?.fileName != null &&
		uploadedFile.mimeType != null &&
		uploadedFile.isPublic != null
	);
}

export function FileUploadFieldWithPreview({
	label,
	value,
	uploadedFile,
	onChange,
	required,
	disabled,
}: FileUploadProps) {
	const [fetchedFile, setFetchedFile] = useState<File | null>(null);
	const [open, setOpen] = useState(false);
	const [isFetching, setIsFetching] = useState(false);
	const uploadedFileId = uploadedFile?.fileId ?? null;

	useEffect(() => {
		if (uploadedFileId === null) {
			setFetchedFile(null);
			return;
		}
		setFetchedFile(null);
	}, [uploadedFileId]);

	const previewFile = value ?? fetchedFile;
	const uploadedFileName =
		uploadedFile?.fileName ?? (uploadedFile ? "アップロード済み" : undefined);

	const handleDownload = async () => {
		if (!canPreviewUploadedFile(uploadedFile)) {
			return;
		}

		try {
			await downloadFile(
				uploadedFile.fileId,
				uploadedFile.fileName,
				uploadedFile.isPublic
			);
		} catch {
			toast.error("ファイルのダウンロードに失敗しました");
		}
	};

	const handlePreviewOpen = async () => {
		if (value) {
			setOpen(true);
			return;
		}

		if (fetchedFile) {
			setOpen(true);
			return;
		}

		if (!canPreviewUploadedFile(uploadedFile)) {
			return;
		}

		setIsFetching(true);
		try {
			const file = await fetchFile(
				uploadedFile.fileId,
				uploadedFile.fileName,
				uploadedFile.mimeType,
				uploadedFile.isPublic
			);
			setFetchedFile(file);
			setOpen(true);
		} catch {
			toast.error("ファイルの取得に失敗しました");
		} finally {
			setIsFetching(false);
		}
	};

	const canPreview = Boolean(value) || canPreviewUploadedFile(uploadedFile);

	return (
		<div className={styles.container}>
			<FileUploadField
				label={label}
				value={value}
				onChange={onChange}
				required={required}
				disabled={disabled}
				uploadedFileName={uploadedFileName}
			/>
			{canPreview && (
				<div>
					<IconButton
						onClick={() => {
							void handlePreviewOpen();
						}}
						disabled={isFetching}
						aria-label="ファイルをプレビュー"
					>
						<IconFileSearch size={16} />
					</IconButton>
				</div>
			)}
			<FilePreviewDialog
				file={previewFile}
				open={open}
				onOpenChange={setOpen}
				onDownload={
					value === null && canPreviewUploadedFile(uploadedFile)
						? handleDownload
						: undefined
				}
			/>
		</div>
	);
}
