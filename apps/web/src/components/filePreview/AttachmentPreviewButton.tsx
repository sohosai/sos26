import { Text } from "@radix-ui/themes";
import { IconFileSearch } from "@tabler/icons-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/primitives";
import { downloadFile, fetchFile } from "@/lib/api/files";
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
	const [open, setOpen] = useState(false);
	const [isLoading, setIsLoading] = useState(false);

	const handleClick = async () => {
		if (file) {
			setOpen(true);
			return;
		}

		setIsLoading(true);
		try {
			const fetched = await fetchFile(
				attachment.fileId,
				attachment.fileName,
				attachment.mimeType,
				attachment.isPublic
			);
			setFile(fetched);
			setOpen(true);
		} catch {
			toast.error("ファイルの取得に失敗しました");
		} finally {
			setIsLoading(false);
		}
	};

	const handleDownload = useCallback(() => {
		downloadFile(
			attachment.fileId,
			attachment.fileName,
			attachment.isPublic
		).catch(() => toast.error("ファイルのダウンロードに失敗しました"));
	}, [attachment.fileId, attachment.fileName, attachment.isPublic]);

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
				open={open}
				onOpenChange={setOpen}
				onDownload={handleDownload}
			/>
		</>
	);
}
