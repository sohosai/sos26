import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { Header } from "@/components/layout/Header/Header";
import {
	committeeMenuItems,
	projectMenuItems,
	Sidebar,
} from "@/components/layout/Sidebar";
import { preloadMemberEditPermission, useAuthStore } from "@/lib/auth";
import styles from "./route.module.scss";

export const Route = createFileRoute("/support")({
	beforeLoad: async () => {
		const { isLoggedIn } = useAuthStore.getState();
		if (isLoggedIn) {
			await preloadMemberEditPermission();
		}
	},
	component: SupportLayout,
});

function SupportLayout() {
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
	const { activePortal, isCommitteeMember, isLoggedIn } = useAuthStore();

	if (!isLoggedIn) {
		return (
			<div className={styles.publicLayout}>
				<Header />
				<main className={styles.publicMain}>
					<Outlet />
				</main>
			</div>
		);
	}

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
