import { AlertDialog, Badge, Heading, Separator, Text } from "@radix-ui/themes";
import {
	IconArrowLeft,
	IconCheck,
	IconFileDescription,
} from "@tabler/icons-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
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
	CommitteeCommentInfo,
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
	onAddComment: (
		body: string,
		fileIds?: string[],
		isDraft?: boolean
	) => Promise<void>;
	onAddAssignee: (
		userId: string,
		side: "PROJECT" | "COMMITTEE"
	) => Promise<void>;
	onRemoveAssignee: (assigneeId: string) => Promise<void>;
	onPublishDraft?: (commentId: string) => Promise<void>;
	onDeleteComment?: (commentId: string) => Promise<void>;
	viewers?: ViewerDetail[];
	onUpdateViewers?: (viewers: ViewerInput[]) => Promise<void>;
	/** 実委側: 担当者 or 管理者かどうか（編集 UI の出し分け） */
	isAssigneeOrAdmin?: boolean;
};

type ReplyTab = "comment" | "draft";

type TimelineEntry =
	| { kind: "comment"; data: CommentInfo }
	| { kind: "activity"; data: ActivityInfo };

function isCommitteeDraftComment(
	comment: CommentInfo
): comment is CommitteeCommentInfo {
	return "isDraft" in comment && comment.isDraft === true;
}

function getDraftComments(
	comments: CommentInfo[],
	viewerRole: "project" | "committee"
): CommitteeCommentInfo[] {
	if (viewerRole !== "committee") {
		return [];
	}
	return comments.filter(isCommitteeDraftComment);
}

function toTimelineRole(senderRole: "PROJECT" | "COMMITTEE") {
	return senderRole === "COMMITTEE" ? "committee" : "project";
}

function buildTimelineEntries(
	regularComments: CommentInfo[],
	activities: ActivityInfo[]
): TimelineEntry[] {
	return [
		...regularComments.map(comment => ({
			kind: "comment" as const,
			data: comment,
		})),
		...activities.map(activity => ({
			kind: "activity" as const,
			data: activity,
		})),
	].sort(
		(a, b) =>
			new Date(a.data.createdAt).getTime() -
			new Date(b.data.createdAt).getTime()
	);
}

function InquiryTimeline({
	inquiry,
	timelineEntries,
}: {
	inquiry: InquiryDetail;
	timelineEntries: TimelineEntry[];
}) {
	return (
		<div className={styles.timeline}>
			<TimelineItem
				name={inquiry.createdBy.name}
				role={inquiry.creatorRole === "COMMITTEE" ? "committee" : "project"}
				date={inquiry.createdAt}
				body={inquiry.body}
				attachments={inquiry.attachments}
			/>

			{timelineEntries.map(entry => {
				if (entry.kind === "comment") {
					return (
						<TimelineItem
							key={entry.data.id}
							name={entry.data.createdBy.name}
							role={toTimelineRole(entry.data.senderRole)}
							date={entry.data.createdAt}
							body={entry.data.body}
							attachments={entry.data.attachments}
						/>
					);
				}

				return <ActivityItem key={entry.data.id} activity={entry.data} />;
			})}
		</div>
	);
}

function DraftCommentItem({
	comment,
	currentUserId,
	onPublishDraft,
	onDeleteComment,
}: {
	comment: CommitteeCommentInfo;
	currentUserId: string;
	onPublishDraft?: (commentId: string) => Promise<void>;
	onDeleteComment?: (commentId: string) => Promise<void>;
}) {
	const isOwnDraft = comment.draftCreatedById === currentUserId;
	const handlePublishDraft =
		isOwnDraft && onPublishDraft ? () => onPublishDraft(comment.id) : undefined;
	const handleDeleteDraft =
		isOwnDraft && onDeleteComment
			? () => onDeleteComment(comment.id)
			: undefined;

	return (
		<TimelineItem
			name={comment.createdBy.name}
			role={toTimelineRole(comment.senderRole)}
			date={comment.createdAt}
			body={comment.body}
			attachments={comment.attachments}
			isDraft
			isOwnDraft={isOwnDraft}
			onPublishDraft={handlePublishDraft}
			onDeleteDraft={handleDeleteDraft}
		/>
	);
}

function DraftCommentsPanel({
	draftComments,
	currentUserId,
	onPublishDraft,
	onDeleteComment,
}: {
	draftComments: CommitteeCommentInfo[];
	currentUserId: string;
	onPublishDraft?: (commentId: string) => Promise<void>;
	onDeleteComment?: (commentId: string) => Promise<void>;
}) {
	if (draftComments.length === 0) {
		return (
			<Text size="2" color="gray">
				下書きはありません。
			</Text>
		);
	}

	return (
		<div className={styles.draftList}>
			{draftComments.map(comment => (
				<DraftCommentItem
					key={comment.id}
					comment={comment}
					currentUserId={currentUserId}
					onPublishDraft={onPublishDraft}
					onDeleteComment={onDeleteComment}
				/>
			))}
		</div>
	);
}

