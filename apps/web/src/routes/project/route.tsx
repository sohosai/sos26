import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Sidebar } from "@/components/layout/Sidebar/Sidebar";
import { requireAuth } from "@/lib/auth";

const projectNav = [{ label: "ダッシュボード", to: "/project" }];

export const Route = createFileRoute("/project")({
	beforeLoad: async ({ location }) => {
		await requireAuth(location.pathname);
	},
	component: ProjectLayout,
});

function ProjectLayout() {
	return (
		<Sidebar items={projectNav}>
			<Outlet />
		</Sidebar>
	);
}
