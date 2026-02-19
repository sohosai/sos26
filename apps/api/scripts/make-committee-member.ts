import { PrismaClient } from "@prisma/client";

const BUREAUS = [
	"FINANCE",
	"GENERAL_AFFAIRS",
	"PUBLIC_RELATIONS",
	"EXTERNAL",
	"PROMOTION",
	"PLANNING",
	"STAGE_MANAGEMENT",
	"HQ_PLANNING",
	"INFO_SYSTEM",
	"INFORMATION",
] as const;

type Bureau = (typeof BUREAUS)[number];

function printUsage() {
	console.log(`
Usage: bun run make-committee-member -- --email <email> [--bureau <bureau>]

Options:
  --email    登録済みユーザーのメールアドレス（必須）
  --bureau   局名（デフォルト: INFO_SYSTEM）

Bureau:
  ${BUREAUS.join(", ")}

Examples:
  bun run make-committee-member -- --email user@example.com
  bun run make-committee-member -- --email user@example.com --bureau FINANCE
`);
}

function parseArgs(args: string[]): { email: string; bureau: Bureau } {
	let email: string | undefined;
	let bureau: Bureau = "INFO_SYSTEM";

	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--email" && args[i + 1]) {
			email = args[i + 1];
			i++;
		} else if (args[i] === "--bureau" && args[i + 1]) {
			const value = args[i + 1];
			if (!BUREAUS.includes(value as Bureau)) {
				console.error(`エラー: 不明な局名 "${value}"`);
				console.error(`有効な値: ${BUREAUS.join(", ")}`);
				process.exit(1);
			}
			bureau = value as Bureau;
			i++;
		}
	}

	if (!email) {
		console.error("エラー: --email は必須です");
		printUsage();
		process.exit(1);
	}

	return { email, bureau };
}

async function main() {
	const { email, bureau } = parseArgs(process.argv.slice(2));

	const prisma = new PrismaClient();

	try {
		const user = await prisma.user.findFirst({
			where: { email, deletedAt: null },
		});

		if (!user) {
			console.error(
				`エラー: メールアドレス "${email}" のユーザーが見つかりません`
			);
			console.error("ユーザーが先にアプリで登録されている必要があります");
			process.exit(1);
		}

		const existing = await prisma.committeeMember.findUnique({
			where: { userId: user.id },
		});

		if (existing && !existing.deletedAt) {
			console.log(`ユーザー "${user.name}" (${email}) は既に実委人です`);
			console.log(`  局: ${existing.Bureau}`);
			console.log(`  ID: ${existing.id}`);
			process.exit(0);
		}

		if (existing?.deletedAt) {
			const reactivated = await prisma.committeeMember.update({
				where: { id: existing.id },
				data: {
					Bureau: bureau,
					deletedAt: null,
					joinedAt: new Date(),
				},
			});
			console.log(`実委人を再有効化しました:`);
			console.log(`  ユーザー: ${user.name} (${email})`);
			console.log(`  局: ${reactivated.Bureau}`);
			console.log(`  ID: ${reactivated.id}`);
		} else {
			const member = await prisma.committeeMember.create({
				data: {
					userId: user.id,
					Bureau: bureau,
				},
			});
			console.log(`実委人に登録しました:`);
			console.log(`  ユーザー: ${user.name} (${email})`);
			console.log(`  局: ${member.Bureau}`);
			console.log(`  ID: ${member.id}`);
		}
	} finally {
		await prisma.$disconnect();
	}
}

main();
