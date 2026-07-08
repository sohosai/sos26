import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
async function main() {
	await prisma.$executeRaw`UPDATE "ProjectPublicInfo" SET "storeName" = NULL;`;
	// biome-ignore lint/suspicious/noConsole: script
	console.log("Cleared storeName");
}
main()
	.then(() => process.exit(0))
	.catch(e => {
		console.error(e);
		process.exit(1);
	});
