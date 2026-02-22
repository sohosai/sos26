// import * as Dialog from "@radix-ui/react-dialog";
import { Dialog, Text } from "@radix-ui/themes";
import { IconX } from "@tabler/icons-react";
// import ExcelViewer from "./ExcelViewer";
import ExcelViewer_exceljs from "./ExcelViewer_exceljs";
import styles from "./FilePreviewDialog.module.scss";
import PdfViewer from "./Pdfviewer";
import WordViewer from "./Wordviewer";

interface Props {
	file: File | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

function getExt(file: File) {
	return file.name.split(".").pop()?.toLowerCase() ?? "";
}

function Viewer({ file }: { file: File }) {
	const ext = getExt(file);
	const url = URL.createObjectURL(file); // Dialog再マウント時に生成

	if (ext === "pdf") return <PdfViewer url={url} />;
	// if (ext === "xlsx" || ext === "xls") return <ExcelViewer file={file} />;
	if (ext === "xlsx" || ext === "xls")
		return <ExcelViewer_exceljs file={file} />;

	if (ext === "docx") return <WordViewer file={file} />;
	if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext))
		return <img src={url} className={styles.image} alt={file.name} />;

	return (
		<div className={styles.unsupported}>
			<Text size="2">非対応の形式です：.{ext}</Text>
		</div>
	);
}

export default function FilePreviewDialog({ file, open, onOpenChange }: Props) {
	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			{/* <Dialog.Portal> */}
			<Dialog.Content className={styles.content}>
				<div className={styles.header}>
					<Dialog.Title className={styles.title}>
						{file?.name ?? ""}
					</Dialog.Title>
					<Dialog.Close className={styles.closeBtn} aria-label="閉じる">
						<IconX size={20} />
					</Dialog.Close>
				</div>

				{/* プレビューエリア */}
				<div className={styles.body}>
					{file && <Viewer key={file.name + file.size} file={file} />}
				</div>
			</Dialog.Content>
			{/* </Dialog.Portal> */}
		</Dialog.Root>
	);
}
