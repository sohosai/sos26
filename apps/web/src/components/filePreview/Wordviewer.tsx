import { renderAsync } from "docx-preview";
import { useEffect, useRef, useState } from "react";
import styles from "./WordViewer.module.scss";

interface Props {
	file: File;
}

export default function WordViewer({ file }: Props) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [status, setStatus] = useState<string>(
		"Wordファイルを読み込み中です..."
	);
	useEffect(() => {
		if (!file || !containerRef.current) return;
		let cancelled = false;
		setStatus("Wordファイルを読み込み中です...");
		const renderDocx = async () => {
			try {
				if (!containerRef.current) return;
				containerRef.current.innerHTML = "";

				const arrayBuffer = await file.arrayBuffer();

				await renderAsync(arrayBuffer, containerRef.current, undefined, {
					className: "docx-preview",
					inWrapper: true,
					ignoreWidth: false,
					ignoreHeight: false,
				});

				if (!cancelled) setStatus("");
			} catch {
				if (!cancelled) {
					setStatus("Wordファイルの読み込みに失敗しました。");
				}
			}
		};

		renderDocx();
		return () => {
			cancelled = true;
			if (containerRef.current) {
				containerRef.current.innerHTML = "";
			}
		};
	}, [file]);
	return (
		<div className={styles.page}>
			{status && <p className={styles.status}>{status}</p>}
			<div ref={containerRef} className={styles.viewer} />
		</div>
	);
}
