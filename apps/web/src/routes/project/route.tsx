import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useState } from "react";
import {
	type Project,
	ProjectSelector,
} from "@/components/layout/ProjectSelector";
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
	const [projects] = useState<Project[]>([
		{ id: "demo-1", name: "模擬店グルメフェス" },
	]);
	const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
		"demo-1"
	);

	return (
		<div className={styles.layout}>
			<Sidebar
				collapsed={sidebarCollapsed}
				onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
				menuItems={projectMenuItems}
				projectSelector={
					<ProjectSelector
						projects={projects}
						selectedProjectId={selectedProjectId}
						collapsed={sidebarCollapsed}
						onSelectProject={setSelectedProjectId}
						onCreateProject={() => alert("企画作成モーダル（未実装）")}
						onJoinProject={() => alert("招待コード入力モーダル（未実装）")}
					/>
				}
			/>
			<main className={styles.main}>
				<Outlet />
			</main>
		</div>
	);
}
