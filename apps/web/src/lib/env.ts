import { z } from "zod";

const envSchema = z.object({
	VITE_API_BASE_URL: z
		.string()
		.regex(/^https?:\/\/.+/, "有効なURLである必要があります")
		.default("http://localhost:3000"),
	VITE_VAPID_PUBLIC_KEY: z.string(),

	// Firebase
	VITE_FIREBASE_API_KEY: z.string().min(1),
	VITE_FIREBASE_AUTH_DOMAIN: z.string().min(1),
	VITE_FIREBASE_PROJECT_ID: z.string().min(1),
});

export const env = envSchema.parse({
	VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
	VITE_VAPID_PUBLIC_KEY: import.meta.env.VITE_VAPID_PUBLIC_KEY,
	VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY,
	VITE_FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
	VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
});

export type Env = z.infer<typeof envSchema>;
