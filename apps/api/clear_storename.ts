import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
async function main() {
	// storeName カラムは既に削除されているため、このスクリプトは不要です。
	// 必要ならこのファイル自体を削除してください。
	// biome-ignore lint/suspicious/noConsole: script
	console.log("No-op: storeName column has been removed.");
}
main()
	.then(() => process.exit(0))
	.catch(e => {
		console.error(e);
		process.exit(1);
	});
