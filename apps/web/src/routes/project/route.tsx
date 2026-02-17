import type { Project } from "@sos26/shared";
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ProjectSelector } from "@/components/layout/ProjectSelector";
import { projectMenuItems, Sidebar } from "@/components/layout/Sidebar";
import { ProjectCreateDialog } from "@/components/project/ProjectCreateDialog";
import { joinProject, listMyProjects } from "@/lib/api/project";
import { requireAuth, useAuthStore } from "@/lib/auth";
import { ProjectContext } from "@/lib/project/context";
import styles from "./route.module.scss";

export const Route = createFileRoute("/project")({
	beforeLoad: async ({ location }) => {
		await requireAuth(location.pathname);
	},
	component: ProjectLayout,
	loader: async () => {
		return await listMyProjects();
	},
});

function ProjectLayout() {
	const navigate = useNavigate();
	const loaderData = Route.useLoaderData();
	const [projects, setProjects] = useState(loaderData.projects);
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
	const [dialogOpen, setDialogOpen] = useState(false);
	const { user } = useAuthStore();
	const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
		projects[0]?.id ?? null
	);

	const hasOwnerProject = projects.some(
		project => project.ownerId === user?.id || project.subOwnerId === user?.id
	);

	const handleJoinProject = async (inviteCode: string) => {
		try {
			const { project } = await joinProject({ inviteCode });

			setProjects(prev => {
				if (prev.some(p => p.id === project.id)) return prev;
				return [...prev, project];
			});
		} catch (err) {
			console.error(err);
			alert(
				"プロジェクトへの参加に失敗しました。招待コードを確認してください。"
			);
		}
	};

	return (
		<div className={styles.layout}>
			<Sidebar
				collapsed={sidebarCollapsed}
				onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
				menuItems={projectMenuItems}
				projectId={selectedProjectId}
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
							navigate({
								to: "/project",
							});
							setSelectedProjectId(projectId);
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
				<ProjectContext.Provider
					value={
						projects.find(project => project.id === selectedProjectId) || null
					}
				>
					<Outlet />
				</ProjectContext.Provider>
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
