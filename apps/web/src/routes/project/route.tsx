import type { Project } from "@sos26/shared";
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
	// type Project,
	ProjectSelector,
} from "@/components/layout/ProjectSelector";
import { projectMenuItems, Sidebar } from "@/components/layout/Sidebar";
import { ProjectCreateDialog } from "@/components/project/ProjectCreateDialog";
import { joinProject, listMyProjects } from "@/lib/api/project";
import { requireAuth } from "@/lib/auth";
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
	// const projects: Project[] = [{ id: "demo-1", name: "模擬店グルメフェス" }];

	const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
		// "demo-1"
		projects[0]?.id ?? null
	);

	// ページリロード時に/membersがなくなっちゃう
	useEffect(() => {
		if (!selectedProjectId) return;
		const exists = projects.some(p => p.id === selectedProjectId);
		if (!exists) return;
		navigate({
			to: "/project/$projectId",
			params: { projectId: selectedProjectId },
			replace: true,
		});
	}, [selectedProjectId, navigate, projects]);

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
								to: "/project/$projectId",
								params: { projectId },
							});
							setSelectedProjectId(projectId);
						}}
						onCreateProject={() => setDialogOpen(true)}
						onJoinProject={handleJoinProject}
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
