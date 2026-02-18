import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import FilePreviewDialog from "@/components/filePreview/FilePreviewDialog";
import { FileUploadField } from "@/components/form/EachField/FileUploadField";
import styles from "./index.module.scss";

export const Route = createFileRoute("/dev/filePreview/")({
	component: RouteComponent,
});

function RouteComponent() {
	const [file, setFile] = useState<File | null>(null);
	const [open, setOpen] = useState(false);

	const handleChange = (file: File | null) => {
		if (!file) return;
		setFile(file);
		setOpen(true);
	};
	return (
		<div className={styles.root}>
			<FileUploadField
				label={"ファイルを開いてプレビュー"}
				value={file}
				onChange={handleChange}
			/>

			<FilePreviewDialog file={file} open={open} onOpenChange={setOpen} />
		</div>
	);
}
