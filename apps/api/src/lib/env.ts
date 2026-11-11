import { z } from "zod";

const baseEnvSchema = z.object({
	// CORS 設定
	PORT: z.coerce.number().int().min(1).max(65535).default(3000),
	CORS_ORIGIN: z
		.string()
		.default("")
		.transform(val =>
			val
				.split(",")
				.map(o => o.trim())
				.filter(Boolean)
		)
		.refine(
			origins => origins.every(o => /^https?:\/\/.+/.test(o)),
			"各オリジンは有効なURL（http://またはhttps://で始まる）である必要があります"
		),

	// SendGrid
	SENDGRID_API_KEY: z.string().min(1),
	EMAIL_FROM: z.email(),
	EMAIL_SANDBOX: z
		.enum(["true", "false"])
		.default("false")
		.transform(v => v === "true"),

	// Firebase Admin
	FIREBASE_PROJECT_ID: z.string().min(1),
	// 設定すると Firebase Auth Emulator に接続する（Admin SDK がこの変数を直接参照する）
	// エミュレータ使用時はサービスアカウントの認証情報は不要
	FIREBASE_AUTH_EMULATOR_HOST: z.string().min(1).optional(),
	FIREBASE_CLIENT_EMAIL: z.string().min(1).optional(),
	FIREBASE_PRIVATE_KEY: z
		.string()
		.min(1)
		.transform(v => v.replace(/\\n/g, "\n"))
		.optional(),

	// 認証リンク用のアプリURL
	APP_URL: z.url(),

	// push通知
	ADMIN_MAIL: z.email(),
	VAPID_PUBLIC_KEY: z.string().min(1),
	VAPID_PRIVATE_KEY: z.string().min(1),
	PUSH_SEND_BATCH_SIZE: z.coerce.number().min(1).default(50),

	// 内部通知同期エンドポイント
	NOTIFICATION_SYNC_PASSWORD: z.string().min(1),

	// S3互換オブジェクトストレージ
	// スキームは省略可。省略時は https を補う。
	// ローカルの MinIO 等 http で動かす場合は http:// を明示すること。
	// 補完はここだけで行い、env.S3_ENDPOINT は常に完全なURLとして扱えるようにする。
	S3_ENDPOINT: z
		.string()
		.min(1)
		.transform(v => {
			const trimmed = v.trim();
			return /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
		}),
	S3_REGION: z.string().default("jp-north-1"),
	S3_BUCKET: z.string().min(1),
	S3_ACCESS_KEY_ID: z.string().min(1),
	S3_SECRET_ACCESS_KEY: z.string().min(1),
	S3_PRESIGNED_URL_EXPIRES: z.coerce.number().min(1).default(3600),
	S3_MAX_FILE_SIZE: z.coerce.number().min(1).default(1_000_000_000), // 1GB

	// ファイルトークン署名用秘密鍵
	FILE_TOKEN_SECRET: z.string().min(32),

	// Sentry
	SENTRY_DSN: z.string().url().optional(),
	SENTRY_ENVIRONMENT: z.string().default("development"),

	// 企画応募期間（カンマ区切りで複数期間指定可能、未指定の場合は無期限）
	PROJECT_APPLICATION_PERIODS: z
		.string()
		.optional()
		.transform(val => {
			if (!val || val.trim() === "") {
				return null; // 無期限
			}
			const periods = val
				.split(",")
				.map(p => p.trim())
				.filter(Boolean);
			const parsed = periods.map(period => {
				const [start, end] = period.split("~").map(d => d.trim());
				if (!start || !end) {
					throw new Error(
						`Invalid period format: ${period}. Expected format: YYYY-MM-DD~YYYY-MM-DD`
					);
				}
				const startDate = new Date(start);
				const endDate = new Date(end);
				if (Number.isNaN(startDate.getTime())) {
					throw new Error(`Invalid start date: ${start}`);
				}
				if (Number.isNaN(endDate.getTime())) {
					throw new Error(`Invalid end date: ${end}`);
				}
				if (startDate > endDate) {
					throw new Error(`Start date must be before end date: ${period}`);
				}
				return { start: startDate, end: endDate };
			});
			return parsed;
		}),

	// 指定した列の値は、実委内のカラム閲覧権限（viewers/visibility）に関わらず
	// 認証なしで誰でも見られるようになる点に注意。
	PUBLIC_API_MASTERSHEET_COLUMN_IDS: z
		.string()
		.default("")
		.transform(val =>
			val
				.split(",")
				.map(v => v.trim())
				.filter(Boolean)
		),
});

const envSchema = baseEnvSchema.superRefine((val, ctx) => {
	if (val.FIREBASE_AUTH_EMULATOR_HOST) {
		// エミュレータは署名なしのトークンも受け付けるため、本番で有効になると認証を偽装できてしまう
		if (process.env.NODE_ENV === "production") {
			ctx.addIssue({
				code: "custom",
				path: ["FIREBASE_AUTH_EMULATOR_HOST"],
				message: "本番環境では Firebase Auth Emulator を使用できません",
			});
		}
	} else {
		for (const key of [
			"FIREBASE_CLIENT_EMAIL",
			"FIREBASE_PRIVATE_KEY",
		] as const) {
			if (!val[key]) {
				ctx.addIssue({
					code: "custom",
					path: [key],
					message: "FIREBASE_AUTH_EMULATOR_HOST 未設定時は必須です",
				});
			}
		}
	}
});

// Firebase 関連は空文字を未設定として扱う（compose.yml で空を指定してエミュレータを無効化できるようにするため）
export const env = envSchema.parse({
	PORT: process.env.PORT,
	CORS_ORIGIN: process.env.CORS_ORIGIN,
	SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
	EMAIL_FROM: process.env.EMAIL_FROM,
	EMAIL_SANDBOX: process.env.EMAIL_SANDBOX,
	FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
	FIREBASE_AUTH_EMULATOR_HOST:
		process.env.FIREBASE_AUTH_EMULATOR_HOST || undefined,
	FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL || undefined,
	FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY || undefined,
	APP_URL: process.env.APP_URL,
	ADMIN_MAIL: process.env.ADMIN_MAIL,
	VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
	VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
	PUSH_SEND_BATCH_SIZE: process.env.PUSH_SEND_BATCH_SIZE,
	NOTIFICATION_SYNC_PASSWORD: process.env.NOTIFICATION_SYNC_PASSWORD,
	S3_ENDPOINT: process.env.S3_ENDPOINT,
	S3_REGION: process.env.S3_REGION,
	S3_BUCKET: process.env.S3_BUCKET,
	S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
	S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
	S3_PRESIGNED_URL_EXPIRES: process.env.S3_PRESIGNED_URL_EXPIRES,
	S3_MAX_FILE_SIZE: process.env.S3_MAX_FILE_SIZE,
	FILE_TOKEN_SECRET: process.env.FILE_TOKEN_SECRET,
	SENTRY_DSN: process.env.SENTRY_DSN,
	SENTRY_ENVIRONMENT: process.env.SENTRY_ENVIRONMENT,
	PROJECT_APPLICATION_PERIODS: process.env.PROJECT_APPLICATION_PERIODS,
	PUBLIC_API_MASTERSHEET_COLUMN_IDS:
		process.env.PUBLIC_API_MASTERSHEET_COLUMN_IDS,
});

export type Env = z.infer<typeof envSchema>;
