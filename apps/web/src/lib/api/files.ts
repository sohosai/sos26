import type {
	AllowedMimeType,
	ConfirmUploadResponse,
	FileTokenResponse,
	ListFilesResponse,
	RequestDownloadUrlResponse,
} from "@sos26/shared";
import {
	abortMultipartUploadEndpoint,
	allowedFileExtensions,
	completeMultipartUploadEndpoint,
	confirmUploadEndpoint,
	deleteFileEndpoint,
	getFileTokenEndpoint,
	initiateMultipartUploadEndpoint,
	isAllowedFileType,
	listFilesEndpoint,
	MULTIPART_CHUNK_SIZE,
	requestDownloadUrlEndpoint,
	requestPreviewUrlEndpoint,
	requestUploadUrlEndpoint,
	resolveFileMimeType,
	shouldUseMultipart,
} from "@sos26/shared";
import { toast } from "sonner";
import { env } from "../env";
import { callBodyApi, callGetApi, callNoBodyApi } from "./core";

/**
 * Presigned PUT URL を要求する（シングルアップロード用）
 */
export async function requestUploadUrl(params: {
	fileName: string;
	mimeType: string;
	size: number;
	isPublic?: boolean;
}) {
	return callBodyApi(requestUploadUrlEndpoint, {
		fileName: params.fileName,
		mimeType: params.mimeType as AllowedMimeType,
		size: params.size,
		isPublic: params.isPublic ?? false,
	});
}

/**
 * マルチパートアップロードを開始する
 */
export async function initiateMultipartUpload(params: {
	fileName: string;
	mimeType: string;
	size: number;
	isPublic?: boolean;
	partCount: number;
}) {
	return callBodyApi(initiateMultipartUploadEndpoint, {
		fileName: params.fileName,
		mimeType: params.mimeType as AllowedMimeType,
		size: params.size,
		isPublic: params.isPublic ?? false,
		partCount: params.partCount,
	});
}

/**
 * マルチパートアップロードを完了する
 */
export async function completeMultipartUpload(params: {
	fileId: string;
	uploadId: string;
}) {
	return callBodyApi(completeMultipartUploadEndpoint, {
		fileId: params.fileId,
		uploadId: params.uploadId,
	});
}

/**
 * マルチパートアップロードを中止する
 */
export async function abortMultipartUpload(params: {
	fileId: string;
	uploadId: string;
}) {
	return callBodyApi(abortMultipartUploadEndpoint, {
		fileId: params.fileId,
		uploadId: params.uploadId,
	});
}

/**
 * アップロード完了を通知する（シングルアップロード用）
 */
export async function confirmUpload(
	fileId: string
): Promise<ConfirmUploadResponse> {
	return callBodyApi(confirmUploadEndpoint, {}, { pathParams: { id: fileId } });
}

/**
 * 自分のファイル一覧を取得する
 */
export async function listFiles(): Promise<ListFilesResponse> {
	return callGetApi(listFilesEndpoint);
}

/**
 * ファイルをソフトデリートする
 */
export async function deleteFile(fileId: string) {
	return callNoBodyApi(deleteFileEndpoint, {
		pathParams: { id: fileId },
	});
}

/**
 * S3 直ダウンロード用 Presigned URL を要求する（attachment）
 */
export async function requestDownloadUrl(
	fileId: string
): Promise<RequestDownloadUrlResponse> {
	return callNoBodyApi(requestDownloadUrlEndpoint, {
		pathParams: { id: fileId },
	});
}

/**
 * S3 直プレビュー用 Presigned URL を要求する（inline）
 */
export async function requestPreviewUrl(
	fileId: string
): Promise<{ previewUrl: string }> {
	return callNoBodyApi(requestPreviewUrlEndpoint, {
		pathParams: { id: fileId },
	});
}

/**
 * ファイルコンテンツ URL を取得する
 */
export function getFileContentUrl(fileId: string): string {
	return `${env.VITE_API_BASE_URL}/files/${fileId}/content`;
}

/**
 * 非公開ファイル用のトークンを取得する
 */
export async function getFileToken(fileId: string): Promise<FileTokenResponse> {
	return callGetApi(getFileTokenEndpoint, { pathParams: { id: fileId } });
}

/**
 * 非公開ファイルのトークン付き URL を取得する
 */
export async function getAuthenticatedFileUrl(fileId: string): Promise<string> {
	const { token } = await getFileToken(fileId);
	return `${env.VITE_API_BASE_URL}/files/${fileId}/content?token=${encodeURIComponent(token)}`;
}

// ── プレビュー Blob URL キャッシュ ──────────────────────────

/** ファイルID → { Blob, 参照カウント } のキャッシュ */
const previewBlobCache = new Map<
	string,
	{ blob: Blob; fileName: string; mimeType: string; refCount: number }
>();

function getCachedBlob(key: {
	fileId: string;
	fileName: string;
	mimeType: string;
}) {
	const entry = previewBlobCache.get(key.fileId);
	if (
		entry &&
		entry.fileName === key.fileName &&
		entry.mimeType === key.mimeType
	) {
		entry.refCount++;
		return entry.blob;
	}
	return undefined;
}

