import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { env } from "./env";

// FIREBASE_AUTH_EMULATOR_HOST が設定されている場合、Admin SDK は自動でエミュレータに接続する。
// エミュレータではサービスアカウントの認証情報は不要なので projectId のみで初期化する。
// env.ts のバリデーションにより、エミュレータ未使用時は認証情報が必ず存在する。
const app = initializeApp(
	env.FIREBASE_AUTH_EMULATOR_HOST
		? { projectId: env.FIREBASE_PROJECT_ID }
		: {
				credential: cert({
					projectId: env.FIREBASE_PROJECT_ID,
					clientEmail: env.FIREBASE_CLIENT_EMAIL,
					privateKey: env.FIREBASE_PRIVATE_KEY,
				}),
			}
);

export const auth = getAuth(app);
