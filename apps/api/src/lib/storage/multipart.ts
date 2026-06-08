import {
	AbortMultipartUploadCommand,
	CompleteMultipartUploadCommand,
	CreateMultipartUploadCommand,
	ListPartsCommand,
	UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../env";
import { getStorageClient } from "./client";

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB – S3 multipart の最小パートサイズ

/**
 * チャンクサイズ（bytes）を返す。
 */
export function getChunkSize(): number {
	return CHUNK_SIZE;
}

/**
 * マルチパートアップロードを使うべきか判定する。
 * 5MB 超のファイルのみマルチパートを使う。
 */
export function shouldUseMultipart(fileSize: number): boolean {
	return fileSize > CHUNK_SIZE;
}

/**
 * マルチパートアップロードを新規作成し、UploadId を返す。
 */
export async function createMultipartUpload(
	key: string,
	mimeType: string
): Promise<string> {
	const client = getStorageClient();
	const command = new CreateMultipartUploadCommand({
		Bucket: env.S3_BUCKET,
		Key: key,
		ContentType: mimeType,
	});
	const response = await client.send(command);
	if (!response.UploadId) {
		throw new Error("Failed to create multipart upload: no UploadId returned");
	}
	return response.UploadId;
}

/**
 * 各パート用の Presigned PUT URL を生成する。
 */
export async function generatePartUploadUrls(
	key: string,
	uploadId: string,
	partCount: number
): Promise<string[]> {
	const client = getStorageClient();
	const urls: string[] = [];
	for (let partNumber = 1; partNumber <= partCount; partNumber++) {
		const command = new UploadPartCommand({
			Bucket: env.S3_BUCKET,
			Key: key,
			UploadId: uploadId,
			PartNumber: partNumber,
		});
		const url = await getSignedUrl(client, command, {
			expiresIn: env.S3_PRESIGNED_URL_EXPIRES,
		});
		urls.push(url);
	}
	return urls;
}

/**
 * S3 上にアップロードされたパートをリストアップする。
 */
export async function listMultipartParts(
	key: string,
	uploadId: string
): Promise<{ PartNumber: number; ETag: string }[]> {
	const client = getStorageClient();
	const command = new ListPartsCommand({
		Bucket: env.S3_BUCKET,
		Key: key,
		UploadId: uploadId,
	});
	const response = await client.send(command);
	const parts = response.Parts ?? [];
	return parts
		.filter(
			(p): p is typeof p & { PartNumber: number; ETag: string } =>
				p.PartNumber !== undefined && p.ETag !== undefined
		)
		.map(p => ({ PartNumber: p.PartNumber, ETag: p.ETag }));
}

/**
 * マルチパートアップロードを完了する。
 * 渡された parts をそのまま使う（外部から ETag を収集した場合）。
 */
export async function completeMultipartUpload(
	key: string,
	uploadId: string,
	parts: { PartNumber: number; ETag: string }[]
): Promise<void> {
	const client = getStorageClient();
	const command = new CompleteMultipartUploadCommand({
		Bucket: env.S3_BUCKET,
		Key: key,
		UploadId: uploadId,
		MultipartUpload: {
			Parts: parts,
		},
	});
	await client.send(command);
}

/**
 * マルチパートアップロードを完了する（サーバー側で parts を自動収集）。
 * CORS で ETag が expose されていない環境で利用する。
 */
export async function completeMultipartUploadServer(
	key: string,
	uploadId: string
): Promise<void> {
	const parts = await listMultipartParts(key, uploadId);
	if (parts.length === 0) {
		throw new Error("No uploaded parts found");
	}
	await completeMultipartUpload(key, uploadId, parts);
}

/**
 * マルチパートアップロードを中止し、既にアップロードされたパートを削除する。
 */
export async function abortMultipartUpload(
	key: string,
	uploadId: string
): Promise<void> {
	const client = getStorageClient();
	const command = new AbortMultipartUploadCommand({
		Bucket: env.S3_BUCKET,
		Key: key,
		UploadId: uploadId,
	});
	await client.send(command);
}
