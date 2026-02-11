import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { projectMenuItems, Sidebar } from "@/components/layout/Sidebar";
import { requireAuth } from "@/lib/auth";
import styles from "./route.module.scss";

export const Route = createFileRoute("/project")({
	beforeLoad: async ({ location }) => {
		await requireAuth(location.pathname);
	},
	component: ProjectLayout,
});

function ProjectLayout() {
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

	return (
		<div className={styles.layout}>
			<Sidebar
				collapsed={sidebarCollapsed}
				onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
				menuItems={projectMenuItems}
			/>
			<main className={styles.main}>
				<Outlet />
			</main>
		</div>
	);
}
