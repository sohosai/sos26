import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// "dev@example.com" → { local: "dev", domain: "@example.com" }
function splitEmail(email: string): { local: string; domain: string } {
	const at = email.indexOf("@");
	return { local: email.slice(0, at), domain: email.slice(at) };
}

function parseFirebaseUids(): string[] {
	const raw = process.env.SEED_FIREBASE_UIDS ?? "";
	const uids = raw
		.split(",")
		.map(s => s.trim())
		.filter(Boolean);

	if (uids.length === 0) {
		console.error(
			"エラー: SEED_FIREBASE_UIDS が設定されていません（カンマ区切りで指定）"
		);
		process.exit(1);
	}

	return uids;
}

const ONES = [
	"",
	"いち",
	"に",
	"さん",
	"よん",
	"ご",
	"ろく",
	"なな",
	"はち",
	"きゅう",
];
const TENS = [
	"",
	"じゅう",
	"にじゅう",
	"さんじゅう",
	"よんじゅう",
	"ごじゅう",
	"ろくじゅう",
	"ななじゅう",
	"はちじゅう",
	"きゅうじゅう",
];

// 1〜99 を ひらがな に変換（それ以上は数字そのまま）
function toHiraganaNumber(n: number): string {
	if (n <= 0 || n >= 100) return String(n);
	const ten = Math.floor(n / 10);
	const one = n % 10;
	return TENS[ten] + ONES[one];
}

async function seedUser(
	n: number,
	firebaseUid: string,
	baseEmail: { local: string; domain: string },
	baseName: string,
	baseNamePhonetic: string,
	telephoneNumber: string
) {
	const email = `${baseEmail.local}+${n}${baseEmail.domain}`;
	const name = `${baseName}+${n}`;
	const namePhonetic = `${baseNamePhonetic}ぷらす${toHiraganaNumber(n)}`;

	console.log(`\n[${n}] ${email} (uid: ${firebaseUid})`);

	const user = await prisma.user.upsert({
		where: { email },
		update: {},
		create: {
			firebaseUid,
			email,
			name,
			namePhonetic,
			telephoneNumber,
		},
	});

	console.log(`  DB ユーザー: ${user.id} (${user.name})`);
}

async function main() {
	const firebaseUids = parseFirebaseUids();

	const baseEmailRaw = process.env.SEED_USER_EMAIL ?? "dev@example.com";
	const baseEmail = splitEmail(baseEmailRaw);
	const baseName = process.env.SEED_USER_NAME ?? "開発 太郎";
	const baseNamePhonetic =
		process.env.SEED_USER_NAME_PHONETIC ?? "かいはつたろう";
	const telephoneNumber = process.env.SEED_USER_TELEPHONE ?? "090-0000-0000";

	console.log(`シードユーザーを ${firebaseUids.length} 人作成します`);

	for (let i = 0; i < firebaseUids.length; i++) {
		await seedUser(
			i + 1,
			firebaseUids[i] as string,
			baseEmail,
			baseName,
			baseNamePhonetic,
			telephoneNumber
		);
	}

	console.log("\n完了!");
}

main()
	.catch(e => {
		console.error(e);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
