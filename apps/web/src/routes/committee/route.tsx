import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { ForbiddenErrorBoundary } from "@/components/layout/ForbiddenContent";
import { committeeMenuItems, Sidebar } from "@/components/layout/Sidebar";
import {
	preloadMemberEditPermission,
	preloadProjectRegistrationPermission,
	requireAuth,
	requireCommitteeMember,
	useAuthStore,
} from "@/lib/auth";
import styles from "./route.module.scss";

// /committee/notice/{noticeId}/ から noticeId を抽出する
function extractNoticeIdFromPath(pathname: string): string | undefined {
	const match = pathname.match(/^\/committee\/notice\/([^/]+)/);
	return match?.[1];
}

function isCommitteeNoticePath(pathname: string): boolean {
	return (
		pathname === "/committee/notice" ||
		pathname.startsWith("/committee/notice/")
	);
}

export const Route = createFileRoute("/committee")({
	beforeLoad: async ({ location }) => {
		await requireAuth(location.pathname);

		// 実委人でない場合、/committee/notice* は /project/notice に振り替える
		// (お知らせメールから企画者が踏んできた場合の救済)
		const { isCommitteeMember } = useAuthStore.getState();
		if (!isCommitteeMember && isCommitteeNoticePath(location.pathname)) {
			const noticeId = extractNoticeIdFromPath(location.pathname);
			throw redirect({
				to: "/project/notice",
				search: noticeId ? { noticeId } : {},
			});
		}

		await requireCommitteeMember();
		useAuthStore.getState().setActivePortal("committee");
		await preloadMemberEditPermission();
		await preloadProjectRegistrationPermission();
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
