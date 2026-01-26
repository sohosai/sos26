import ky from "ky";
import { env } from "../env";
import { auth } from "../firebase";

/**
 * Firebase ID Token を取得
 * ログイン中の場合のみトークンを返す
 */
async function getAuthToken(): Promise<string | null> {
	const user = auth.currentUser;
	if (!user) return null;
	return user.getIdToken();
}

// ky共通クライアント。prefixUrl・timeout・retry・認証ヘッダを設定
export const httpClient = ky.create({
	prefixUrl: env.VITE_API_BASE_URL,
	timeout: 10000,
	retry: {
		limit: 1,
		methods: ["get", "put", "head", "delete", "options", "trace"],
		statusCodes: [408, 413, 429, 500, 502, 503, 504],
	},
	hooks: {
		beforeRequest: [
			async request => {
				const token = await getAuthToken();
				if (token) {
					request.headers.set("Authorization", `Bearer ${token}`);
				}
			},
		],
	},
});
