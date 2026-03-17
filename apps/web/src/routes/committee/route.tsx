import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { ForbiddenErrorBoundary } from "@/components/layout/ForbiddenContent";
import { committeeMenuItems, Sidebar } from "@/components/layout/Sidebar";
import {
	preloadMemberEditPermission,
	requireAuth,
	requireCommitteeMember,
	useAuthStore,
} from "@/lib/auth";
import styles from "./route.module.scss";

export const Route = createFileRoute("/committee")({
	beforeLoad: async ({ location }) => {
		await requireAuth(location.pathname);
		await requireCommitteeMember();
		useAuthStore.getState().setActivePortal("committee");
		await preloadMemberEditPermission();
	},
	errorComponent: ForbiddenErrorBoundary,
	component: CommitteeLayout,
});

function CommitteeLayout() {
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

	return (
		<div className={styles.layout}>
			<Sidebar
				collapsed={sidebarCollapsed}
				onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
				menuItems={committeeMenuItems}
			/>
			<main
				className={`${styles.main} ${sidebarCollapsed ? styles.collapsed : ""}`}
			>
				<Outlet />
			</main>
		</div>
	);
}
