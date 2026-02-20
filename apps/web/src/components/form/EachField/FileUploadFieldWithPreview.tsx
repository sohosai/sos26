import { IconFileSearch } from "@tabler/icons-react";
import { useState } from "react";
import FilePreviewDialog from "@/components/filePreview/FilePreviewDialog";
import { IconButton } from "@/components/primitives";
import { FileUploadField } from "./FileUploadField";
import styles from "./FileUploadFieldWithPreview.module.scss";

type FileUploadProps = {
	label: string;
	value?: File | null;
	onChange: (file: File | null) => void;
	required?: boolean;
	disabled?: boolean;
};

export function FileUploadFieldWithPreview({
	label,
	value,
	onChange,
	required,
	disabled,
}: FileUploadProps) {
	const [file, setFile] = useState<File | null>(null);
	const [open, setOpen] = useState(false);

	const handleChange = (file: File | null) => {
		setFile(file);
		onChange(file);
	};
	return (
		<div className={styles.container}>
			<FileUploadField
				label={label}
				value={file ?? value}
				onChange={handleChange}
				required={required}
				disabled={disabled}
			/>
			{file && (
				<div className={styles.preview}>
					<IconButton onClick={() => setOpen(true)}>
						<IconFileSearch size={16} />
					</IconButton>
				</div>
			)}
			<FilePreviewDialog file={file} open={open} onOpenChange={setOpen} />
		</div>
	);
}
