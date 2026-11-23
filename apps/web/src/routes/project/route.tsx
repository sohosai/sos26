import { Callout, Heading, Text } from "@radix-ui/themes";
import type {
	GetApplicationPeriodResponse,
	GetProjectNotificationStatusResponse,
	GetProjectPublicInfoResponse,
	MyProject,
	Project,
} from "@sos26/shared";
import {
	createFileRoute,
	Outlet,
	useNavigate,
	useRouter,
} from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ProjectSelector } from "@/components/layout/ProjectSelector";
import { projectMenuItems, Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/primitives";
import { ProjectCreateDialog } from "@/components/project/ProjectCreateDialog";
import { ProjectJoinDialog } from "@/components/project/ProjectJoinDialog";
import {
	getApplicationPeriod,
	getProjectNotificationStatus,
	joinProject,
} from "@/lib/api/project";
import { getProjectPublicInfo } from "@/lib/api/project-public-info";
import { requireAuth, useAuthStore } from "@/lib/auth";
import { reportHandledError } from "@/lib/error/report";
import { refreshMyProjects } from "@/lib/project/my-projects";
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

const EMPTY_NOTIFICATION_STATUS: GetProjectNotificationStatusResponse = {
	hasUnansweredForms: false,
	hasUncheckedNotices: false,
	hasUnreadInquiryComments: false,
	latestActivityAt: null,
};

/** 企画情報に対する実委人の非表示・修正の状態 */
type PublicInfoModeration = Omit<GetProjectPublicInfoResponse, "publicInfo">;

const EMPTY_PUBLIC_INFO_MODERATION: PublicInfoModeration = {
	hiddenFields: [],
	correctedFields: [],
	hiddenMapImageFileIds: [],
};

/**
 * /project に入ったときに取得した申請期間。取得に失敗したときは null。
 * ルートの自動コード分割で別チャンクから参照されるため、変数ではなくオブジェクトの値を書き換える
 */
const applicationPeriodCache: { info: GetApplicationPeriodResponse | null } = {
	info: null,
};

export const Route = createFileRoute("/project")({
	beforeLoad: async ({ location, cause }) => {
		await requireAuth(location.href);
		useAuthStore.getState().setActivePortal("project");

		// 子ルートの loader が選択中の企画を使うので、loader ではなくここで決める。
		// /project の中でページを移るたびには取得せず、一覧が変わりうる操作のあとに refreshMyProjects を呼ぶ
		if (cause === "enter") {
			await refreshMyProjects();
		}
	},
	loader: async ({ cause }) => {
		const store = useProjectStore.getState();
		const { selectedProjectId } = store;

		if (cause === "enter") {
			applicationPeriodCache.info = await getApplicationPeriod().catch(
				() => null
			);
		}

		if (!selectedProjectId) {
			return {
				applicationPeriodInfo: applicationPeriodCache.info,
				notificationStatus: EMPTY_NOTIFICATION_STATUS,
				publicInfoProjectId: null,
				publicInfo: null,
				publicInfoModeration: EMPTY_PUBLIC_INFO_MODERATION,
				publicInfoLoadFailed: false,
			};
		}

		const [notificationStatusResult, publicInfoResult] =
			await Promise.allSettled([
				getProjectNotificationStatus(selectedProjectId),
				getProjectPublicInfo(selectedProjectId),
			]);

		const notificationStatus =
			notificationStatusResult.status === "fulfilled"
				? notificationStatusResult.value
				: { ...EMPTY_NOTIFICATION_STATUS, hasUnreadInquiryComments: true };

		// 企画公開情報は企画情報ページと共用する（重複取得を避ける）
		// サイドバーのアイコンは /project/list が返す iconFileId を使う
		const publicInfo =
			publicInfoResult.status === "fulfilled"
				? publicInfoResult.value.publicInfo
				: null;
		const publicInfoModeration =
			publicInfoResult.status === "fulfilled"
				? {
						hiddenFields: publicInfoResult.value.hiddenFields,
						correctedFields: publicInfoResult.value.correctedFields,
						hiddenMapImageFileIds: publicInfoResult.value.hiddenMapImageFileIds,
					}
				: EMPTY_PUBLIC_INFO_MODERATION;

		return {
			applicationPeriodInfo: applicationPeriodCache.info,
			notificationStatus,
			publicInfoProjectId: selectedProjectId,
			publicInfo,
			publicInfoModeration,
			publicInfoLoadFailed: publicInfoResult.status === "rejected",
		};
	},
	component: ProjectLayout,
});

function ProjectLayout() {
	const {
		notificationStatus: initialNotificationStatus,
		applicationPeriodInfo: loadedApplicationPeriodInfo,
	} = Route.useLoaderData();
	// 取得に失敗したときは保守的に期間外として扱う
	const applicationPeriodInfo = loadedApplicationPeriodInfo ?? {
		isOpen: false,
		periods: null,
	};
	const navigate = useNavigate();
	const router = useRouter();
	const { projects, selectedProjectId, setSelectedProjectId, setProjects } =
		useProjectStore();
	const selectedProject =
		projects.find(p => p.id === selectedProjectId) ?? null;
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
	const [createDialogOpen, setCreateDialogOpen] = useState(false);
	const [joinDialogOpen, setJoinDialogOpen] = useState(false);
	const { user } = useAuthStore();
	const [notificationStatus, setNotificationStatus] = useState(
		initialNotificationStatus
	);

	const notificationStatusRef = useRef(notificationStatus);
	notificationStatusRef.current = notificationStatus;

	useEffect(() => {
		setNotificationStatus(initialNotificationStatus);
	}, [initialNotificationStatus]);

	const hasPrivilegedProject = projects.some(
		project =>
			project.deletionStatus === null &&
			(project.ownerId === user?.id || project.subOwnerId === user?.id)
	);
	const projectMenuItemsWithDot = projectMenuItems.map(item => ({
		...item,
		showNotificationDot:
			(item.to === "/project/forms" && notificationStatus.hasUnansweredForms) ||
			(item.to === "/project/notice" &&
				notificationStatus.hasUncheckedNotices) ||
			(item.to === "/project/support" &&
				notificationStatus.hasUnreadInquiryComments),
	}));

	const refreshNotificationStatus = useCallback(async () => {
		if (!selectedProjectId) {
			setNotificationStatus(EMPTY_NOTIFICATION_STATUS);
			return;
		}

		try {
			const next = await getProjectNotificationStatus(selectedProjectId);
			// 応答を待つ間に企画が切り替わっていたら、前の企画の状態を反映しない
			if (useProjectStore.getState().selectedProjectId !== selectedProjectId) {
				return;
			}

			const current = notificationStatusRef.current;
			const changed =
				next.hasUnansweredForms !== current.hasUnansweredForms ||
				next.hasUncheckedNotices !== current.hasUncheckedNotices ||
				next.hasUnreadInquiryComments !== current.hasUnreadInquiryComments ||
				next.latestActivityAt?.getTime() !==
					current.latestActivityAt?.getTime();

			setNotificationStatus(next);
			// 開いている画面にも新しいお知らせや返信を反映する
			if (changed) void router.invalidate();
		} catch {
			// 企画から外された場合に別の企画へ切り替える
			await refreshMyProjects().catch(() => undefined);
			void router.invalidate();
		}
	}, [router, selectedProjectId]);

	useEffect(() => {
		let lastRefreshAt = 0;
		const refreshIfNeeded = () => {
			if (document.visibilityState !== "visible") return;
			const now = Date.now();
			if (now - lastRefreshAt < 5_000) return;
			lastRefreshAt = now;
			void refreshNotificationStatus();
		};

		const intervalId = window.setInterval(refreshIfNeeded, 60_000);

		window.addEventListener("focus", refreshIfNeeded);
		document.addEventListener("visibilitychange", refreshIfNeeded);

		return () => {
			window.clearInterval(intervalId);
			window.removeEventListener("focus", refreshIfNeeded);
			document.removeEventListener("visibilitychange", refreshIfNeeded);
		};
	}, [refreshNotificationStatus]);

	const handleSelectProject = (projectId: string) => {
		setSelectedProjectId(projectId);
		navigate({ to: "/project" });
	};

	const handleJoinProject = async (inviteCode: string) => {
		try {
			const { project } = await joinProject({ inviteCode });

			if (!projects.some(p => p.id === project.id)) {
				// アイコンは直後の一覧の取り直しで反映される
				setProjects([...projects, { ...project, iconFileId: null }]);
			}

			setSelectedProjectId(project.id);
			void refreshMyProjects().catch(() => undefined);
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
					<EmptyProjectState
						onCreateProject={() => setCreateDialogOpen(true)}
						onJoinProject={() => setJoinDialogOpen(true)}
						isApplicationPeriodOpen={applicationPeriodInfo.isOpen}
					/>
				) : (
					selectedProjectId && <Outlet key={selectedProjectId} />
				)}
			</main>
			<ProjectCreateDialog
				open={createDialogOpen}
				onOpenChange={setCreateDialogOpen}
				onCreated={project => {
					// アイコンは直後の一覧の取り直しで反映される
					setProjects([...projects, { ...project, iconFileId: null }]);
					setSelectedProjectId(project.id);
					void refreshMyProjects().catch(() => undefined);
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
