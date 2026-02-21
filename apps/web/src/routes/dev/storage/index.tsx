import type { FileInfo } from "@sos26/shared";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	deleteFile,
	getAuthenticatedFileUrl,
	listFiles,
	uploadFile,
} from "@/lib/api/files";
import { useStorageUrl } from "@/lib/storage";

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
								<FileRow
									key={file.id}
									file={file}
									loading={loading}
									onDelete={handleDelete}
								/>
							))}
						</tbody>
					</table>
				)}
			</section>

			<AccessVerificationSection />
		</div>
	);
}

function AccessVerificationSection() {
	const [fileId, setFileId] = useState("");
	const [verifyLoading, setVerifyLoading] = useState(false);
	const [result, setResult] = useState<{
		type: "success" | "error";
		url?: string;
		mimeType?: string;
		message?: string;
	} | null>(null);

	const handleVerify = async () => {
		const trimmed = fileId.trim();
		if (!trimmed) return;

		setVerifyLoading(true);
		setResult(null);

		try {
			const url = await getAuthenticatedFileUrl(trimmed);
			// HEAD リクエストでファイルの MIME タイプを取得
			const res = await fetch(url, { method: "HEAD" });
			if (!res.ok) {
				setResult({
					type: "error",
					message: `エラー: ${String(res.status)} ${res.statusText}`,
				});
				return;
			}
			const mimeType = res.headers.get("Content-Type") ?? "";
			setResult({ type: "success", url, mimeType });
		} catch (error) {
			const message = error instanceof Error ? error.message : "不明なエラー";
			setResult({ type: "error", message: `アクセス失敗: ${message}` });
		} finally {
			setVerifyLoading(false);
		}
	};

	return (
		<section>
			<h2>アクセス検証</h2>
			<p style={{ color: "#666", fontSize: 14 }}>
				ファイルIDを入力して、アクセス権限を確認できます。自分がアップロードした非公開ファイルはアクセス成功、他人のファイルは
				403 になります。
			</p>
			<div style={{ display: "flex", gap: 8, alignItems: "center" }}>
				<input
					type="text"
					placeholder="ファイルID"
					value={fileId}
					onChange={e => setFileId(e.target.value)}
					style={{ flex: 1, padding: 6 }}
				/>
				<button
					onClick={handleVerify}
					disabled={verifyLoading || !fileId.trim()}
					type="button"
				>
					{verifyLoading ? "確認中..." : "アクセスを試す"}
				</button>
			</div>

			{result && (
				<div
					style={{
						marginTop: 12,
						padding: 12,
						background: result.type === "success" ? "#e8f5e9" : "#ffebee",
						borderRadius: 4,
					}}
				>
					{result.type === "success" && result.url ? (
						<div>
							<p style={{ color: "#2e7d32", marginBottom: 8 }}>アクセス成功</p>
							{result.mimeType?.startsWith("image/") ? (
								<img
									src={result.url}
									alt="プレビュー"
									style={{ maxWidth: 300, maxHeight: 300 }}
								/>
							) : (
								<a href={result.url} target="_blank" rel="noreferrer">
									ファイルを開く
								</a>
							)}
						</div>
					) : (
						<p style={{ color: "#c62828" }}>{result.message}</p>
					)}
				</div>
			)}
		</section>
	);
}

function FileRow({
	file,
	loading,
	onDelete,
}: {
	file: FileInfo;
	loading: boolean;
	onDelete: (fileId: string) => void;
}) {
	const url = useStorageUrl(file.id, file.isPublic);
	const isImage = file.mimeType.startsWith("image/");

	return (
		<tr>
			<td style={tdStyle}>
				{url ? (
					isImage ? (
						<img
							src={url}
							alt={file.fileName}
							style={{ maxWidth: 80, maxHeight: 80, objectFit: "contain" }}
						/>
					) : (
						<a href={url} target="_blank" rel="noreferrer">
							表示
						</a>
					)
				) : (
					<span>読込中...</span>
				)}
			</td>
			<td style={tdStyle}>{file.fileName}</td>
			<td style={tdStyle}>{file.mimeType}</td>
			<td style={tdStyle}>{formatSize(file.size)}</td>
			<td style={tdStyle}>{file.isPublic ? "Yes" : "No"}</td>
			<td style={tdStyle}>
				<button
					onClick={() => onDelete(file.id)}
					disabled={loading}
					type="button"
				>
					削除
				</button>
			</td>
		</tr>
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
