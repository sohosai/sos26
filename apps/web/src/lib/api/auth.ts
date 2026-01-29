import {
	type GetMeResponse,
	getMeEndpoint,
	type RegisterRequest,
	type RegisterResponse,
	registerEndpoint,
	type StartEmailVerificationRequest,
	type StartEmailVerificationResponse,
	startEmailVerificationEndpoint,
	type VerifyEmailRequest,
	type VerifyEmailResponse,
	verifyEmailEndpoint,
} from "@sos26/shared";
import { callBodyApi, callGetApi } from "./core";

/**
 * POST /auth/email/start
 * メール検証を開始する
 */
export async function startEmailVerification(
	body: StartEmailVerificationRequest
): Promise<StartEmailVerificationResponse> {
	return callBodyApi(startEmailVerificationEndpoint, body);
}

/**
 * POST /auth/email/verify
 * メール検証を確定する
 */
export async function verifyEmail(
	body: VerifyEmailRequest
): Promise<VerifyEmailResponse> {
	return callBodyApi(verifyEmailEndpoint, body);
}

/**
 * POST /auth/register
 * 本登録（Firebaseユーザー作成 + DBユーザー作成）
 */
export async function register(
	body: RegisterRequest
): Promise<RegisterResponse> {
	return callBodyApi(registerEndpoint, body);
}

/**
 * GET /auth/me
 * 現在のログインユーザーを取得
 */
export async function getMe(): Promise<GetMeResponse> {
	return callGetApi(getMeEndpoint);
}
