import { useEffect, useState } from "react";
import { getAuthenticatedFileUrl, getFileContentUrl } from "./api/files";

/**
 * ストレージ上のファイル URL を返すフック
 *
 * - 公開ファイル → 即座に URL を返す
 * - 非公開ファイル → トークン付き URL を非同期取得して返す
 *
 * @returns URL 文字列。非公開ファイルのトークン取得中は null
 */
export function useStorageUrl(
	fileId: string,
	isPublic: boolean
): string | null {
	const [url, setUrl] = useState<string | null>(
		isPublic ? getFileContentUrl(fileId) : null
	);

	useEffect(() => {
		if (isPublic) {
			setUrl(getFileContentUrl(fileId));
			return;
		}

		let cancelled = false;
		setUrl(null);
		getAuthenticatedFileUrl(fileId).then(u => {
			if (!cancelled) setUrl(u);
		});
		return () => {
			cancelled = true;
		};
	}, [fileId, isPublic]);

	return url;
}
