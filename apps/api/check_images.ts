import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
async function main() {
	const images = await prisma.projectPublicMapImage.findMany();
	// biome-ignore lint/suspicious/noConsole: script
	console.log(images);
}
main()
	.then(() => process.exit(0))
	.catch(e => {
		console.error(e);
		process.exit(1);
	});
