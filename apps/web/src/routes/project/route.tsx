import { Callout, Heading, Text } from "@radix-ui/themes";
import type { MyProject, Project } from "@sos26/shared";
import {
	createFileRoute,
	Outlet,
	useNavigate,
	useRouter,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ProjectSelector } from "@/components/layout/ProjectSelector";
import { projectMenuItems, Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/primitives";
import { ProjectCreateDialog } from "@/components/project/ProjectCreateDialog";
import { ProjectJoinDialog } from "@/components/project/ProjectJoinDialog";
import {
	getApplicationPeriod,
	joinProject,
	listMyProjects,
} from "@/lib/api/project";
import { listProjectForms } from "@/lib/api/project-form";
import { listProjectInquiries } from "@/lib/api/project-inquiry";
import { listProjectNotices } from "@/lib/api/project-notice";
import { getProjectPublicInfo } from "@/lib/api/project-public-info";
import { requireAuth, useAuthStore } from "@/lib/auth";
import { reportHandledError } from "@/lib/error/report";
import { useProjectStore } from "@/lib/project/store";
import styles from "./route.module.scss";

function projectDeletionStatusLabel(status: Project["deletionStatus"]): string {
	if (status === "LOTTERY_LOSS") return "落選";
	if (status === "DELETED") return "企画中止";
	if (status === "PROJECT_WITHDRAWN") return "企画辞退";
	return "";
}

type EmptyProjectStateProps = {
	onCreateProject: () => void;
	onJoinProject: () => void;
	isApplicationPeriodOpen: boolean;
};

function EmptyProjectState({
	onCreateProject,
	onJoinProject,
	isApplicationPeriodOpen,
}: EmptyProjectStateProps) {
	const isOutsideApplicationPeriod = !isApplicationPeriodOpen;

	return (
		<div className={styles.emptyState}>
			<div className={styles.emptyStateContent}>
				{isOutsideApplicationPeriod ? (
					<>
						<Heading size="5" className={styles.emptyStateHeading}>
							企画応募期間外です
						</Heading>
						<Text
							as="p"
							size="2"
							color="gray"
							className={styles.emptyStateDescription}
						>
							現在は企画の新規作成ができません。
						</Text>
						<div className={styles.emptyStateActions}>
							<Button size="2" intent="secondary" onClick={onJoinProject}>
								企画参加コードで参加
							</Button>
						</div>
					</>
				) : (
					<>
						<Heading size="5" className={styles.emptyStateHeading}>
							企画に参加していません
						</Heading>
						<Text
							as="p"
							size="2"
							color="gray"
							className={styles.emptyStateDescription}
						>
							新規作成するか、企画参加コードを企画責任者から受け取って、企画に参加してください。
						</Text>
						<div className={styles.emptyStateActions}>
							<Button size="2" onClick={onCreateProject}>
								新しい企画を作成
							</Button>
							<Button size="2" intent="secondary" onClick={onJoinProject}>
								企画参加コードで参加
							</Button>
						</div>
					</>
				)}
			</div>
		</div>
	);
}

export const Route = createFileRoute("/project")({
	beforeLoad: async ({ location }) => {
		await requireAuth(location.href);
		useAuthStore.getState().setActivePortal("project");

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
		const store = useProjectStore.getState();
		const { selectedProjectId } = store;

		if (!selectedProjectId) {
			return {
				hasUnansweredForms: false,
				hasUncheckedNotices: false,
				hasUnreadInquiryComments: false,
				publicInfoProjectId: null,
				publicInfo: null,
				publicInfoLoadFailed: false,
			};
		}

		const [formsResult, noticesResult, inquiriesResult, publicInfoResult] =
			await Promise.allSettled([
				listProjectForms(selectedProjectId),
				listProjectNotices(selectedProjectId),
				listProjectInquiries(selectedProjectId),
				getProjectPublicInfo(selectedProjectId),
			]);

		// 企画公開情報は企画情報ページと共用する（重複取得を避ける）
		// サイドバーのアイコンは /project/list が返す iconFileId を使う
		const publicInfo =
			publicInfoResult.status === "fulfilled"
				? publicInfoResult.value.publicInfo
				: null;

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
			publicInfoProjectId: selectedProjectId,
			publicInfo,
			publicInfoLoadFailed: publicInfoResult.status === "rejected",
		};
	},
	component: ProjectLayout,
});

