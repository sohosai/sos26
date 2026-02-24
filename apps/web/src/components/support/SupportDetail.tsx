import { Badge, Heading, Separator, Text } from "@radix-ui/themes";
import { IconArrowLeft, IconCheck } from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/primitives";
import { formatDate } from "@/lib/format";
import { AssigneeList, AssigneePopover } from "./AssigneeSection";
import { statusConfig } from "./constants";
import { ReplySection } from "./ReplySection";
import styles from "./SupportDetail.module.scss";
import { ActivityItem, TimelineItem } from "./Timeline";
import type {
	ActivityInfo,
	CommentInfo,
	InquiryDetail,
	ViewerDetail,
	ViewerInput,
} from "./types";
import { ViewerSettings } from "./ViewerSettings";

type SupportDetailProps = {
	inquiry: InquiryDetail;
	viewerRole: "project" | "committee";
	basePath: string;
	currentUserId: string;
	committeeMembers: { id: string; name: string }[];
	projectMembers: { id: string; name: string }[];
	onUpdateStatus: (status: "RESOLVED" | "IN_PROGRESS") => Promise<void>;
	onAddComment: (body: string, fileIds?: string[]) => Promise<void>;
	onAddAssignee: (
		userId: string,
		side: "PROJECT" | "COMMITTEE"
	) => Promise<void>;
	onRemoveAssignee: (assigneeId: string) => Promise<void>;
	viewers?: ViewerDetail[];
	onUpdateViewers?: (viewers: ViewerInput[]) => Promise<void>;
	/** 実委側: 担当者 or 管理者かどうか（編集 UI の出し分け） */
	isAssigneeOrAdmin?: boolean;
};

