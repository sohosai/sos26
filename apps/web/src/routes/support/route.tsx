import {
	createFileRoute,
	Outlet,
	useNavigate,
	useRouter,
} from "@tanstack/react-router";
import { useState } from "react";
import { Header } from "@/components/layout/Header/Header";
import {
	type Project,
	ProjectSelector,
} from "@/components/layout/ProjectSelector";
import {
	committeeMenuItems,
	projectMenuItems,
	Sidebar,
} from "@/components/layout/Sidebar";
import { joinProject, listMyProjects } from "@/lib/api/project";
import { listProjectForms } from "@/lib/api/project-form";
import { listProjectInquiries } from "@/lib/api/project-inquiry";
import { listProjectNotices } from "@/lib/api/project-notice";
import { preloadMemberEditPermission, useAuthStore } from "@/lib/auth";
import { reportHandledError } from "@/lib/error/report";
import { useProjectStore } from "@/lib/project/store";
import styles from "./route.module.scss";

export const Route = createFileRoute("/support")({
	beforeLoad: async () => {
		const { isLoggedIn } = useAuthStore.getState();
        if (isLoggedIn) {
            await preloadMemberEditPermission();
            const res = await listMyProjects();
        }
		
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
				hasUnreadInquiryComments: false,
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

			return !form.response?.submittedAt;
		});

		const hasUncheckedNotices = notices.some(notice => !notice.isRead);
		const hasUnreadInquiryComments =
			inquiriesResult.status === "rejected"
				? true
				: inquiries.some(inquiry => inquiry.hasUnreadComments);

		return {
			hasUnansweredForms,
			hasUncheckedNotices,
			hasUnreadInquiryComments,
		};
	},
	component: SupportLayout,
});

function SupportLayout() {
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
	const { activePortal, isCommitteeMember, isLoggedIn } = useAuthStore();
	const navigate = useNavigate();
	const router = useRouter();
	const { user } = useAuthStore();
	const { projects, selectedProjectId, setSelectedProjectId, setProjects } =
		useProjectStore();

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

	function setCreateDialogOpen(): void {
		throw new Error("Function not implemented.");
	}

	const hasPrivilegedProject = projects.some(
		project => project.ownerId === user?.id || project.subOwnerId === user?.id
	);

	const handleSelectProject = (projectId: string) => {
		setSelectedProjectId(projectId);
		navigate({ to: "/support" });
	};

	const handleJoinProject = async (inviteCode: string) => {
		try {
			const { project } = await joinProject({ inviteCode });

			if (!projects.some(p => p.id === project.id)) {
				setProjects([...projects, project]);
			}

			setSelectedProjectId(project.id);
			router.invalidate();
		} catch (error) {
			reportHandledError({
				error,
				operation: "join_project",
				userMessage:
					"企画への参加に失敗しました。企画参加コードを確認してください。",
				ui: { type: "toast" },
				context: {
					projectId: selectedProjectId,
				},
			});
			throw error;
		}
	};
	return (
		<div className={styles.layout}>
			<Sidebar
				collapsed={sidebarCollapsed}
				onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
				menuItems={menuItems}
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
						onJoinProject={handleJoinProject}
						onCreateProject={setCreateDialogOpen}
						hasPrivilegedProject={hasPrivilegedProject}
					/>
				}
			/>
			<main
				className={`${styles.main} ${sidebarCollapsed ? styles.collapsed : ""}`}
			>
				<Outlet />
			</main>
		</div>
	);
}
