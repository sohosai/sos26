import { useEffect, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { IconButton } from "../primitives";
import styles from "./PdfViewer.module.scss";

// workerはvite用に静的アセットとして読み込む
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
	"pdfjs-dist/build/pdf.worker.min.mjs",
	import.meta.url
).toString();

interface Props {
	file: File;
}

export default function PdfViewer({ file }: Props) {
	const [numPages, setNumPages] = useState<number>(0);
	const [page, setPage] = useState(1);
	const [isLoading, setIsLoading] = useState(true);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	useEffect(() => {
		setIsLoading(true);
		setErrorMessage(null);
		setNumPages(0);
		setPage(1);
	}, []);

	return (
		<div className={styles.root}>
			<div className={styles.toolbar}>
				<IconButton
					aria-label="前のページ"
					onClick={() => setPage(p => Math.max(1, p - 1))}
					disabled={page <= 1}
				>
					<IconChevronLeft size={16} />
				</IconButton>
				<span aria-live="polite">
					{page} / {numPages}
				</span>
				<IconButton
					aria-label="次のページ"
					onClick={() => setPage(p => Math.min(numPages, p + 1))}
					disabled={page >= numPages}
				>
					<IconChevronRight size={16} />
				</IconButton>
			</div>
			<div className={styles.canvas}>
				{isLoading && (
					<span className={styles.status}>PDFを読み込み中です...</span>
				)}
				{errorMessage && <span className={styles.status}>{errorMessage}</span>}
				<Document
					file={file}
					onLoadSuccess={({ numPages }) => {
						setNumPages(numPages);
						setPage(1);
						setIsLoading(false);
						setErrorMessage(null);
					}}
					onLoadError={() => {
						setIsLoading(false);
						setErrorMessage("PDFの読み込みに失敗しました。");
					}}
				>
					{!errorMessage && <Page pageNumber={page} />}
				</Document>
			</div>
		</div>
	);
}
