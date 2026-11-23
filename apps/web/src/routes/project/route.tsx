import { Callout, Heading, Text } from "@radix-ui/themes";
import type {
	GetApplicationPeriodResponse,
	GetProjectNotificationStatusResponse,
	MyProject,
	Project,
} from "@sos26/shared";
import {
	createFileRoute,
	type ErrorComponentProps,
	Outlet,
	useNavigate,
	useRouter,
} from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { RouteError } from "@/components/common/RouteError";
import { ProjectSelector } from "@/components/layout/ProjectSelector";
import { projectMenuItems, Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/primitives";
import { ProjectCreateDialog } from "@/components/project/ProjectCreateDialog";
import { ProjectJoinDialog } from "@/components/project/ProjectJoinDialog";
import { getApplicationPeriod, joinProject } from "@/lib/api/project";
import { requireAuth, useAuthStore } from "@/lib/auth";
import { reportHandledError } from "@/lib/error/report";
import { refreshMyProjects } from "@/lib/project/my-projects";
import { registerNotificationDotRefresh } from "@/lib/project/notification-status";
import { useProjectStore } from "@/lib/project/store";
import { queryClient } from "@/lib/query/client";
import {
	projectNotificationStatusQuery,
	projectQueryKeys,
} from "@/lib/query/project";
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

function isNotificationStatusChanged(
	prev: GetProjectNotificationStatusResponse,
	next: GetProjectNotificationStatusResponse
): boolean {
	return (
		next.hasUnansweredForms !== prev.hasUnansweredForms ||
		next.hasUncheckedNotices !== prev.hasUncheckedNotices ||
		next.hasUnreadInquiryComments !== prev.hasUnreadInquiryComments ||
		next.latestActivityAt?.getTime() !== prev.latestActivityAt?.getTime()
	);
}

/**
 * notification-status を取り直し、キャッシュにあった前回の値から変わったかを返す。
 * 変わっていたら、次に loader が一覧を取得するときに取り直すよう、notification-status 以外の企画の query を古くする
 */
async function refreshNotificationStatusCache(projectId: string): Promise<{
	next: GetProjectNotificationStatusResponse;
	changed: boolean;
}> {
	const query = projectNotificationStatusQuery(projectId);
	const prev = queryClient.getQueryData(query.queryKey);
	const next = await queryClient.fetchQuery({ ...query, staleTime: 0 });
	const changed = prev !== undefined && isNotificationStatusChanged(prev, next);
	if (changed) {
		await queryClient.invalidateQueries({
			queryKey: projectQueryKeys.all(projectId),
			predicate: q => q.queryKey[2] !== "notification-status",
			refetchType: "none",
		});
	}
	return { next, changed };
}

/**
 * /project に入ったときに取得した申請期間。取得に失敗したときは null。
 * ルートの自動コード分割で別チャンクから参照されるため、変数ではなくオブジェクトの値を書き換える
 */
const applicationPeriodCache: {
	/** まだ取得していないときは undefined */
	info: GetApplicationPeriodResponse | null | undefined;
} = {
	info: undefined,
};

/** loader が最後に読み込んだ企画。ルートの自動コード分割のため、オブジェクトの値を書き換える */
const loadedProject: { id: string | null | undefined } = { id: undefined };

export const Route = createFileRoute("/project")({
	beforeLoad: async ({ location, cause }) => {
		await requireAuth(location.href);
		useAuthStore.getState().setActivePortal("project");

		// 子ルートの loader が選択中の企画を使うので、loader ではなくここで決める。
		// /project の中でページを移るたびには取得せず、一覧が変わりうる操作のあとに refreshMyProjects を呼ぶ。
		// 入ったときの取得に失敗した場合に備えて、一覧が空のときも取り直す
		if (cause === "enter" || useProjectStore.getState().projects.length === 0) {
			await refreshMyProjects();
		}

		// 一覧はキャッシュから返すので、ページを移るたびに新着の有無だけを確かめ、あれば子ルートの loader で取り直させる。
		// 取得に失敗したときは loader で扱う
		const { selectedProjectId } = useProjectStore.getState();
		if (selectedProjectId) {
			await refreshNotificationStatusCache(selectedProjectId).catch(
				() => undefined
			);
		}
	},
	// /project の中でページを移るたびには、通知状態と公開情報を取り直さない。
	// 取り直すのは、/project に入ったとき、選択中の企画が変わったとき、router.invalidate() されたとき（新着の反映や企画の作成・参加など）
	shouldReload: ({ cause }) =>
		cause === "enter" ||
		useProjectStore.getState().selectedProjectId !== loadedProject.id,
	loader: async ({ cause }) => {
		const store = useProjectStore.getState();
		const { selectedProjectId } = store;
		loadedProject.id = selectedProjectId;

		const applicationPeriodPromise =
			cause === "enter" || applicationPeriodCache.info === undefined
				? getApplicationPeriod().catch(() => null)
				: Promise.resolve(applicationPeriodCache.info);

		if (!selectedProjectId) {
			applicationPeriodCache.info = await applicationPeriodPromise;
			return {
				applicationPeriodInfo: applicationPeriodCache.info,
				notificationStatus: EMPTY_NOTIFICATION_STATUS,
			};
		}

		const [applicationPeriodResult, notificationStatusResult] =
			await Promise.allSettled([
				applicationPeriodPromise,
				queryClient.fetchQuery(
					projectNotificationStatusQuery(selectedProjectId)
				),
			]);
		// applicationPeriodPromise は失敗を null にしているので reject しない
		const applicationPeriodInfo =
			applicationPeriodResult.status === "fulfilled"
				? applicationPeriodResult.value
				: null;
		applicationPeriodCache.info = applicationPeriodInfo;

		const notificationStatus =
			notificationStatusResult.status === "fulfilled"
				? notificationStatusResult.value
				: { ...EMPTY_NOTIFICATION_STATUS, hasUnreadInquiryComments: true };

		return {
			applicationPeriodInfo,
			notificationStatus,
		};
	},
	component: ProjectLayout,
	errorComponent: ProjectErrorComponent,
});

/**
 * 企画から外されたときやアカウントを切り替えたときは、選択中の企画で子ページを読めずにエラーになる。
 * 企画一覧を取り直して選択中の企画が変わったらダッシュボードへ移り、変わらなければエラーを表示する。
 * 移動するのは、問い合わせ詳細のように URL に前の企画の ID を含むページを、切り替えた企画で開き直さないため
 */
function ProjectErrorComponent({ error }: ErrorComponentProps) {
	const router = useRouter();
	const [recoveryFailed, setRecoveryFailed] = useState(false);

	useEffect(() => {
		const before = useProjectStore.getState().selectedProjectId;
		refreshMyProjects()
			.then(() => {
				if (useProjectStore.getState().selectedProjectId !== before) {
					void router.navigate({ to: "/project" });
				} else {
					setRecoveryFailed(true);
				}
			})
			.catch(() => setRecoveryFailed(true));
	}, [router]);

	return recoveryFailed ? <RouteError error={error} /> : null;
}

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

	/** reflectChanges が false のときは、状態が変わっても開いている画面を取り直さない */
	const refreshNotificationStatus = useCallback(
		async ({ reflectChanges = true }: { reflectChanges?: boolean } = {}) => {
			if (!selectedProjectId) {
				setNotificationStatus(EMPTY_NOTIFICATION_STATUS);
				return;
			}

			try {
				const { next, changed } =
					await refreshNotificationStatusCache(selectedProjectId);
				// 応答を待つ間に企画が切り替わっていたら、前の企画の状態を反映しない
				if (
					useProjectStore.getState().selectedProjectId !== selectedProjectId
				) {
					return;
				}

				setNotificationStatus(next);
				// 開いている画面にも新しいお知らせや返信を反映する
				if (changed && reflectChanges) void router.invalidate();
			} catch {
				// 企画から外された場合に別の企画へ切り替える
				await refreshMyProjects().catch(() => undefined);
				void router.invalidate();
			}
		},
		[router, selectedProjectId]
	);

	useEffect(
		() =>
			registerNotificationDotRefresh(() =>
				refreshNotificationStatus({ reflectChanges: false })
			),
		[refreshNotificationStatus]
	);

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
