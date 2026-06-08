import { z } from "zod";
import {
	abortMultipartUploadRequestSchema,
	abortMultipartUploadResponseSchema,
	completeMultipartUploadRequestSchema,
	completeMultipartUploadResponseSchema,
	confirmUploadResponseSchema,
	deleteFileResponseSchema,
	fileTokenResponseSchema,
	initiateMultipartUploadRequestSchema,
	initiateMultipartUploadResponseSchema,
	listFilesResponseSchema,
	requestUploadUrlRequestSchema,
	requestUploadUrlResponseSchema,
} from "../schemas/file";
import type { BodyEndpoint, GetEndpoint, NoBodyEndpoint } from "./types";

/** ファイルIDパスパラメータ */
export const fileIdPathParamsSchema = z.object({
	id: z.string(),
});
export type FileIdPathParams = z.infer<typeof fileIdPathParamsSchema>;

/** 空ボディ（confirm用） */
const emptyBodySchema = z.object({});

/**
 * POST /files/upload-url
 * Presigned PUT URL 発行 + PENDING レコード作成
 */
export const requestUploadUrlEndpoint: BodyEndpoint<
	"POST",
	"/files/upload-url",
	undefined,
	undefined,
	typeof requestUploadUrlRequestSchema,
	typeof requestUploadUrlResponseSchema
> = {
	method: "POST",
	path: "/files/upload-url",
	pathParams: undefined,
	query: undefined,
	request: requestUploadUrlRequestSchema,
	response: requestUploadUrlResponseSchema,
} as const;

/**
 * POST /files/multipart/initiate
 * マルチパートアップロード開始
 */
export const initiateMultipartUploadEndpoint: BodyEndpoint<
	"POST",
	"/files/multipart/initiate",
	undefined,
	undefined,
	typeof initiateMultipartUploadRequestSchema,
	typeof initiateMultipartUploadResponseSchema
> = {
	method: "POST",
	path: "/files/multipart/initiate",
	pathParams: undefined,
	query: undefined,
	request: initiateMultipartUploadRequestSchema,
	response: initiateMultipartUploadResponseSchema,
} as const;

/**
 * POST /files/multipart/complete
 * マルチパートアップロード完了
 */
export const completeMultipartUploadEndpoint: BodyEndpoint<
	"POST",
	"/files/multipart/complete",
	undefined,
	undefined,
	typeof completeMultipartUploadRequestSchema,
	typeof completeMultipartUploadResponseSchema
> = {
	method: "POST",
	path: "/files/multipart/complete",
	pathParams: undefined,
	query: undefined,
	request: completeMultipartUploadRequestSchema,
	response: completeMultipartUploadResponseSchema,
} as const;

/**
 * POST /files/multipart/abort
 * マルチパートアップロード中止
 */
export const abortMultipartUploadEndpoint: BodyEndpoint<
	"POST",
	"/files/multipart/abort",
	undefined,
	undefined,
	typeof abortMultipartUploadRequestSchema,
	typeof abortMultipartUploadResponseSchema
> = {
	method: "POST",
	path: "/files/multipart/abort",
	pathParams: undefined,
	query: undefined,
	request: abortMultipartUploadRequestSchema,
	response: abortMultipartUploadResponseSchema,
} as const;

/**
 * POST /files/:id/confirm
 * S3存在確認 → CONFIRMED 更新
 */
export const confirmUploadEndpoint: BodyEndpoint<
	"POST",
	"/files/:id/confirm",
	typeof fileIdPathParamsSchema,
	undefined,
	typeof emptyBodySchema,
	typeof confirmUploadResponseSchema
> = {
	method: "POST",
	path: "/files/:id/confirm",
	pathParams: fileIdPathParamsSchema,
	query: undefined,
	request: emptyBodySchema,
	response: confirmUploadResponseSchema,
} as const;

/**
 * GET /files
 * 自分のファイル一覧
 */
export const listFilesEndpoint: GetEndpoint<
	"/files",
	undefined,
	undefined,
	typeof listFilesResponseSchema
> = {
	method: "GET",
	path: "/files",
	pathParams: undefined,
	query: undefined,
	request: undefined,
	response: listFilesResponseSchema,
} as const;

/**
 * DELETE /files/:id
 * ソフトデリート
 */
export const deleteFileEndpoint: NoBodyEndpoint<
	"DELETE",
	"/files/:id",
	typeof fileIdPathParamsSchema,
	undefined,
	typeof deleteFileResponseSchema
> = {
	method: "DELETE",
	path: "/files/:id",
	pathParams: fileIdPathParamsSchema,
	query: undefined,
	request: undefined,
	response: deleteFileResponseSchema,
} as const;

/**
 * GET /files/:id/token
 * 非公開ファイルアクセス用の署名付きトークン発行
 */
export const getFileTokenEndpoint: GetEndpoint<
	"/files/:id/token",
	typeof fileIdPathParamsSchema,
	undefined,
	typeof fileTokenResponseSchema
> = {
	method: "GET",
	path: "/files/:id/token",
	pathParams: fileIdPathParamsSchema,
	query: undefined,
	request: undefined,
	response: fileTokenResponseSchema,
} as const;
