import { timingSafeEqual } from "node:crypto";
import { env } from "../env";

/**
 * HMAC-SHA256 署名付きファイルトークンの生成・検証ユーティリティ
 *
 * トークン形式: base64url(payload).base64url(hmac-sha256(payload))
 * ペイロード: fileId:userId:expiresAt(unix秒)
 */

/** base64url エンコード */
function toBase64Url(data: string | Uint8Array): string {
	const buf =
		typeof data === "string" ? Buffer.from(data, "utf-8") : Buffer.from(data);
	return buf.toString("base64url");
}

/** base64url デコード */
function fromBase64Url(data: string): string {
	return Buffer.from(data, "base64url").toString("utf-8");
}

/** HMAC-SHA256 署名を生成 */
async function sign(payload: string): Promise<Uint8Array> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(env.FILE_TOKEN_SECRET),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"]
	);
	const signature = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(payload)
	);
	return new Uint8Array(signature);
}

/**
 * ファイルアクセス用の署名付きトークンを生成する
 *
 * @param fileId - ファイルID
 * @param userId - ユーザーID
 * @param expiresInSeconds - 有効期限（秒）。デフォルト 300秒（5分）
 * @returns 署名付きトークン文字列
 */
export async function generateFileToken(
	fileId: string,
	userId: string,
	expiresInSeconds = 300
): Promise<string> {
	const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
	const payload = `${fileId}:${userId}:${expiresAt}`;
	const signature = await sign(payload);
	return `${toBase64Url(payload)}.${toBase64Url(signature)}`;
}

/**
 * トークン検証結果
 */
export interface FileTokenPayload {
	fileId: string;
	userId: string;
	expiresAt: number;
}

/**
 * ファイルアクセストークンを検証する
 *
 * @param token - 検証するトークン文字列
 * @param expectedFileId - 期待するファイルID
 * @returns 検証成功時はペイロード、失敗時は null
 */
export async function verifyFileToken(
	token: string,
	expectedFileId: string
): Promise<FileTokenPayload | null> {
	const parts = token.split(".");
	if (parts.length !== 2) return null;

	const encodedPayload = parts[0];
	const encodedSignature = parts[1];
	if (!encodedPayload || !encodedSignature) return null;

	// 署名検証（タイミング攻撃防止）
	let expectedSignature: Uint8Array;
	try {
		expectedSignature = await sign(fromBase64Url(encodedPayload));
	} catch {
		return null;
	}

	let actualSignature: Uint8Array;
	try {
		actualSignature = new Uint8Array(
			Buffer.from(encodedSignature, "base64url")
		);
	} catch {
		return null;
	}

	if (expectedSignature.length !== actualSignature.length) return null;
	if (!timingSafeEqual(expectedSignature, actualSignature)) return null;

	// ペイロードのパース
	let payload: string;
	try {
		payload = fromBase64Url(encodedPayload);
	} catch {
		return null;
	}

	const payloadParts = payload.split(":");
	if (payloadParts.length !== 3) return null;

	const fileId = payloadParts[0];
	const userId = payloadParts[1];
	const expiresAtStr = payloadParts[2];
	if (!fileId || !userId || !expiresAtStr) return null;

	const expiresAt = Number(expiresAtStr);
	if (Number.isNaN(expiresAt)) return null;

	// ファイルID一致チェック
	if (fileId !== expectedFileId) return null;

	// 有効期限チェック
	const now = Math.floor(Date.now() / 1000);
	if (now > expiresAt) return null;

	return { fileId, userId, expiresAt };
}
