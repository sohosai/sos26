import { Dialog, Text, VisuallyHidden } from "@radix-ui/themes";
import {
	IconDownload,
	IconX,
	IconZoomIn,
	IconZoomOut,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { Button, IconButton } from "@/components/primitives";
import ExcelViewer from "./ExcelViewer";
import styles from "./FilePreviewDialog.module.scss";
import PdfViewer from "./Pdfviewer";
import WordViewer from "./Wordviewer";

interface Props {
	file: File | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onDownload?: () => void;
}

function getExt(file: File) {
	return file.name.split(".").pop()?.toLowerCase() ?? "";
}

const ZOOM_STEP = 0.25;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3.0;
const PDF_BASE_SCALE = 1.25;

function isZoomable(ext: string) {
	return ext === "pdf";
}

function Viewer({ file, scale }: { file: File; scale: number }) {
	const ext = getExt(file);
	const isImage = ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext);
	const [imageUrl, setImageUrl] = useState<string | null>(null);
	useEffect(() => {
		if (!isImage) {
			setImageUrl(null);
			return;
		}

		const objectUrl = URL.createObjectURL(file);
		setImageUrl(objectUrl);

		return () => {
			URL.revokeObjectURL(objectUrl);
		};
	}, [file, isImage]);

	if (ext === "pdf")
		return <PdfViewer file={file} scale={scale * PDF_BASE_SCALE} />;
	if (ext === "xlsx" || ext === "xls") return <ExcelViewer file={file} />;

	if (ext === "docx") return <WordViewer file={file} />;
	if (isImage && imageUrl)
		return <img src={imageUrl} className={styles.image} alt={file.name} />;

	return (
		<div className={styles.unsupported}>
			{ext ? (
				<Text size="2">非対応の形式です：.{ext}</Text>
			) : (
				<Text size="2">ファイルを表示できません</Text>
			)}
		</div>
	);
}

export default function FilePreviewDialog({
	file,
	open,
	onOpenChange,
	onDownload,
}: Props) {
	const [scale, setScale] = useState(1.0);
	const showZoom = file ? isZoomable(getExt(file)) : false;
	const fileKey = file ? `${file.name}-${file.size}` : "";

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset scale when file changes
	useEffect(() => {
		setScale(1.0);
	}, [fileKey]);

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Content className={styles.content}>
				<VisuallyHidden>
					<Dialog.Title>{file?.name ?? ""}</Dialog.Title>
				</VisuallyHidden>
				<div className={styles.header}>
					<Text size="3" weight="medium" className={styles.title}>
						{file?.name ?? ""}
					</Text>
					<div className={styles.headerActions}>
						{showZoom && (
							<div className={styles.zoomControls}>
								<IconButton
									size="1"
									aria-label="縮小"
									onClick={() =>
										setScale(s => Math.max(ZOOM_MIN, s - ZOOM_STEP))
									}
									disabled={scale <= ZOOM_MIN}
								>
									<IconZoomOut size={16} />
								</IconButton>
								<Text size="2" className={styles.zoomLabel}>
									{Math.round(scale * 100)}%
								</Text>
								<IconButton
									size="1"
									aria-label="拡大"
									onClick={() =>
										setScale(s => Math.min(ZOOM_MAX, s + ZOOM_STEP))
									}
									disabled={scale >= ZOOM_MAX}
								>
									<IconZoomIn size={16} />
								</IconButton>
							</div>
						)}
						{onDownload && (
							<Button intent="secondary" size="2" onClick={onDownload}>
								<IconDownload size={16} />
								ダウンロード
							</Button>
						)}
						<Dialog.Close>
							<IconButton size="2" aria-label="閉じる">
								<IconX size={18} />
							</IconButton>
						</Dialog.Close>
					</div>
				</div>

				{/* プレビューエリア */}
				<div className={styles.body}>
					{file && (
						<Viewer key={file.name + file.size} file={file} scale={scale} />
					)}
				</div>
			</Dialog.Content>
		</Dialog.Root>
	);
}