function InquiryReplyPanel({
	inquiryStatus,
	viewerRole,
	activeReplyTab,
	onChangeReplyTab,
	draftComments,
	currentUserId,
	canComment,
	onAddComment,
	onPublishDraft,
	onDeleteComment,
	onUpdateStatus,
}: {
	inquiryStatus: InquiryDetail["status"];
	viewerRole: "project" | "committee";
	activeReplyTab: ReplyTab;
	onChangeReplyTab: (tab: ReplyTab) => void;
	draftComments: CommitteeCommentInfo[];
	currentUserId: string;
	canComment: boolean;
	onAddComment: SupportDetailProps["onAddComment"];
	onPublishDraft?: (commentId: string) => Promise<void>;
	onDeleteComment?: (commentId: string) => Promise<void>;
	onUpdateStatus: (status: "RESOLVED" | "IN_PROGRESS") => Promise<void>;
}) {
	if (inquiryStatus === "RESOLVED") {
		return (
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
		);
	}

	const isDraftTab = viewerRole === "committee" && activeReplyTab === "draft";

	return (
		<section className={styles.replySection}>
			{viewerRole === "committee" && (
				<div className={styles.replyTabs} role="tablist" aria-label="返信操作">
					<button
						type="button"
						role="tab"
						aria-selected={activeReplyTab === "comment"}
						data-active={activeReplyTab === "comment" || undefined}
						className={styles.replyTabButton}
						onClick={() => onChangeReplyTab("comment")}
					>
						コメントを追加
					</button>
					<button
						type="button"
						role="tab"
						aria-selected={activeReplyTab === "draft"}
						data-active={activeReplyTab === "draft" || undefined}
						className={styles.replyTabButton}
						onClick={() => onChangeReplyTab("draft")}
					>
						下書き
						<span className={styles.replyTabCount}>{draftComments.length}</span>
					</button>
				</div>
			)}

			{isDraftTab ? (
				<section className={styles.draftTabPanel}>
					<Heading size="3">下書き</Heading>
					<DraftCommentsPanel
						draftComments={draftComments}
						currentUserId={currentUserId}
						onPublishDraft={onPublishDraft}
						onDeleteComment={onDeleteComment}
					/>
				</section>
			) : (
				<ReplySection
					onAddComment={onAddComment}
					disabled={!canComment}
					enableDraft={viewerRole === "committee"}
				/>
			)}
		</section>
	);
}

function RelatedFormContent({
	relatedForm,
	viewerRole,
}: {
	relatedForm: InquiryDetail["relatedForm"];
	viewerRole: "project" | "committee";
}) {
	if (!relatedForm) {
		return (
			<Text size="1" color="gray">
				なし
			</Text>
		);
	}

	if (viewerRole === "committee") {
		return (
			<Link
				to="/committee/forms/$formId"
				params={{ formId: relatedForm.id }}
				className={styles.formLink}
			>
				<IconFileDescription size={16} />
				<Text size="2">{relatedForm.title}</Text>
			</Link>
		);
	}

	return (
		<div className={styles.formLink}>
			<IconFileDescription size={16} />
			<Text size="2">{relatedForm.title}</Text>
		</div>
	);
}

