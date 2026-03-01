import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { FileUploadFieldWithPreview } from "@/components/form/EachField/FileUploadFieldWithPreview";
import styles from "./index.module.scss";
export const Route = createFileRoute("/dev/filePreview/")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<div className={styles.root}>
			<FileUploadFieldWithPreview
				label={"ファイルをアップロード"}
				onChange={() => toast.success("ファイルアップロード")}
			/>
		</div>
	);
}
