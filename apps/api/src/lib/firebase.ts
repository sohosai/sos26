import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { env } from "./env";

const app = initializeApp({
	credential: cert({
		projectId: env.FIREBASE_PROJECT_ID,
		clientEmail: env.FIREBASE_CLIENT_EMAIL,
		privateKey: env.FIREBASE_PRIVATE_KEY,
	}),
});

export const auth = getAuth(app);
