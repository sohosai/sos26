import { requestUploadUrlRequestSchema } from "@sos26/shared";
import { Hono } from "hono";
import { stream } from "hono/streaming";
import { env } from "../lib/env";
import { Errors } from "../lib/error";
import { prisma } from "../lib/prisma";
import { canAccessFile } from "../lib/storage/access";
import { generateFileToken, verifyFileToken } from "../lib/storage/file-token";
import { generateObjectKey } from "../lib/storage/key";
import {
	generateUploadUrl,
	getObject,
	objectExists,
} from "../lib/storage/presign";
import { requireAuth } from "../middlewares/auth";
import type { AuthEnv } from "../types/auth-env";

export const fileRoute = new Hono<AuthEnv>();

/**
 * ファイル情報を API レスポンス形式に変換する
 */
function toFileResponse(file: {
	id: string;
	fileName: string;
	mimeType: string;
	size: number;
	isPublic: boolean;
	status: string;
	uploadedById: string;
	createdAt: Date;
	updatedAt: Date;
}) {
	return {
		id: file.id,
		fileName: file.fileName,
		mimeType: file.mimeType,
		size: file.size,
		isPublic: file.isPublic,
		status: file.status,
		uploadedById: file.uploadedById,
		createdAt: file.createdAt.toISOString(),
		updatedAt: file.updatedAt.toISOString(),
	};
}

/**
 * POST /files/upload-url
 * Presigned PUT URL 発行 + PENDING レコード作成
 */
fileRoute.post("/upload-url", requireAuth, async c => {
	const body = await c.req.json().catch(() => ({}));
	const parsed = requestUploadUrlRequestSchema.parse(body);
	const userId = c.get("user").id;

	// ファイルサイズ上限チェック
	if (parsed.size > env.S3_MAX_FILE_SIZE) {
		throw Errors.validationError(
			`ファイルサイズが上限（${env.S3_MAX_FILE_SIZE} バイト）を超えています`
		);
	}

	const key = generateObjectKey(userId, parsed.mimeType);
	const uploadUrl = await generateUploadUrl(key, parsed.mimeType, parsed.size);

	const file = await prisma.file.create({
		data: {
			key,
			fileName: parsed.fileName,
			mimeType: parsed.mimeType,
			size: parsed.size,
			isPublic: parsed.isPublic,
			uploadedById: userId,
		},
	});

	return c.json({
		fileId: file.id,
		uploadUrl,
		key,
	});
});

/**
 * POST /files/:id/confirm
 * S3 存在確認 → CONFIRMED 更新
 */
fileRoute.post("/:id/confirm", requireAuth, async c => {
	const fileId = c.req.param("id");
	const userId = c.get("user").id;

	const file = await prisma.file.findFirst({
		where: { id: fileId, deletedAt: null },
	});

	if (!file) {
		throw Errors.notFound("ファイルが見つかりません");
	}

	if (file.uploadedById !== userId) {
		throw Errors.forbidden("このファイルを確認する権限がありません");
	}

	// 冪等: 既に CONFIRMED ならそのまま返す
	if (file.status === "CONFIRMED") {
		return c.json({ file: toFileResponse(file) });
	}

	// S3 上にオブジェクトが存在するか確認
	const exists = await objectExists(file.key);
	if (!exists) {
		throw Errors.validationError("ファイルがアップロードされていません");
	}

	const updated = await prisma.file.update({
		where: { id: fileId },
		data: { status: "CONFIRMED" },
	});

	return c.json({ file: toFileResponse(updated) });
});

/**
 * GET /files/:id/token
 * 非公開ファイルアクセス用の署名付きトークン発行
 */
fileRoute.get("/:id/token", requireAuth, async c => {
	const fileId = c.req.param("id");
	const user = c.get("user");

	const file = await prisma.file.findFirst({
		where: { id: fileId, status: "CONFIRMED", deletedAt: null },
	});

	if (!file) {
		throw Errors.notFound("ファイルが見つかりません");
	}

	if (file.isPublic) {
		throw Errors.validationError("公開ファイルにトークンは不要です");
	}

	// アクセス制御: アップローダー本人 or 登録済みチェッカーで許可
	if (file.uploadedById !== user.id) {
		const hasAccess = await canAccessFile(file.id, user);
		if (!hasAccess) {
			throw Errors.forbidden("このファイルにアクセスする権限がありません");
		}
	}

	const token = await generateFileToken(fileId, user.id);
	const expiresAt = new Date(
		Math.floor(Date.now() / 1000) * 1000 + 300 * 1000
	).toISOString();

	return c.json({ token, expiresAt });
});

/**
 * GET /files/:id/content
 * API プロキシでファイル配信
 *
 * - 公開ファイル: 認証不要
 * - 非公開ファイル: ?token クエリパラメータ必須（GET /files/:id/token で事前取得）
 */
fileRoute.get("/:id/content", async c => {
	const fileId = c.req.param("id");

	const file = await prisma.file.findFirst({
		where: { id: fileId, status: "CONFIRMED", deletedAt: null },
	});

	if (!file) {
		throw Errors.notFound("ファイルが見つかりません");
	}

	if (!file.isPublic) {
		const token = c.req.query("token");
		if (!token) {
			throw Errors.unauthorized(
				"非公開ファイルにはトークンが必要です。GET /files/:id/token で取得してください"
			);
		}
		// トークン発行時にアクセス権限を確認済みなので、署名検証のみ
		const payload = await verifyFileToken(token, fileId);
		if (!payload) {
			throw Errors.unauthorized("ファイルトークンが無効または期限切れです");
		}
	}

	const s3Response = await getObject(file.key);
	const s3Body = s3Response.Body;
	if (!s3Body) {
		throw Errors.internal("ファイルの取得に失敗しました");
	}

	c.header("Content-Type", file.mimeType);
	c.header("Content-Length", String(file.size));
	c.header(
		"Cache-Control",
		file.isPublic ? "public, max-age=86400" : "private, max-age=3600"
	);
	const encodedFileName = encodeURIComponent(file.fileName);
	c.header(
		"Content-Disposition",
		`inline; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`
	);

	return stream(c, async s => {
		const readable = s3Body.transformToWebStream();
		const reader = readable.getReader();
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				await s.write(value);
			}
		} finally {
			reader.releaseLock();
		}
	});
});

/**
 * GET /files
 * 自分のファイル一覧（CONFIRMED + deletedAt null）
 */
fileRoute.get("/", requireAuth, async c => {
	const userId = c.get("user").id;

	const files = await prisma.file.findMany({
		where: {
			uploadedById: userId,
			status: "CONFIRMED",
			deletedAt: null,
		},
		orderBy: { createdAt: "desc" },
	});

	return c.json({
		files: files.map(toFileResponse),
	});
});

/**
 * DELETE /files/:id
 * ソフトデリート
 */
fileRoute.delete("/:id", requireAuth, async c => {
	const fileId = c.req.param("id");
	const userId = c.get("user").id;

	const file = await prisma.file.findFirst({
		where: { id: fileId, deletedAt: null },
	});

	if (!file) {
		throw Errors.notFound("ファイルが見つかりません");
	}

	if (file.uploadedById !== userId) {
		throw Errors.forbidden("このファイルを削除する権限がありません");
	}

	await prisma.file.update({
		where: { id: fileId },
		data: { deletedAt: new Date() },
	});

	return c.json({ success: true as const });
});
