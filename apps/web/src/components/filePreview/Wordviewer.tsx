import { renderAsync } from "docx-preview";
import { useEffect, useRef } from "react";
import styles from "./WordViewer.module.scss";

interface Props {
	file: File;
}

export default function WordViewer({ file }: Props) {
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!file || !containerRef.current) return;

		const renderDocx = async () => {
			if (!containerRef.current) return;
			// 前回の描画をクリア
			containerRef.current.innerHTML = "";

			const arrayBuffer = await file.arrayBuffer();

			await renderAsync(arrayBuffer, containerRef.current, undefined, {
				className: "docx-preview",
				inWrapper: true,
				ignoreWidth: false,
				ignoreHeight: false,
			});
		};

		renderDocx();
	}, [file]);
	return (
		<div className={styles.page}>
			<div ref={containerRef} className={styles.viewer} />
		</div>
	);
}
