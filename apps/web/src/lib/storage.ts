import { useEffect, useState } from "react";
import { getFileContentUrl, getFileToken } from "./api/files";
import { env } from "./env";

/** トークン期限の何ミリ秒前に更新するか */
const REFRESH_MARGIN_MS = 60_000;

/**
 * ストレージ上のファイル URL を返すフック
 *
 * - 公開ファイル → 即座に URL を返す
 * - 非公開ファイル → トークン付き URL を非同期取得し、期限前に自動更新する
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
		let timerId: ReturnType<typeof setTimeout>;

		const fetchAndSchedule = async () => {
			const { token, expiresAt } = await getFileToken(fileId);
			if (cancelled) return;

			setUrl(
				`${env.VITE_API_BASE_URL}/files/${fileId}/content?token=${encodeURIComponent(token)}`
			);

			// 期限の1分前に再取得をスケジュール
			const refreshIn =
				new Date(expiresAt).getTime() - Date.now() - REFRESH_MARGIN_MS;
			if (refreshIn > 0) {
				timerId = setTimeout(fetchAndSchedule, refreshIn);
			}
		};

		setUrl(null);
		fetchAndSchedule();

		return () => {
			cancelled = true;
			clearTimeout(timerId);
		};
	}, [fileId, isPublic]);

	return url;
}
