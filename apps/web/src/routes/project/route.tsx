import { Callout } from "@radix-ui/themes";
import type { Project } from "@sos26/shared";
import {
	createFileRoute,
	Outlet,
	useNavigate,
	useRouter,
} from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ProjectSelector } from "@/components/layout/ProjectSelector";
import { projectMenuItems, Sidebar } from "@/components/layout/Sidebar";
import { ProjectCreateDialog } from "@/components/project/ProjectCreateDialog";
import { joinProject, listMyProjects } from "@/lib/api/project";
import {
	preloadMemberEditPermission,
	requireAuth,
	useAuthStore,
} from "@/lib/auth";
import { useProjectStore } from "@/lib/project/store";
import styles from "./route.module.scss";

function projectDeletionStatusLabel(status: Project["deletionStatus"]): string {
	if (status === "LOTTERY_LOSS") return "抽選漏れ";
	if (status === "DELETED") return "削除";
	return "";
}

export const Route = createFileRoute("/project")({
	beforeLoad: async ({ location }) => {
		await requireAuth(location.pathname);
		useAuthStore.getState().setActivePortal("project");
		await preloadMemberEditPermission();

		const res = await listMyProjects();

		const store = useProjectStore.getState();
		const currentId = store.selectedProjectId;
		const isValid =
			currentId && res.projects.some((p: Project) => p.id === currentId);

		store.setProjects(res.projects);
		if (!isValid && res.projects[0]) {
			store.setSelectedProjectId(res.projects[0].id);
		}
	},
	component: ProjectLayout,
});

function ProjectLayout() {
	const navigate = useNavigate();
	const router = useRouter();
	const { projects, selectedProjectId, setSelectedProjectId, setProjects } =
		useProjectStore();
	const selectedProject =
		projects.find(p => p.id === selectedProjectId) ?? null;
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
	const [dialogOpen, setDialogOpen] = useState(false);
	const { user } = useAuthStore();

	const hasPrivilegedProject = projects.some(
		project => project.ownerId === user?.id || project.subOwnerId === user?.id
	);

	const handleSelectProject = (projectId: string) => {
		setSelectedProjectId(projectId);
		navigate({ to: "/project" });
	};

	const handleJoinProject = async (inviteCode: string) => {
		try {
			const { project } = await joinProject({ inviteCode });

			if (!projects.some(p => p.id === project.id)) {
				setProjects([...projects, project]);
			}

			setSelectedProjectId(project.id);
			router.invalidate();
		} catch {
			toast.error("企画への参加に失敗しました。招待コードを確認してください。");
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
						onSelectProject={handleSelectProject}
						onCreateProject={() => setDialogOpen(true)}
						onJoinProject={handleJoinProject}
						hasPrivilegedProject={hasPrivilegedProject}
					/>
				}
			/>
			<main
				className={`${styles.main} ${sidebarCollapsed ? styles.collapsed : ""}`}
			>
				{selectedProject && selectedProject.deletionStatus !== null && (
					<Callout.Root color="red" style={{ marginBottom: 12 }}>
						<Callout.Text>
							この企画は「
							{projectDeletionStatusLabel(selectedProject.deletionStatus)}
							」として扱われています。
						</Callout.Text>
					</Callout.Root>
				)}
				{selectedProjectId && <Outlet key={selectedProjectId} />}
			</main>
			<ProjectCreateDialog
				open={dialogOpen}
				onOpenChange={setDialogOpen}
				onCreated={project => {
					setProjects([...projects, project]);
					setSelectedProjectId(project.id);
					router.invalidate();
				}}
			/>
		</div>
	);
}
