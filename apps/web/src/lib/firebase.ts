import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { env } from "./env";

const firebaseConfig = {
	apiKey: env.VITE_FIREBASE_API_KEY,
	authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
	projectId: env.VITE_FIREBASE_PROJECT_ID,
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// ローカル開発用: 設定されていれば Firebase Auth Emulator に接続する
if (env.VITE_FIREBASE_AUTH_EMULATOR_URL) {
	connectAuthEmulator(auth, env.VITE_FIREBASE_AUTH_EMULATOR_URL, {
		disableWarnings: true,
	});
}