function setCachedBlob(
	key: { fileId: string; fileName: string; mimeType: string },
	blob: Blob
) {
	previewBlobCache.set(key.fileId, {
		blob,
		fileName: key.fileName,
		mimeType: key.mimeType,
		refCount: 1,
	});
}

function releaseCachedBlob(fileId: string) {
	const entry = previewBlobCache.get(fileId);
	if (entry) {
		entry.refCount--;
		if (entry.refCount <= 0) {
			previewBlobCache.delete(fileId);
		}
	}
}

/**
 * ファイルを取得して File オブジェクトとして返す。
 * ダウンロードした Blob はキャッシュし、2 回目以降の取得を高速化する。
 */
export async function fetchFile(
	fileId: string,
	fileName: string,
	mimeType: string,
	isPublic: boolean
): Promise<File> {
	const cached = getCachedBlob({ fileId, fileName, mimeType });
	if (cached) {
		return new File([cached], fileName, { type: mimeType });
	}

	const url = isPublic
		? getFileContentUrl(fileId)
		: await getAuthenticatedFileUrl(fileId);
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`ファイルの取得に失敗しました (${res.status})`);
	}
	const blob = await res.blob();
	setCachedBlob({ fileId, fileName, mimeType }, blob);
	return new File([blob], fileName, { type: mimeType });
}

/**
 * プレビュー用に取得したファイルをキャッシュから解放する。
 * FilePreviewDialog の onOpenChange で open === false の際に呼ぶ。
 */
export function releasePreviewFile(fileId: string) {
	releaseCachedBlob(fileId);
}

/**
 * S3 直ダウンロード URL を使ってファイルをストリーミングダウンロードする。
 *
 * StreamSaver を使い、fetch の ReadableStream をそのままファイルに書き込む。
 * 大容量ファイルでもメモリに展開せずにダウンロードできる。
 */
export async function downloadFile(
	fileId: string,
	fileName: string,
	downloadFileName?: string
): Promise<void> {
	const { downloadUrl } = await requestDownloadUrl(fileId);

	const res = await fetch(downloadUrl, {
		method: "GET",
		credentials: "omit",
	});
	if (!res.ok) {
		throw new Error(
			`ファイルのダウンロードに失敗しました: ${res.status} ${res.statusText}`
		);
	}

	const streamBody = res.body;
	if (!streamBody) {
		throw new Error("レスポンスボディが空です");
	}

	const StreamSaver = await import("streamsaver");
	const streamSaver = StreamSaver.default;

	const fileStream = streamSaver.createWriteStream(
		downloadFileName ?? fileName
	);
	const writer = fileStream.getWriter();

	try {
		const reader = streamBody.getReader();
		let done = false;

		while (!done) {
			const { done: streamDone, value } = await reader.read();
			done = streamDone;
			if (value) {
				await writer.write(value);
			}
		}
	} finally {
		writer.close();
	}
}

/**
 * 1つのパートを S3 に PUT アップロードする（ETag は取得しない）。
 */
async function uploadPart(
	url: string,
	chunk: Blob,
	mimeType: string,
	partNumber: number,
	options?: {
		signal?: AbortSignal;
		onPartProgress?: (
			partNumber: number,
			loaded: number,
			total: number
		) => void;
	}
): Promise<void> {
	if (!options?.onPartProgress) {
		const res = await fetch(url, {
			method: "PUT",
			body: chunk,
			headers: { "Content-Type": mimeType },
			signal: options?.signal,
		});
		if (!res.ok) {
			throw new Error(`S3 part upload failed: ${res.status} ${res.statusText}`);
		}
		return;
	}

	// XMLHttpRequest で upload progress を取得
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open("PUT", url);
		xhr.setRequestHeader("Content-Type", mimeType);

		if (options?.signal) {
			options.signal.addEventListener("abort", () => {
				xhr.abort();
				reject(new Error("Upload aborted"));
			});
		}

		xhr.upload.addEventListener("progress", event => {
			if (event.lengthComputable) {
				options.onPartProgress?.(partNumber, event.loaded, event.total);
			}
		});

		xhr.addEventListener("load", () => {
			if (xhr.status >= 200 && xhr.status < 300) {
				resolve();
			} else {
				reject(
					new Error(`S3 part upload failed: ${xhr.status} ${xhr.statusText}`)
				);
			}
		});

		xhr.addEventListener("error", () => {
			reject(new Error("S3 part upload failed: network error"));
		});

		xhr.addEventListener("abort", () => {
			reject(new Error("Upload aborted"));
		});

		xhr.send(chunk);
	});
}

/**
 * マルチパート（分割）アップロードを実行する。
 * ETag は一切取得せず、パートを S3 に送るだけ。
 */