function ProjectLayout() {
	const { hasUnansweredForms, hasUncheckedNotices, hasUnreadInquiryComments } =
		Route.useLoaderData();
	const navigate = useNavigate();
	const router = useRouter();
	const { projects, selectedProjectId, setSelectedProjectId, setProjects } =
		useProjectStore();
	const selectedProject =
		projects.find(p => p.id === selectedProjectId) ?? null;
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
	const [applicationPeriodInfo, setApplicationPeriodInfo] = useState<{
		isOpen: boolean;
		periods: { start: string; end: string }[] | null;
	} | null>(null);
	const [createDialogOpen, setCreateDialogOpen] = useState(false);
	const [joinDialogOpen, setJoinDialogOpen] = useState(false);
	const { user } = useAuthStore();

	useEffect(() => {
		const fetchApplicationPeriod = async () => {
			try {
				const info = await getApplicationPeriod();
				setApplicationPeriodInfo(info);
			} catch {
				// API失敗時は保守的に期間外として扱う
				setApplicationPeriodInfo({ isOpen: false, periods: null });
			}
		};
		void fetchApplicationPeriod();
	}, []);

	const hasPrivilegedProject = projects.some(
		project =>
			project.deletionStatus === null &&
			(project.ownerId === user?.id || project.subOwnerId === user?.id)
	);
	const projectMenuItemsWithDot = projectMenuItems.map(item => ({
		...item,
		showNotificationDot:
			(item.to === "/project/forms" && hasUnansweredForms) ||
			(item.to === "/project/notice" && hasUncheckedNotices) ||
			(item.to === "/project/support" && hasUnreadInquiryComments),
	}));

	useEffect(() => {
		const intervalId = window.setInterval(() => {
			void router.invalidate();
		}, 60_000);

		const handleFocus = () => {
			void router.invalidate();
		};

		window.addEventListener("focus", handleFocus);
		document.addEventListener("visibilitychange", handleFocus);

		return () => {
			window.clearInterval(intervalId);
			window.removeEventListener("focus", handleFocus);
			document.removeEventListener("visibilitychange", handleFocus);
		};
	}, [router]);

	const handleSelectProject = (projectId: string) => {
		setSelectedProjectId(projectId);
		navigate({ to: "/project" });
	};

	const handleJoinProject = async (inviteCode: string) => {
		try {
			const { project } = await joinProject({ inviteCode });

			if (!projects.some(p => p.id === project.id)) {
				// アイコンは直後の invalidate による一覧再取得で反映される
				setProjects([...projects, { ...project, iconFileId: null }]);
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
				menuItems={projects.length > 0 ? projectMenuItemsWithDot : []}
				projectId={selectedProjectId}
				projectSelector={
					<ProjectSelector
						projects={projects.map((project: MyProject) => ({
							id: project.id,
							name: project.name,
							iconFileId: project.iconFileId,
						}))}
						selectedProjectId={selectedProjectId}
						collapsed={sidebarCollapsed}
						onSelectProject={handleSelectProject}
						onCreateProject={() => setCreateDialogOpen(true)}
						onJoinProject={handleJoinProject}
						hasPrivilegedProject={hasPrivilegedProject}
						applicationPeriodInfo={applicationPeriodInfo}
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
				{projects.length === 0 ? (
					applicationPeriodInfo ? (
						<EmptyProjectState
							onCreateProject={() => setCreateDialogOpen(true)}
							onJoinProject={() => setJoinDialogOpen(true)}
							isApplicationPeriodOpen={applicationPeriodInfo.isOpen}
						/>
					) : (
						<div className={styles.emptyState}>
							<div className={styles.emptyStateContent}>
								<Heading size="5" className={styles.emptyStateHeading}>
									読み込み中...
								</Heading>
							</div>
						</div>
					)
				) : (
					selectedProjectId && <Outlet key={selectedProjectId} />
				)}
			</main>
			<ProjectCreateDialog
				open={createDialogOpen}
				onOpenChange={setCreateDialogOpen}
				onCreated={project => {
					// アイコンは直後の invalidate による一覧再取得で反映される
					setProjects([...projects, { ...project, iconFileId: null }]);
					setSelectedProjectId(project.id);
					router.invalidate();
				}}
			/>
			<ProjectJoinDialog
				open={joinDialogOpen}
				onOpenChange={setJoinDialogOpen}
				onJoin={handleJoinProject}
			/>
		</div>
	);
}
