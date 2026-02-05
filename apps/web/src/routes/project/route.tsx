import type { UserRole } from "@sos26/shared";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth";

/**
 * /project 配下で許可されるロール
 * @see docs/apps/web/authorization.md
 */
const ALLOWED_ROLES: UserRole[] = [
	"PLANNER",
	"COMMITTEE_MEMBER",
	"COMMITTEE_ADMIN",
	"SYSTEM_ADMIN",
];

export const Route = createFileRoute("/project")({
	beforeLoad: async ({ location }) => {
		await requireAuth(ALLOWED_ROLES, location.pathname);
	},
	component: ProjectLayout,
});

function ProjectLayout() {
	return <Outlet />;
}
