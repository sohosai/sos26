import { Text } from "@radix-ui/themes";
import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import styles from "./PdfViewer.module.scss";

// workerを読み込む
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
	"pdfjs-dist/build/pdf.worker.min.mjs",
	import.meta.url
).toString();

interface Props {
	file: File;
}

export default function PdfViewer({ file }: Props) {
	const [numPages, setNumPages] = useState<number>(0);
	const [isLoading, setIsLoading] = useState(true);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	return (
		<div className={styles.root}>
			{isLoading && (
				<Text size="2" className={styles.status}>
					PDFを読み込み中です...
				</Text>
			)}
			{errorMessage && (
				<Text size="2" className={styles.status}>
					{errorMessage}
				</Text>
			)}
			<Document
				file={file}
				onLoadSuccess={({ numPages }) => {
					setNumPages(numPages);
					setIsLoading(false);
					setErrorMessage(null);
				}}
				onLoadError={() => {
					setIsLoading(false);
					setErrorMessage("PDFの読み込みに失敗しました。");
				}}
			>
				{/* ページ番号は固定順序で並び替わらないためindexをkeyに使用 */}
				{!errorMessage &&
					Array.from({ length: numPages }, (_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: ページ番号は固定順序
						<Page key={i + 1} pageNumber={i + 1} />
					))}
			</Document>
		</div>
	);
}
