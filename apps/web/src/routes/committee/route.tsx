import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireAuth, requireCommitteeMember } from "@/lib/auth";

export const Route = createFileRoute("/committee")({
	beforeLoad: async ({ location }) => {
		await requireAuth(location.pathname);
		await requireCommitteeMember();
	},
	component: CommitteeLayout,
});

function CommitteeLayout() {
	return <Outlet />;
}
