import type {
	AllowedMimeType,
	ConfirmUploadResponse,
	FileTokenResponse,
	ListFilesResponse,
} from "@sos26/shared";
import {
	confirmUploadEndpoint,
	deleteFileEndpoint,
	getFileTokenEndpoint,
	listFilesEndpoint,
	requestUploadUrlEndpoint,
} from "@sos26/shared";
import { env } from "../env";
import { callBodyApi, callGetApi, callNoBodyApi } from "./core";

/**
 * Presigned PUT URL を要求する
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
 * アップロード完了を通知する
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

/**
 * ファイルをダウンロードする
 */
export async function downloadFile(
	fileId: string,
	fileName: string,
	isPublic: boolean
): Promise<void> {
	const url = isPublic
		? getFileContentUrl(fileId)
		: await getAuthenticatedFileUrl(fileId);
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`ファイルの取得に失敗しました (${res.status})`);
	}
	const blob = await res.blob();
	const objectUrl = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = objectUrl;
	a.download = fileName;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(objectUrl);
}

/**
 * 3ステップのアップロードフローをまとめたヘルパー
 *
 * 1. API に Presigned URL を要求
 * 2. S3 に直接 PUT（ky 不使用 - 認証ヘッダ不要のため）
 * 3. API にアップロード完了を通知
 */
export async function uploadFile(
	file: File,
	options?: { isPublic?: boolean }
): Promise<ConfirmUploadResponse> {
	// 1. Presigned URL を要求
	const { fileId, uploadUrl } = await requestUploadUrl({
		fileName: file.name,
		mimeType: file.type,
		size: file.size,
		isPublic: options?.isPublic,
	});

	// 2. S3 に直接 PUT
	const uploadResponse = await fetch(uploadUrl, {
		method: "PUT",
		body: file,
		headers: {
			"Content-Type": file.type,
		},
	});

	if (!uploadResponse.ok) {
		throw new Error(
			`S3 アップロードに失敗しました: ${uploadResponse.status} ${uploadResponse.statusText}`
		);
	}

	// 3. アップロード完了を通知
	return confirmUpload(fileId);
}
