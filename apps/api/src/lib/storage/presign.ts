import {
	GetObjectCommand,
	HeadObjectCommand,
	PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../env";
import { getStorageClient } from "./client";

/**
 * Presigned PUT URL を生成する（アップロード用）。
 */
export async function generateUploadUrl(
	key: string,
	mimeType: string,
	size: number
): Promise<string> {
	const client = getStorageClient();
	const command = new PutObjectCommand({
		Bucket: env.S3_BUCKET,
		Key: key,
		ContentType: mimeType,
		ContentLength: size,
	});
	return getSignedUrl(client, command, {
		expiresIn: env.S3_PRESIGNED_URL_EXPIRES,
	});
}

/**
 * S3からオブジェクトを取得する（APIプロキシ用）。
 */
export async function getObject(key: string) {
	const client = getStorageClient();
	const command = new GetObjectCommand({
		Bucket: env.S3_BUCKET,
		Key: key,
	});
	return client.send(command);
}

/**
 * S3上にオブジェクトが存在するか確認する。
 */
export async function objectExists(key: string): Promise<boolean> {
	const client = getStorageClient();
	const command = new HeadObjectCommand({
		Bucket: env.S3_BUCKET,
		Key: key,
	});
	try {
		await client.send(command);
		return true;
	} catch {
		return false;
	}
}
