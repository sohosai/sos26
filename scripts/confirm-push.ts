import { execSync } from "node:child_process";

const branch = execSync("git rev-parse --abbrev-ref HEAD", {
	encoding: "utf8",
}).trim();

if (branch !== "main") {
	process.exit(0);
}

console.warn(
	"\x1b[33m⚠ mainブランチに直接Pushしようとしています。続行しますか？ (y/N): \x1b[0m"
);

const input = await prompt("");

if (input?.trim().toLowerCase() === "y") {
	process.exit(0);
} else {
	console.error("\x1b[31mPushを中断しました。\x1b[0m");
	process.exit(1);
}
