import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Sidebar } from "@/components/layout/Sidebar/Sidebar";
import { requireAuth, requireCommitteeMember } from "@/lib/auth";

const committeeNav = [{ label: "ダッシュボード", to: "/committee" }];

export const Route = createFileRoute("/committee")({
	beforeLoad: async ({ location }) => {
		await requireAuth(location.pathname);
		await requireCommitteeMember();
	},
	component: CommitteeLayout,
});

function CommitteeLayout() {
	return (
		<Sidebar items={committeeNav}>
			<Outlet />
		</Sidebar>
	);
}
