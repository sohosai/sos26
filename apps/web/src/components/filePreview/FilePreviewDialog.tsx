import { Dialog, Spinner, Text, VisuallyHidden } from "@radix-ui/themes";
import { isStreamable } from "@sos26/shared";
import {
	IconDownload,
	IconX,
	IconZoomIn,
	IconZoomOut,
} from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { Button, IconButton } from "@/components/primitives";
import ExcelViewer from "./ExcelViewer";
import styles from "./FilePreviewDialog.module.scss";
import PdfViewer from "./Pdfviewer";
import WordViewer from "./Wordviewer";

interface Props {
	/** PDF/Word/Excel 用（Blob オブジェクト） */
	file?: File | null;
	/** 動画/画像用（S3 Presigned URL などストリーミング URL） */
	streamingUrl?: string | null;
	/** ファイル名（UI 表示用） */
	fileName?: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onDownload?: () => void;
	loading?: boolean;
}

function getExt(name: string) {
	return name.split(".").pop()?.toLowerCase() ?? "";
}

const ZOOM_STEP = 0.25;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3.0;
const PDF_BASE_SCALE = 1.25;

function isZoomable(ext: string) {
	return ext === "pdf";
}

function StreamViewer({
	streamingUrl,
	fileName,
}: {
	streamingUrl: string;
	fileName: string;
}) {
	const ext = getExt(fileName);
	if (ext === "mp4")
		return (
			// biome-ignore lint/a11y/useMediaCaption: ユーザーアップロード動画のプレビュー
			<video
				src={streamingUrl}
				controls
				className={styles.video}
				preload="none"
			/>
		);
	return <img src={streamingUrl} className={styles.image} alt={fileName} />;
}

function BlobViewer({ file, scale }: { file: File; scale: number }) {
	const ext = getExt(file.name);

	if (ext === "pdf")
		return <PdfViewer file={file} scale={scale * PDF_BASE_SCALE} />;
	if (ext === "xlsx" || ext === "xls") return <ExcelViewer file={file} />;
	if (ext === "docx") return <WordViewer file={file} />;

	// 未アップロードの画像・動画も即プレビュー可能に
	if (isStreamable(ext)) {
		return <StreamableBlobViewer file={file} />;
	}

	return (
		<div className={styles.unsupported}>
			{ext ? (
				<Text size="2">この形式はブラウザでプレビューできません：.{ext}</Text>
			) : (
				<Text size="2">ファイルを表示できません</Text>
			)}
		</div>
	);
}

/** File オブジェクトを直接 media srcObject にセットして再生（URL.createObjectURL のセキュリティ問題を回避） */
function StreamableBlobViewer({ file }: { file: File }) {
	const ext = getExt(file.name);
	if (ext === "mp4") {
		return <VideoFilePlayer file={file} />;
	}

	// 画像は URL.createObjectURL を使う（img は srcObject 非対応）
	return <ImageFilePlayer file={file} />;
}

function ImageFilePlayer({ file }: { file: File }) {
	const [url, setUrl] = useState<string>("");

	useEffect(() => {
		const objectUrl = URL.createObjectURL(file);
		setUrl(objectUrl);
		return () => {
			URL.revokeObjectURL(objectUrl);
		};
	}, [file]);

	if (!url) return null;
	return <img src={url} className={styles.image} alt={file.name} />;
}

function VideoFilePlayer({ file }: { file: File }) {
	const videoRef = useRef<HTMLVideoElement>(null);
	const urlRef = useRef<string>("");

	useEffect(() => {
		const el = videoRef.current;
		if (!el) return;
		const url = URL.createObjectURL(file);
		urlRef.current = url;
		el.src = url;
		return () => {
			el.pause();
			el.src = "";
			if (urlRef.current) {
				URL.revokeObjectURL(urlRef.current);
				urlRef.current = "";
			}
		};
	}, [file]);

	return (
		// biome-ignore lint/a11y/useMediaCaption: ユーザーアップロード動画のプレビュー
		<video ref={videoRef} controls className={styles.video} preload="none" />
	);
}

export default function FilePreviewDialog({
	file,
	streamingUrl,
	fileName,
	open,
	onOpenChange,
	onDownload,
	loading,
}: Props) {
	const [scale, setScale] = useState(1.0);

	const displayName = fileName ?? file?.name ?? "";
	const ext = getExt(displayName);
	const showZoom = isZoomable(ext);
	const isStream = isStreamable(ext);

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset zoom on file change
	useEffect(() => {
		setScale(1.0);
	}, [displayName]);

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Content className={styles.content}>
				<VisuallyHidden>
					<Dialog.Title>{displayName}</Dialog.Title>
				</VisuallyHidden>
				<div className={styles.header}>
					<Text size="3" weight="medium" className={styles.title}>
						{displayName}
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
					{loading && !file && !streamingUrl ? (
						<div className={styles.loading}>
							<Spinner size="3" />
						</div>
					) : isStream && streamingUrl ? (
						<StreamViewer streamingUrl={streamingUrl} fileName={displayName} />
					) : file ? (
						<BlobViewer file={file} scale={scale} />
					) : (
						<div className={styles.unsupported}>
							<Text size="2">ファイルを表示できません</Text>
						</div>
					)}
				</div>
			</Dialog.Content>
		</Dialog.Root>
	);
}
