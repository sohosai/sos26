import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { FileUploadField } from "@/components/form/EachField/FileUploadField";
import styles from "./index.module.scss";
export const Route = createFileRoute("/dev/filePreview/")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<div className={styles.root}>
			<FileUploadField
				label={"ファイルをアップロード"}
				onChange={() => toast.success("ファイルアップロード")}
			/>
		</div>
	);
}
