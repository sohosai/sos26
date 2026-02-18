import { useState } from "react";
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
	url: string;
}

export default function PdfViewer({ url }: Props) {
	const [numPages, setNumPages] = useState<number>(0);
	const [page, setPage] = useState(1);

	return (
		<div className={styles.root}>
			<div className={styles.toolbar}>
				<IconButton
					onClick={() => setPage(p => Math.max(1, p - 1))}
					disabled={page <= 1}
				>
					<IconChevronLeft size={16} />
				</IconButton>
				<span>
					{page} / {numPages}
				</span>
				<IconButton
					onClick={() => setPage(p => Math.min(numPages, p + 1))}
					disabled={page >= numPages}
				>
					<IconChevronRight size={16} />
				</IconButton>
			</div>
			<div className={styles.canvas}>
				<Document
					file={url}
					onLoadSuccess={({ numPages }) => {
						setNumPages(numPages);
						setPage(1);
					}}
				>
					<Page pageNumber={page} />
				</Document>
			</div>
		</div>
	);
}
