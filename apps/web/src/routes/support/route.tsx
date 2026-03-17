import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useState } from "react";
import {
	committeeMenuItems,
	projectMenuItems,
	Sidebar,
} from "@/components/layout/Sidebar";
import {
	preloadMemberEditPermission,
	requireAuth,
	useAuthStore,
} from "@/lib/auth";
import styles from "./route.module.scss";

export const Route = createFileRoute("/support")({
	beforeLoad: async ({ location }) => {
		await requireAuth(location.pathname);
		await preloadMemberEditPermission();
	},
	component: SupportLayout,
});

function SupportLayout() {
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
	const { activePortal, isCommitteeMember } = useAuthStore();

	const menuItems =
		activePortal === "committee"
			? committeeMenuItems
			: activePortal === "project"
				? projectMenuItems
				: isCommitteeMember
					? committeeMenuItems
					: projectMenuItems;

	return (
		<div className={styles.layout}>
			<Sidebar
				collapsed={sidebarCollapsed}
				onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
				menuItems={menuItems}
			/>
			<main
				className={`${styles.main} ${sidebarCollapsed ? styles.collapsed : ""}`}
			>
				<Outlet />
			</main>
		</div>
	);
}
