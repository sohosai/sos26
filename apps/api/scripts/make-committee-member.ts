import { type CommitteePermission, PrismaClient } from "@prisma/client";

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

const PERMISSIONS: CommitteePermission[] = [
	"MEMBER_EDIT",
	"NOTICE_DELIVER",
	"NOTICE_APPROVE",
	"FORM_DELIVER",
];

function printUsage() {
	console.log(`
Usage: bun run make-committee-member --email <email> [--bureau <bureau>] [--permissions <p1,p2,...>]

Options:
  --email        登録済みユーザーのメールアドレス（必須）
  --bureau       局名（デフォルト: INFO_SYSTEM）
  --permissions  付与する権限（カンマ区切り）

Bureau:
  ${BUREAUS.join(", ")}

Permissions:
  ${PERMISSIONS.join(", ")}

Examples:
  bun run make-committee-member --email user@example.com
  bun run make-committee-member --email user@example.com --bureau FINANCE
  bun run make-committee-member --email user@example.com --permissions NOTICE_DELIVER,NOTICE_APPROVE
`);
}

function getOptionValue(args: string[], name: string): string | undefined {
	const idx = args.indexOf(name);
	if (idx !== -1 && args[idx + 1]) {
		return args[idx + 1];
	}
	return undefined;
}

function parseBureau(value: string): Bureau {
	if (!BUREAUS.includes(value as Bureau)) {
		console.error(`エラー: 不明な局名 "${value}"`);
		console.error(`有効な値: ${BUREAUS.join(", ")}`);
		process.exit(1);
	}
	return value as Bureau;
}

function parsePermissions(value: string): CommitteePermission[] {
	return value.split(",").map(v => {
		if (!PERMISSIONS.includes(v as CommitteePermission)) {
			console.error(`エラー: 不明な権限 "${v}"`);
			console.error(`有効な値: ${PERMISSIONS.join(", ")}`);
			process.exit(1);
		}
		return v as CommitteePermission;
	});
}

function parseArgs(args: string[]): {
	email: string;
	bureau: Bureau;
	permissions: CommitteePermission[];
} {
	const email = getOptionValue(args, "--email");
	if (!email) {
		console.error("エラー: --email は必須です");
		printUsage();
		process.exit(1);
	}

	const bureauValue = getOptionValue(args, "--bureau");
	const bureau = bureauValue ? parseBureau(bureauValue) : "INFO_SYSTEM";

	const permissionsValue = getOptionValue(args, "--permissions");
	const permissions = permissionsValue
		? parsePermissions(permissionsValue)
		: [];

	return { email, bureau, permissions };
}

async function grantPermissions(
	prisma: PrismaClient,
	memberId: string,
	permissions: CommitteePermission[]
) {
	if (permissions.length === 0) return;

	for (const permission of permissions) {
		await prisma.committeeMemberPermission.upsert({
			where: {
				committeeMemberId_permission: {
					committeeMemberId: memberId,
					permission,
				},
			},
			create: { committeeMemberId: memberId, permission },
			update: {},
		});
		console.log(`  権限付与: ${permission}`);
	}
}

async function main() {
	const { email, bureau, permissions } = parseArgs(process.argv.slice(2));

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
			await grantPermissions(prisma, existing.id, permissions);
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
			await grantPermissions(prisma, reactivated.id, permissions);
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
			await grantPermissions(prisma, member.id, permissions);
		}
	} finally {
		await prisma.$disconnect();
	}
}

main();
