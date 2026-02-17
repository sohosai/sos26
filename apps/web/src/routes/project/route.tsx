import type { Project } from "@sos26/shared";
import { createFileRoute, Outlet, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { ProjectSelector } from "@/components/layout/ProjectSelector";
import { projectMenuItems, Sidebar } from "@/components/layout/Sidebar";
import { ProjectCreateDialog } from "@/components/project/ProjectCreateDialog";
import { joinProject, listMyProjects } from "@/lib/api/project";
import { requireAuth, useAuthStore } from "@/lib/auth";
import { useProjectStore } from "@/lib/project/store";
import styles from "./route.module.scss";

export const Route = createFileRoute("/project")({
	beforeLoad: async ({ location }) => {
		await requireAuth(location.pathname);
	},
	component: ProjectLayout,
	loader: async () => {
		const result = await listMyProjects();

		// ストアに selectedProjectId が未設定なら先頭を選択
		const store = useProjectStore.getState();
		if (!store.selectedProjectId && result.projects[0]) {
			useProjectStore.setState({ selectedProjectId: result.projects[0].id });
		}

		// selectedProjectId が確定している場合、プロジェクト詳細を取得
		const projectId = useProjectStore.getState().selectedProjectId;
		if (projectId) {
			await useProjectStore.getState().fetchProjectDetail();
		}

		return result;
	},
});

function ProjectLayout() {
	const router = useRouter();
	const loaderData = Route.useLoaderData();
	const [projects, setProjects] = useState(loaderData.projects);
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
	const [dialogOpen, setDialogOpen] = useState(false);
	const { user } = useAuthStore();
	const selectedProjectId = useProjectStore(s => s.selectedProjectId);

	const hasOwnerProject = projects.some(
		project => project.ownerId === user?.id || project.subOwnerId === user?.id
	);

	const handleJoinProject = async (inviteCode: string) => {
		const { project } = await joinProject({ inviteCode });

		setProjects(prev => {
			if (prev.some(p => p.id === project.id)) return prev;
			return [...prev, project];
		});
	};

	return (
		<div className={styles.layout}>
			<Sidebar
				collapsed={sidebarCollapsed}
				onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
				menuItems={projectMenuItems}
				projectSelector={
					<ProjectSelector
						projects={projects.map((project: Project) => {
							return {
								id: project.id,
								name: project.name,
							};
						})}
						selectedProjectId={selectedProjectId}
						collapsed={sidebarCollapsed}
						onSelectProject={projectId => {
							useProjectStore.getState().setSelectedProjectId(projectId);
							router.invalidate();
						}}
						onCreateProject={() => setDialogOpen(true)}
						onJoinProject={handleJoinProject}
						hasOwnerProject={hasOwnerProject}
					/>
				}
			/>
			<main
				className={`${styles.main} ${sidebarCollapsed ? styles.collapsed : ""}`}
			>
				<Outlet />
			</main>
			<ProjectCreateDialog
				open={dialogOpen}
				onOpenChange={setDialogOpen}
				onCreated={project => {
					setProjects(prev => [...prev, project]);
				}}
			/>
		</div>
	);
}
