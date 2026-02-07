import { z } from "zod";

const envSchema = z.object({
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
	FIREBASE_CLIENT_EMAIL: z.string().min(1),
	FIREBASE_PRIVATE_KEY: z
		.string()
		.min(1)
		.transform(v => v.replace(/\\n/g, "\n")),

	// 認証リンク用のアプリURL
	APP_URL: z.url(),

	// push通知
	ADMIN_MAIL: z.email(),
	VAPID_PUBLIC_KEY: z.string().min(1),
	VAPID_PRIVATE_KEY: z.string().min(1),
	PUSH_SEND_BATCH_SIZE: z.coerce.number().min(1).default(50),
});

export const env = envSchema.parse({
	PORT: process.env.PORT,
	CORS_ORIGIN: process.env.CORS_ORIGIN,
	SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
	EMAIL_FROM: process.env.EMAIL_FROM,
	EMAIL_SANDBOX: process.env.EMAIL_SANDBOX,
	FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
	FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
	FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
	APP_URL: process.env.APP_URL,
	ADMIN_MAIL: process.env.ADMIN_MAIL,
	VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
	VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
	PUSH_SEND_BATCH_SIZE: process.env.PUSH_SEND_BATCH_SIZE,
});

export type Env = z.infer<typeof envSchema>;