async function performMultipartUpload(params: {
	file: File;
	partUrls: string[];
	signal?: AbortSignal;
	onPartProgress?: (partNumber: number, loaded: number, total: number) => void;
	onUploadProgress?: (ratio: number) => void;
}): Promise<void> {
	const { file, partUrls, signal, onPartProgress, onUploadProgress } = params;

	// 同時アップロード数を制限（メモリ・帯域の観点から）
	const CONCURRENCY = 5;
	let index = 0;

	// パートごとの送信済みバイト数で全体進捗を計算
	const partProgresses = new Array<number>(partUrls.length).fill(0);

	function reportProgress(partNumber: number, loaded: number) {
		partProgresses[partNumber - 1] = loaded;
		if (onUploadProgress) {
			const totalLoaded = partProgresses.reduce((a, b) => a + b, 0);
			onUploadProgress(totalLoaded / file.size);
		}
	}

	async function worker() {
		while (index < partUrls.length) {
			const i = index++;
			const url = partUrls[i];
			if (!url) continue;
			const start = i * MULTIPART_CHUNK_SIZE;
			const end = Math.min(start + MULTIPART_CHUNK_SIZE, file.size);
			const chunk = file.slice(start, end);

			await uploadPart(url, chunk, file.type, i + 1, {
				signal,
				onPartProgress: onPartProgress
					? (pn, loaded, total) => {
							onPartProgress(pn, loaded, total);
							reportProgress(pn, loaded);
						}
					: (pn, loaded) => {
							reportProgress(pn, loaded);
						},
			});
		}
	}

	const workers = Array.from(
		{ length: Math.min(CONCURRENCY, partUrls.length) },
		() => worker()
	);
	await Promise.all(workers);
}

/**
 * アップロード進捗コールバックの型
 */
export interface UploadProgressHandlers {
	/** アップロード進捗（0~1） */
	onUploadProgress?: (ratio: number) => void;
	/** 各パートの進捗（詳細） */
	onPartProgress?: (partNumber: number, loaded: number, total: number) => void;
}

/**
 * ファイルをアップロードする。
 *
 * ファイルサイズが 5MB を超える場合は S3 マルチパートアップロードを使用し、
 * 複数のパートを並列で送信します。
 *
 * @param file     アップロードするファイル
 * @param options  アップロードオプション
 * @returns        アップロードされたファイル情報
 */
export async function uploadFile(
	file: File,
	options?: {
		isPublic?: boolean;
		signal?: AbortSignal;
	} & UploadProgressHandlers
): Promise<ConfirmUploadResponse> {
	// 0. クライアントサイドで MIME タイプをチェック
	if (!isAllowedFileType(file)) {
		throw new Error(
			`対応していないファイル形式です。アップロードできるファイル形式: ${allowedFileExtensions}`
		);
	}
	const fileMimeType = resolveFileMimeType(file);

	const toastId = toast.loading(`「${file.name}」をアップロード中…`, {
		duration: Number.POSITIVE_INFINITY,
	});

	// 進捗をパーセント表示するヘルパー
	function formatPercent(ratio: number): string {
		return `${Math.min(100, Math.round(ratio * 100))}%`;
	}

	function updateToastPercent(ratio: number) {
		toast.loading(`「${file.name}」をアップロード中… ${formatPercent(ratio)}`, {
			id: toastId,
			duration: Number.POSITIVE_INFINITY,
		});
	}

	try {
		// 1. ファイルサイズに応じてシングル / マルチパートを判定
		if (shouldUseMultipart(file.size)) {
			// マルチパート
			const partCount = Math.ceil(file.size / MULTIPART_CHUNK_SIZE);

			const { fileId, uploadId, partUrls } = await initiateMultipartUpload({
				fileName: file.name,
				mimeType: fileMimeType,
				size: file.size,
				isPublic: options?.isPublic,
				partCount,
			});

			try {
				await performMultipartUpload({
					file,
					partUrls,
					signal: options?.signal,
					onPartProgress: options?.onPartProgress,
					onUploadProgress: ratio => {
						updateToastPercent(ratio);
						options?.onUploadProgress?.(ratio);
					},
				});
			} catch (error) {
				// アップロード失敗時はマルチパートを中止
				await abortMultipartUpload({ fileId, uploadId }).catch(() => {
					// 中止も失敗しても無視
				});
				throw error;
			}

			// サーバー側で parts を自動収集して完了
			const result = await completeMultipartUpload({ fileId, uploadId });
			toast.success(`「${file.name}」のアップロードが完了しました`, {
				id: toastId,
				duration: 3000,
			});
			return result;
		}

		// シングルアップロード
		const { fileId, uploadUrl } = await requestUploadUrl({
			fileName: file.name,
			mimeType: file.type,
			size: file.size,
			isPublic: options?.isPublic,
		});

		updateToastPercent(0.5); // 推定進捗（URL 取得まで完了）

		const res = await fetch(uploadUrl, {
			method: "PUT",
			body: file,
			headers: { "Content-Type": file.type },
			signal: options?.signal,
		});

		if (!res.ok) {
			throw new Error(
				`S3 アップロードに失敗しました: ${res.status} ${res.statusText}`
			);
		}

		const result = await confirmUpload(fileId);
		toast.success(`「${file.name}」のアップロードが完了しました`, {
			id: toastId,
			duration: 3000,
		});
		return result;
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "アップロードに失敗しました";
		toast.error(`「${file.name}」の${message}`, {
			id: toastId,
			duration: 5000,
		});
		throw error;
	}
}
