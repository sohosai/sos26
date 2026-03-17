import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useState } from "react";
import {
	committeeMenuItems,
	projectMenuItems,
	Sidebar,
} from "@/components/layout/Sidebar";
import { requireAuth, useAuthStore } from "@/lib/auth";
import styles from "./route.module.scss";

export const Route = createFileRoute("/support")({
	beforeLoad: async ({ location }) => {
		await requireAuth(location.pathname);
	},
	component: SupportLayout,
});

function SupportLayout() {
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
	const { isCommitteeMember } = useAuthStore();

	const menuItems = isCommitteeMember ? committeeMenuItems : projectMenuItems;

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
