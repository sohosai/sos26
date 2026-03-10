import { searchUsersQuerySchema } from "@sos26/shared";
import { Hono } from "hono";
import { prisma } from "../lib/prisma";
import { requireAuth, requireCommitteeMember } from "../middlewares/auth";
import type { AuthEnv } from "../types/auth-env";

const committeeUserRoute = new Hono<AuthEnv>();

// ─────────────────────────────────────────────────────────────
// GET /committee/users/search
// ユーザーを名前・メールアドレス・読み仮名で曖昧検索
// ─────────────────────────────────────────────────────────────
committeeUserRoute.get(
	"/search",
	requireAuth,
	requireCommitteeMember,
	async c => {
		const query = searchUsersQuerySchema.parse(c.req.query());
		const { search, limit } = query;

		const users = await prisma.user.findMany({
			where: {
				deletedAt: null,
				OR: [
					{ name: { contains: search, mode: "insensitive" } },
					{ namePhonetic: { contains: search, mode: "insensitive" } },
					{ email: { contains: search, mode: "insensitive" } },
				],
			},
			select: {
				id: true,
				email: true,
				name: true,
				namePhonetic: true,
			},
			take: limit,
			orderBy: { name: "asc" },
		});

		return c.json({ users });
	}
);

export { committeeUserRoute };