function SupportSidebar({
	inquiry,
	viewerRole,
	committeeMembers,
	projectMembers,
	viewers,
	onUpdateViewers,
	canEditCommittee,
	onUpdateStatus,
	onToggleAssignee,
	onRemoveAssignee,
	statusLabel,
	statusColor,
	StatusIcon,
}: {
	inquiry: InquiryDetail;
	viewerRole: "project" | "committee";
	committeeMembers: { id: string; name: string }[];
	projectMembers: { id: string; name: string }[];
	viewers?: ViewerDetail[];
	onUpdateViewers?: (viewers: ViewerInput[]) => Promise<void>;
	canEditCommittee: boolean;
	onUpdateStatus: (status: "RESOLVED" | "IN_PROGRESS") => Promise<void>;
	onToggleAssignee: (
		userId: string,
		side: "PROJECT" | "COMMITTEE"
	) => Promise<void>;
	onRemoveAssignee: (assigneeId: string, userId: string) => Promise<void>;
	statusLabel: string;
	statusColor: "orange" | "blue" | "green";
	StatusIcon: typeof IconCheck;
}) {
	const canEditProjectAssignee = canEditCommittee || viewerRole === "project";

	return (
		<aside className={styles.sidebar}>
			<div className={styles.sidebarSection}>
				<Text size="2" weight="medium" color="gray">
					対応状況
				</Text>
				<Badge color={statusColor} size="2" variant="soft">
					<StatusIcon size={14} />
					{statusLabel}
				</Badge>
			</div>

			<Separator size="4" />

			<div className={styles.sidebarSection}>
				<Text size="2" weight="medium" color="gray">
					実行委員 担当者
				</Text>
				<AssigneeList
					assignees={inquiry.committeeAssignees}
					variant="committee"
					canEdit={canEditCommittee}
					onRemove={onRemoveAssignee}
				/>
				{canEditCommittee && (
					<AssigneePopover
						members={committeeMembers}
						assignees={inquiry.committeeAssignees}
						side="COMMITTEE"
						onToggle={onToggleAssignee}
					/>
				)}
			</div>

			<Separator size="4" />

			<div className={styles.sidebarSection}>
				<Text size="2" weight="medium" color="gray">
					企画側 担当者
				</Text>
				<AssigneeList
					assignees={inquiry.projectAssignees}
					variant="project"
					canEdit={canEditProjectAssignee}
					onRemove={onRemoveAssignee}
				/>
				{canEditProjectAssignee && (
					<AssigneePopover
						members={projectMembers}
						assignees={inquiry.projectAssignees}
						side="PROJECT"
						onToggle={onToggleAssignee}
					/>
				)}
			</div>

			<Separator size="4" />

			<div className={styles.sidebarSection}>
				<Text size="2" weight="medium" color="gray">
					関連申請
				</Text>
				<RelatedFormContent
					relatedForm={inquiry.relatedForm}
					viewerRole={viewerRole}
				/>
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
					{inquiry.status !== "RESOLVED" ? (
						<Button
							intent="secondary"
							onClick={() => onUpdateStatus("RESOLVED")}
						>
							<IconCheck size={16} />
							解決済みにする
						</Button>
					) : (
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
	);
}

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
	onPublishDraft,
	onDeleteComment,
	viewers,
	onUpdateViewers,
	isAssigneeOrAdmin = false,
}: SupportDetailProps) {
	const navigate = useNavigate();
	const [selfRemoveConfirmOpen, setSelfRemoveConfirmOpen] = useState(false);
	const [pendingRemoveAssigneeId, setPendingRemoveAssigneeId] = useState<
		string | null
	>(null);
	const [activeReplyTab, setActiveReplyTab] = useState<"comment" | "draft">(
		"comment"
	);

	const config = statusConfig[inquiry.status];
	const StatusIcon = config.icon;

	// 実委側で担当者/管理者の場合のみ編集 UI を表示
	const canEditCommittee = viewerRole === "committee" && isAssigneeOrAdmin;
	// 担当者/管理者のみコメント可能
	const canComment = isAssigneeOrAdmin;
	const regularComments = inquiry.comments.filter(
		comment => !isCommitteeDraftComment(comment)
	);
	const draftComments = getDraftComments(inquiry.comments, viewerRole);

	const handleRemoveAssignee = async (assigneeId: string, userId: string) => {
		if (userId === currentUserId) {
			setPendingRemoveAssigneeId(assigneeId);
			setSelfRemoveConfirmOpen(true);
			return;
		}
		try {
			await onRemoveAssignee(assigneeId);
		} catch {
			toast.error("担当者の削除に失敗しました");
		}
	};

	const handleConfirmSelfRemove = async () => {
		if (!pendingRemoveAssigneeId) return;
		try {
			await onRemoveAssignee(pendingRemoveAssigneeId);
			setSelfRemoveConfirmOpen(false);
			setPendingRemoveAssigneeId(null);
			navigate({ to: basePath as string });
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

	const timelineEntries = buildTimelineEntries(
		regularComments,
		inquiry.activities
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

				<InquiryTimeline inquiry={inquiry} timelineEntries={timelineEntries} />

				<InquiryReplyPanel
					inquiryStatus={inquiry.status}
					viewerRole={viewerRole}
					activeReplyTab={activeReplyTab}
					onChangeReplyTab={setActiveReplyTab}
					draftComments={draftComments}
					currentUserId={currentUserId}
					canComment={canComment}
					onAddComment={onAddComment}
					onPublishDraft={onPublishDraft}
					onDeleteComment={onDeleteComment}
					onUpdateStatus={onUpdateStatus}
				/>
			</div>

			<SupportSidebar
				inquiry={inquiry}
				viewerRole={viewerRole}
				committeeMembers={committeeMembers}
				projectMembers={projectMembers}
				viewers={viewers}
				onUpdateViewers={onUpdateViewers}
				canEditCommittee={canEditCommittee}
				onUpdateStatus={onUpdateStatus}
				onToggleAssignee={toggleAssignee}
				onRemoveAssignee={handleRemoveAssignee}
				statusLabel={config.label}
				statusColor={config.color}
				StatusIcon={StatusIcon}
			/>

			<AlertDialog.Root
				open={selfRemoveConfirmOpen}
				onOpenChange={setSelfRemoveConfirmOpen}
			>
				<AlertDialog.Content maxWidth="400px">
					<AlertDialog.Title>担当者から外す</AlertDialog.Title>
					<AlertDialog.Description size="2">
						自分自身を担当者から外すと、このお問い合わせにアクセスできなくなる可能性があります。よろしいですか？
					</AlertDialog.Description>
					<div
						style={{
							display: "flex",
							gap: "8px",
							justifyContent: "flex-end",
							marginTop: "16px",
						}}
					>
						<AlertDialog.Cancel>
							<Button intent="secondary" size="2">
								キャンセル
							</Button>
						</AlertDialog.Cancel>
						<Button intent="danger" size="2" onClick={handleConfirmSelfRemove}>
							外す
						</Button>
					</div>
				</AlertDialog.Content>
			</AlertDialog.Root>
		</div>
	);
}
