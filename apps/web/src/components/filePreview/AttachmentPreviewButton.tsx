import { Text } from "@radix-ui/themes";
import { isStreamable } from "@sos26/shared";
import { IconFileSearch } from "@tabler/icons-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/primitives";
import {
	downloadFile,
	fetchFile,
	releasePreviewFile,
	requestPreviewUrl,
} from "@/lib/api/files";
import { formatFileSize } from "@/lib/format";
import FilePreviewDialog from "./FilePreviewDialog";

type Attachment = {
	fileId: string;
	fileName: string;
	mimeType: string;
	size: number;
	isPublic: boolean;
};

interface Props {
	attachment: Attachment;
}

export function AttachmentPreviewButton({ attachment }: Props) {
	const [file, setFile] = useState<File | null>(null);
	const [streamingUrl, setStreamingUrl] = useState<string | null>(null);
	const [open, setOpen] = useState(false);
	const [isLoading, setIsLoading] = useState(false);

	const handleClick = async () => {
		// キャッシュ済み（Blob または streamingUrl）
		if (file || streamingUrl) {
			setOpen(true);
			return;
		}

		setOpen(true);
		setIsLoading(true);

		try {
			if (isStreamable(attachment.fileName)) {
				// 動画・画像: S3 Presigned URL で即ストリーミング（inline）
				const { previewUrl } = await requestPreviewUrl(attachment.fileId);
				setStreamingUrl(previewUrl);
			} else {
				// PDF/Word/Excel: Blob にしてから表示
				const fetched = await fetchFile(
					attachment.fileId,
					attachment.fileName,
					attachment.mimeType,
					attachment.isPublic
				);
				setFile(fetched);
			}
		} catch {
			toast.error("ファイルの取得に失敗しました");
			setOpen(false);
		} finally {
			setIsLoading(false);
		}
	};

	const handleDownload = useCallback(() => {
		downloadFile(attachment.fileId, attachment.fileName).catch(() =>
			toast.error("ファイルのダウンロードに失敗しました")
		);
	}, [attachment.fileId, attachment.fileName]);

	return (
		<>
			<Button
				intent="secondary"
				size="2"
				onClick={handleClick}
				loading={isLoading}
			>
				<IconFileSearch size={14} />
				<Text size="2">{attachment.fileName}</Text>
				<Text size="1" color="gray">
					({formatFileSize(attachment.size)})
				</Text>
			</Button>
			<FilePreviewDialog
				file={file}
				streamingUrl={streamingUrl}
				fileName={attachment.fileName}
				open={open}
				onOpenChange={nextOpen => {
					if (!nextOpen) {
						releasePreviewFile(attachment.fileId);
					}
					setOpen(nextOpen);
				}}
				onDownload={handleDownload}
				loading={isLoading}
			/>
		</>
	);
}