export function SupportDetail({
	inquiry,
	viewerRole,
	basePath,
	currentUserId,
	committeeMembers,
	projectMembers,
	onUpdateStatus,
	onAddComment,
	onAddAssignee,
	onRemoveAssignee,
	viewers,
	onUpdateViewers,
	isAssigneeOrAdmin = false,
}: SupportDetailProps) {
	const navigate = useNavigate();

	const config = statusConfig[inquiry.status];
	const StatusIcon = config.icon;

	// 実委側で担当者/管理者の場合のみ編集 UI を表示
	const canEditCommittee = viewerRole === "committee" && isAssigneeOrAdmin;
	// 担当者/管理者のみコメント可能
	const canComment = isAssigneeOrAdmin;

	const handleRemoveAssignee = async (assigneeId: string, userId: string) => {
		if (userId === currentUserId) {
			const confirmed = window.confirm(
				"自分自身を担当者から外すと、このお問い合わせにアクセスできなくなる可能性があります。よろしいですか？"
			);
			if (!confirmed) return;
			try {
				await onRemoveAssignee(assigneeId);
				navigate({ to: basePath as string });
			} catch {
				toast.error("担当者の削除に失敗しました");
			}
			return;
		}
		try {
			await onRemoveAssignee(assigneeId);
		} catch {
			toast.error("担当者の削除に失敗しました");
		}
	};

	const toggleAssignee = async (
		userId: string,
		side: "PROJECT" | "COMMITTEE"
	) => {
		const assignees =
			side === "COMMITTEE"
				? inquiry.committeeAssignees
				: inquiry.projectAssignees;
		const existing = assignees.find(a => a.user.id === userId);
		if (existing) {
			await handleRemoveAssignee(existing.id, userId);
		} else {
			await onAddAssignee(userId, side);
		}
	};

	// コメントとアクティビティを時系列で統合
	type TimelineEntry =
		| { kind: "comment"; data: CommentInfo }
		| { kind: "activity"; data: ActivityInfo };

	const timelineEntries: TimelineEntry[] = [
		...inquiry.comments.map(m => ({ kind: "comment" as const, data: m })),
		...inquiry.activities.map(a => ({
			kind: "activity" as const,
			data: a,
		})),
	].sort(
		(a, b) =>
			new Date(a.data.createdAt).getTime() -
			new Date(b.data.createdAt).getTime()
	);

	return (
		<div className={styles.layout}>
			<div className={styles.main}>
				<button
					type="button"
					className={styles.backLink}
					onClick={() => navigate({ to: basePath as string })}
				>
					<IconArrowLeft size={16} />
					<Text size="2">お問い合わせ一覧に戻る</Text>
				</button>

				<header className={styles.titleSection}>
					<div className={styles.titleRow}>
						<span className={styles.statusIcon} data-status={inquiry.status}>
							<StatusIcon size={24} />
						</span>
						<Heading size="5">{inquiry.title}</Heading>
					</div>
					<Text size="2" color="gray">
						{inquiry.createdBy.name} が{" "}
						{formatDate(inquiry.createdAt, "datetime")} に作成
					</Text>
				</header>

				{/* 本文（最初の投稿） */}
				<div className={styles.timeline}>
					<TimelineItem
						name={inquiry.createdBy.name}
						role={inquiry.creatorRole === "COMMITTEE" ? "committee" : "project"}
						date={inquiry.createdAt}
						body={inquiry.body}
						attachments={inquiry.attachments}
					/>

					{timelineEntries.map(entry =>
						entry.kind === "comment" ? (
							<TimelineItem
								key={entry.data.id}
								name={entry.data.createdBy.name}
								role={
									entry.data.senderRole === "COMMITTEE"
										? "committee"
										: "project"
								}
								date={entry.data.createdAt}
								body={entry.data.body}
								attachments={entry.data.attachments}
							/>
						) : (
							<ActivityItem key={entry.data.id} activity={entry.data} />
						)
					)}
				</div>

				<Separator size="4" />

				{inquiry.status !== "RESOLVED" ? (
					<ReplySection onAddComment={onAddComment} disabled={!canComment} />
				) : (
					<section className={styles.replySection}>
						<Text size="2" color="gray">
							このお問い合わせは解決済みのため、コメントを追加できません。
						</Text>
						{viewerRole === "project" && (
							<Button
								intent="secondary"
								onClick={() => onUpdateStatus("IN_PROGRESS")}
							>
								再オープンする
							</Button>
						)}
					</section>
				)}
			</div>

			{/* サイドバー */}
			<aside className={styles.sidebar}>
				<div className={styles.sidebarSection}>
					<Text size="2" weight="medium" color="gray">
						対応状況
					</Text>
					<Badge color={config.color} size="2" variant="soft">
						<StatusIcon size={14} />
						{config.label}
					</Badge>
				</div>

				<Separator size="4" />

				{/* 実行委員担当者 */}
				<div className={styles.sidebarSection}>
					<Text size="2" weight="medium" color="gray">
						実行委員 担当者
					</Text>
					<AssigneeList
						assignees={inquiry.committeeAssignees}
						variant="committee"
						canEdit={canEditCommittee}
						onRemove={(assigneeId, userId) =>
							handleRemoveAssignee(assigneeId, userId)
						}
					/>
					{canEditCommittee && (
						<AssigneePopover
							members={committeeMembers}
							assignees={inquiry.committeeAssignees}
							side="COMMITTEE"
							onToggle={toggleAssignee}
						/>
					)}
				</div>

				<Separator size="4" />

				{/* 企画側担当者 */}
				<div className={styles.sidebarSection}>
					<Text size="2" weight="medium" color="gray">
						企画側 担当者
					</Text>
					<AssigneeList
						assignees={inquiry.projectAssignees}
						variant="project"
						canEdit={canEditCommittee || viewerRole === "project"}
						onRemove={(assigneeId, userId) =>
							handleRemoveAssignee(assigneeId, userId)
						}
					/>
					{(canEditCommittee || viewerRole === "project") && (
						<AssigneePopover
							members={projectMembers}
							assignees={inquiry.projectAssignees}
							side="PROJECT"
							onToggle={toggleAssignee}
						/>
					)}
				</div>

				<Separator size="4" />

				{/* 関連フォーム */}
				<div className={styles.sidebarSection}>
					<Text size="2" weight="medium" color="gray">
						関連フォーム
					</Text>
					<Text size="1" color="gray">
						なし
					</Text>
				</div>

				{viewerRole === "committee" && viewers && (
					<>
						<Separator size="4" />
						<ViewerSettings
							viewers={viewers}
							committeeMembers={committeeMembers}
							onUpdate={onUpdateViewers}
							readOnly={!canEditCommittee}
						/>
					</>
				)}

				{canEditCommittee && (
					<>
						<Separator size="4" />
						{inquiry.status !== "RESOLVED" && (
							<Button
								intent="secondary"
								onClick={() => onUpdateStatus("RESOLVED")}
							>
								<IconCheck size={16} />
								解決済みにする
							</Button>
						)}
						{inquiry.status === "RESOLVED" && (
							<Button
								intent="secondary"
								onClick={() => onUpdateStatus("IN_PROGRESS")}
							>
								再オープンする
							</Button>
						)}
					</>
				)}
			</aside>
		</div>
	);
}
