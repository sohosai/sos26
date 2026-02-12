import type { FileInfo } from "@sos26/shared";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	deleteFile,
	getFileContentUrl,
	listFiles,
	uploadFile,
} from "@/lib/api/files";

export const Route = createFileRoute("/dev/storage/")({
	component: StorageDevPage,
});

function StorageDevPage() {
	const [files, setFiles] = useState<FileInfo[]>([]);
	const [status, setStatus] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [isPublic, setIsPublic] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const fetchFiles = useCallback(async () => {
		try {
			const response = await listFiles();
			setFiles(response.files);
		} catch (error) {
			console.error(error);
			setStatus("ファイル一覧の取得に失敗しました");
		}
	}, []);

	useEffect(() => {
		fetchFiles();
	}, [fetchFiles]);

	const handleUpload = async () => {
		const input = fileInputRef.current;
		if (!input?.files?.[0]) {
			setStatus("ファイルを選択してください");
			return;
		}

		const file = input.files[0];
		setLoading(true);
		setStatus(null);

		try {
			const result = await uploadFile(file, { isPublic });
			setStatus(
				`アップロード完了: ${result.file.fileName} (${result.file.id})`
			);
			input.value = "";
			await fetchFiles();
		} catch (error) {
			console.error(error);
			setStatus(
				`アップロード失敗: ${error instanceof Error ? error.message : "不明なエラー"}`
			);
		} finally {
			setLoading(false);
		}
	};

	const handleDelete = async (fileId: string) => {
		setLoading(true);
		setStatus(null);
		try {
			await deleteFile(fileId);
			setStatus("ファイルを削除しました");
			await fetchFiles();
		} catch (error) {
			console.error(error);
			setStatus("ファイルの削除に失敗しました");
		} finally {
			setLoading(false);
		}
	};

	const isImage = (mimeType: string) => mimeType.startsWith("image/");

	return (
		<div style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
			<h1>ストレージテスト（開発用）</h1>

			<section>
				<h2>ファイルアップロード</h2>
				<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
					<input
						ref={fileInputRef}
						type="file"
						accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,.docx,.xlsx"
					/>
					<label>
						<input
							type="checkbox"
							checked={isPublic}
							onChange={e => setIsPublic(e.target.checked)}
						/>
						公開ファイル
					</label>
					<button
						onClick={handleUpload}
						disabled={loading}
						type="button"
						style={{ width: "fit-content" }}
					>
						{loading ? "アップロード中..." : "アップロード"}
					</button>
				</div>
			</section>

			{status && (
				<p style={{ padding: 8, background: "#f0f0f0", borderRadius: 4 }}>
					{status}
				</p>
			)}

			<section>
				<h2>
					ファイル一覧
					<button
						onClick={fetchFiles}
						disabled={loading}
						type="button"
						style={{ marginLeft: 8, fontSize: 14 }}
					>
						更新
					</button>
				</h2>

				{files.length === 0 ? (
					<p>ファイルなし</p>
				) : (
					<table style={{ width: "100%", borderCollapse: "collapse" }}>
						<thead>
							<tr>
								<th style={thStyle}>プレビュー</th>
								<th style={thStyle}>ファイル名</th>
								<th style={thStyle}>MIMEタイプ</th>
								<th style={thStyle}>サイズ</th>
								<th style={thStyle}>公開</th>
								<th style={thStyle}>操作</th>
							</tr>
						</thead>
						<tbody>
							{files.map(file => (
								<tr key={file.id}>
									<td style={tdStyle}>
										{isImage(file.mimeType) ? (
											<img
												src={getFileContentUrl(file.id)}
												alt={file.fileName}
												style={{
													maxWidth: 80,
													maxHeight: 80,
													objectFit: "contain",
												}}
											/>
										) : (
											<a
												href={getFileContentUrl(file.id)}
												target="_blank"
												rel="noreferrer"
											>
												表示
											</a>
										)}
									</td>
									<td style={tdStyle}>{file.fileName}</td>
									<td style={tdStyle}>{file.mimeType}</td>
									<td style={tdStyle}>{formatSize(file.size)}</td>
									<td style={tdStyle}>{file.isPublic ? "Yes" : "No"}</td>
									<td style={tdStyle}>
										<button
											onClick={() => handleDelete(file.id)}
											disabled={loading}
											type="button"
										>
											削除
										</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</section>
		</div>
	);
}

function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const thStyle: React.CSSProperties = {
	textAlign: "left",
	padding: 8,
	borderBottom: "2px solid #ddd",
};

const tdStyle: React.CSSProperties = {
	padding: 8,
	borderBottom: "1px solid #eee",
	verticalAlign: "middle",
};
