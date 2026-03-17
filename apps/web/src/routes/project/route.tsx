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
import { listProjectForms } from "@/lib/api/project-form";
import { listProjectInquiries } from "@/lib/api/project-inquiry";
import { listProjectNotices } from "@/lib/api/project-notice";
import {
	preloadMemberEditPermission,
	requireAuth,
	useAuthStore,
} from "@/lib/auth";
import { useProjectStore } from "@/lib/project/store";
import styles from "./route.module.scss";

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
	loader: async () => {
		const { selectedProjectId } = useProjectStore.getState();

		if (!selectedProjectId) {
			return {
				hasUnansweredForms: false,
				hasUncheckedNotices: false,
				hasPendingInquiries: false,
			};
		}

		const [formsResult, noticesResult, inquiriesResult] =
			await Promise.allSettled([
				listProjectForms(selectedProjectId),
				listProjectNotices(selectedProjectId),
				listProjectInquiries(selectedProjectId),
			]);

		const forms =
			formsResult.status === "fulfilled" ? formsResult.value.forms : [];
		const notices =
			noticesResult.status === "fulfilled" ? noticesResult.value.notices : [];
		const inquiries =
			inquiriesResult.status === "fulfilled"
				? inquiriesResult.value.inquiries
				: [];

		const now = new Date();
		const hasUnansweredForms = forms.some(form => {
			if (form.restricted) return false;
			if (form.response?.submittedAt) return false;

			const isExpired =
				form.deadlineAt && !form.allowLateResponse && now > form.deadlineAt;
			if (isExpired) return false;

			return !form.response;
		});

		const hasUncheckedNotices = notices.some(notice => !notice.isRead);
		const hasPendingInquiries = inquiries.some(
			inquiry => !inquiry.isDraft && inquiry.status !== "RESOLVED"
		);

		return {
			hasUnansweredForms,
			hasUncheckedNotices,
			hasPendingInquiries,
		};
	},
	component: ProjectLayout,
});

function ProjectLayout() {
	const { hasUnansweredForms, hasUncheckedNotices, hasPendingInquiries } =
		Route.useLoaderData();
	const navigate = useNavigate();
	const router = useRouter();
	const { projects, selectedProjectId, setSelectedProjectId, setProjects } =
		useProjectStore();
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
	const [dialogOpen, setDialogOpen] = useState(false);
	const { user } = useAuthStore();

	const hasPrivilegedProject = projects.some(
		project => project.ownerId === user?.id || project.subOwnerId === user?.id
	);
	const projectMenuItemsWithDot = projectMenuItems.map(item => ({
		...item,
		showNotificationDot:
			(item.to === "/project/forms" && hasUnansweredForms) ||
			(item.to === "/project/notice" && hasUncheckedNotices) ||
			(item.to === "/project/support" && hasPendingInquiries),
	}));

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
				menuItems={projectMenuItemsWithDot}
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
