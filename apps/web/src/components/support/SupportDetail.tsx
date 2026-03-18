import { AlertDialog, Badge, Heading, Separator, Text } from "@radix-ui/themes";
import {
	IconArrowLeft,
	IconCheck,
	IconFileDescription,
	IconPaperclip,
	IconTrash,
	IconX,
} from "@tabler/icons-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/primitives";
import { formatDate, formatFileSize } from "@/lib/format";
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
import { useAssigneeRemovalConfirmation } from "./useAssigneeRemovalConfirmation";
import { useDraftInquiryActions } from "./useDraftInquiryActions";
import { useDraftInquiryState } from "./useDraftInquiryState";
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
	onUpdateDraft?: (commentId: string, body: string) => Promise<void>;
	onPublishDraftInquiry?: () => Promise<void>;
	onDeleteDraftInquiry?: () => Promise<void>;
	onUpdateDraftInquiry?: (
		title: string,
		body: string,
		fileIds?: string[]
	) => Promise<void>;
	viewers?: ViewerDetail[];
	onUpdateViewers?: (viewers: ViewerInput[]) => Promise<void>;
	/** 権限チェック: 全管理 or 担当者かどうか(編集 UI の出現判定) */
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

function getCommentDisplayDate(comment: CommentInfo): Date {
	if (isCommitteeDraftComment(comment)) {
		return comment.createdAt;
	}
	return comment.sentAt ?? comment.createdAt;
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
	].sort((a, b) => {
		const aDate =
			a.kind === "comment" ? getCommentDisplayDate(a.data) : a.data.createdAt;
		const bDate =
			b.kind === "comment" ? getCommentDisplayDate(b.data) : b.data.createdAt;
		return new Date(aDate).getTime() - new Date(bDate).getTime();
	});
}

function InquiryTimeline({
	inquiry,
	timelineEntries,
	currentUserId,
	onPublishDraft,
	onDeleteComment,
	onUpdateDraft,
}: {
	inquiry: InquiryDetail;
	timelineEntries: TimelineEntry[];
	currentUserId: string;
	onPublishDraft?: (commentId: string) => Promise<void>;
	onDeleteComment?: (commentId: string) => Promise<void>;
	onUpdateDraft?: (commentId: string, body: string) => Promise<void>;
}) {
	return (
		<div className={styles.timeline}>
			<TimelineItem
				name={inquiry.createdBy.name}
				committeeBureau={inquiry.createdBy.committeeBureau}
				affiliatedProjects={inquiry.createdBy.affiliatedProjects}
				role={inquiry.creatorRole === "COMMITTEE" ? "committee" : "project"}
				date={inquiry.createdAt}
				body={inquiry.body}
				attachments={inquiry.attachments}
			/>

			{timelineEntries.map(entry => {
				if (entry.kind === "comment") {
					const isDraft = isCommitteeDraftComment(entry.data);
					const isOwnDraft =
						isDraft && entry.data.createdBy.id === currentUserId;
					return (
						<TimelineItem
							key={entry.data.id}
							name={entry.data.createdBy.name}
							committeeBureau={entry.data.createdBy.committeeBureau}
							affiliatedProjects={entry.data.createdBy.affiliatedProjects}
							role={toTimelineRole(entry.data.senderRole)}
							date={getCommentDisplayDate(entry.data)}
							body={entry.data.body}
							attachments={entry.data.attachments}
							isDraft={isDraft}
							isOwnDraft={isOwnDraft}
							onPublishDraft={
								isDraft && isOwnDraft
									? () =>
											onPublishDraft
												? onPublishDraft(entry.data.id)
												: Promise.resolve()
									: undefined
							}
							onDeleteDraft={
								isDraft && isOwnDraft
									? () =>
											onDeleteComment
												? onDeleteComment(entry.data.id)
												: Promise.resolve()
									: undefined
							}
							onUpdateDraft={
								isDraft && isOwnDraft
									? (body: string) =>
											onUpdateDraft
												? onUpdateDraft(entry.data.id, body)
												: Promise.resolve()
									: undefined
							}
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
	onUpdateDraft,
}: {
	comment: CommitteeCommentInfo;
	currentUserId: string;
	onPublishDraft?: (commentId: string) => Promise<void>;
	onDeleteComment?: (commentId: string) => Promise<void>;
	onUpdateDraft?: (commentId: string, body: string) => Promise<void>;
}) {
	const isOwnDraft = comment.createdBy.id === currentUserId;
	const handlePublishDraft =
		isOwnDraft && onPublishDraft ? () => onPublishDraft(comment.id) : undefined;
	const handleDeleteDraft =
		isOwnDraft && onDeleteComment
			? () => onDeleteComment(comment.id)
			: undefined;
	const handleUpdateDraft =
		isOwnDraft && onUpdateDraft
			? (body: string) => onUpdateDraft(comment.id, body)
			: undefined;

	return (
		<TimelineItem
			name={comment.createdBy.name}
			committeeBureau={comment.createdBy.committeeBureau}
			affiliatedProjects={comment.createdBy.affiliatedProjects}
			role={toTimelineRole(comment.senderRole)}
			date={comment.createdAt}
			body={comment.body}
			attachments={comment.attachments}
			isDraft
			isOwnDraft={isOwnDraft}
			onPublishDraft={handlePublishDraft}
			onDeleteDraft={handleDeleteDraft}
			onUpdateDraft={handleUpdateDraft}
		/>
	);
}

function DraftCommentsPanel({
	draftComments,
	currentUserId,
	onPublishDraft,
	onDeleteComment,
	onUpdateDraft,
}: {
	draftComments: CommitteeCommentInfo[];
	currentUserId: string;
	onPublishDraft?: (commentId: string) => Promise<void>;
	onDeleteComment?: (commentId: string) => Promise<void>;
	onUpdateDraft?: (commentId: string, body: string) => Promise<void>;
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
					onUpdateDraft={onUpdateDraft}
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
	onUpdateDraft,
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
	onUpdateDraft?: (commentId: string, body: string) => Promise<void>;
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
						{draftComments.length > 0 && (
							<span className={styles.replyTabCount}>
								{draftComments.length}
							</span>
						)}
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
						onUpdateDraft={onUpdateDraft}
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
	currentUserId,
	isDraftEditing,
	onStartEditDraft,
	onCancelEditDraft,
	onSaveDraft,
	onPublishDraftInquiry,
	isSavingDraft,
	isPublishingDraftInquiry,
	isDeletingDraftInquiry,
	onRequestDeleteDraftInquiry,
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
	currentUserId: string;
	isDraftEditing: boolean;
	onStartEditDraft: () => void;
	onCancelEditDraft: () => void;
	onSaveDraft: () => Promise<void>;
	onPublishDraftInquiry?: () => Promise<void>;
	isSavingDraft: boolean;
	isPublishingDraftInquiry: boolean;
	isDeletingDraftInquiry: boolean;
	onRequestDeleteDraftInquiry: () => void;
}) {
	const canEditProjectAssignee = canEditCommittee || viewerRole === "project";
	const isDraftInquiry = "isDraft" in inquiry && inquiry.isDraft === true;
	const isOwnDraftInquiry =
		isDraftInquiry && inquiry.createdById === currentUserId;

	const renderDraftActions = () => {
		if (isDraftEditing) {
			return (
				<>
					<Button
						intent="secondary"
						size="2"
						onClick={onCancelEditDraft}
						disabled={isSavingDraft}
					>
						キャンセル
					</Button>
					<Button size="2" onClick={onSaveDraft} loading={isSavingDraft}>
						{isSavingDraft ? "保存中..." : "保存"}
					</Button>
				</>
			);
		}

		return (
			<>
				<Button
					intent="primary"
					size="2"
					onClick={onPublishDraftInquiry}
					loading={isPublishingDraftInquiry}
					disabled={isPublishingDraftInquiry || isDeletingDraftInquiry}
				>
					{isPublishingDraftInquiry ? "送信中..." : "送信する"}
				</Button>
				<Button
					intent="secondary"
					size="2"
					onClick={onStartEditDraft}
					disabled={isPublishingDraftInquiry || isDeletingDraftInquiry}
				>
					編集
				</Button>
				<Button
					intent="ghost"
					size="2"
					onClick={onRequestDeleteDraftInquiry}
					loading={isDeletingDraftInquiry}
					disabled={isPublishingDraftInquiry || isDeletingDraftInquiry}
				>
					<IconTrash size={14} />
					{isDeletingDraftInquiry ? "削除中..." : "削除"}
				</Button>
			</>
		);
	};

	const renderStatusActions = () => {
		if (isDraftInquiry && isOwnDraftInquiry) {
			return (
				<div className={styles.draftSidebarActions}>{renderDraftActions()}</div>
			);
		}

		if (inquiry.status !== "RESOLVED") {
			return (
				<Button intent="secondary" onClick={() => onUpdateStatus("RESOLVED")}>
					<IconCheck size={16} />
					解決済みにする
				</Button>
			);
		}

		return (
			<Button intent="secondary" onClick={() => onUpdateStatus("IN_PROGRESS")}>
				再オープンする
			</Button>
		);
	};

	return (
		<aside className={styles.sidebar}>
			<div className={styles.sidebarSection}>
				<Text size="2" weight="medium" color="gray">
					対応状況
				</Text>
				<div>
					<Badge color={statusColor} size="2" variant="soft">
						<StatusIcon size={14} />
						{statusLabel}
					</Badge>
				</div>
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
					{renderStatusActions()}
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
	onUpdateDraft,
	onPublishDraftInquiry,
	onDeleteDraftInquiry,
	onUpdateDraftInquiry,
	viewers,
	onUpdateViewers,
	isAssigneeOrAdmin = false,
}: SupportDetailProps) {
	const navigate = useNavigate();
	const [activeReplyTab, setActiveReplyTab] = useState<"comment" | "draft">(
		"comment"
	);

	// Custom hooks for state management
	const draftState = useDraftInquiryState(inquiry);
	const assigneeRemoval = useAssigneeRemovalConfirmation(
		onRemoveAssignee,
		basePath
	);
	const draftActions = useDraftInquiryActions(
		onPublishDraftInquiry,
		onDeleteDraftInquiry
	);

	const isDraftInquiry = "isDraft" in inquiry && inquiry.isDraft === true;
	const isOwnDraftInquiry =
		isDraftInquiry && inquiry.createdById === currentUserId;
	const config = isDraftInquiry
		? { label: "下書き", color: "orange" as const, icon: IconFileDescription }
		: statusConfig[inquiry.status];
	const StatusIcon = config.icon;

	// 権限チェック: 全管理 or 担当者のみ編集 UI を表示
	const canEditCommittee = viewerRole === "committee" && isAssigneeOrAdmin;
	// 権限チェック: 全管理 or 担当者のみコメント可
	const canComment = isAssigneeOrAdmin;
	const regularComments = inquiry.comments.filter(
		comment => !isCommitteeDraftComment(comment)
	);
	const draftComments = getDraftComments(inquiry.comments, viewerRole);

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
			await assigneeRemoval.handleRemoveAssignee(
				existing.id,
				userId,
				currentUserId
			);
		} else {
			await onAddAssignee(userId, side);
		}
	};

	// Wrapper for SupportSidebar which needs a different signature
	const handleSidebarRemoveAssignee = async (
		assigneeId: string,
		userId: string
	) => {
		await assigneeRemoval.handleRemoveAssignee(
			assigneeId,
			userId,
			currentUserId
		);
	};

	const handleSaveDraft = async () => {
		if (!onUpdateDraftInquiry) return;
		if (
			!draftState.validateDraft(draftState.draftTitle, draftState.draftBody)
		) {
			return;
		}
		if (draftState.isSavingDraft) return;
		draftState.setIsSavingDraft(true);
		try {
			const newFileIds = await draftState.uploadDraftFiles(
				draftState.draftFiles
			);
			const existingFileIds = draftState.draftAttachments.map(
				att => att.fileId
			);
			const fileIds = [...existingFileIds, ...newFileIds];
			await onUpdateDraftInquiry(
				draftState.draftTitle.trim(),
				draftState.draftBody.trim(),
				fileIds
			);
			draftState.setEditingDraft(false);
			draftState.setDraftFiles([]);
		} catch {
			// Error is handled in the hook
		} finally {
			draftState.setIsSavingDraft(false);
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
						<span
							className={styles.statusIcon}
							data-status={isDraftInquiry ? "DRAFT" : inquiry.status}
						>
							<StatusIcon size={24} />
						</span>
						{draftState.editingDraft && isOwnDraftInquiry ? (
							<input
								type="text"
								value={draftState.draftTitle}
								onChange={e => draftState.setDraftTitle(e.target.value)}
								className={styles.editTitleInput}
								placeholder="題目を入力"
							/>
						) : (
							<Heading size="5">{inquiry.title}</Heading>
						)}
					</div>
					<Text size="2" color="gray">
						{inquiry.createdBy.name} が{" "}
						{formatDate(inquiry.createdAt, "datetime")} に作成
					</Text>
				</header>

				{draftState.editingDraft && isOwnDraftInquiry ? (
					<div className={styles.editBodySection}>
						<textarea
							value={draftState.draftBody}
							onChange={e => draftState.setDraftBody(e.target.value)}
							className={styles.editBodyTextarea}
							placeholder="本文を入力"
							rows={10}
						/>
						<div className={styles.editAttachmentSection}>
							<Text size="2" weight="medium">
								添付ファイル
							</Text>
							{draftState.draftAttachments.length > 0 && (
								<div className={styles.selectedFiles}>
									{draftState.draftAttachments.map(att => (
										<div key={att.id} className={styles.selectedFileItem}>
											<IconPaperclip size={14} />
											<Text size="1">{att.fileName}</Text>
											<Text size="1" color="gray">
												({formatFileSize(att.size)})
											</Text>
											<button
												type="button"
												className={styles.selectedFileRemove}
												onClick={() => draftState.removeDraftAttachment(att.id)}
											>
												<IconX size={12} />
											</button>
										</div>
									))}
								</div>
							)}
							{draftState.draftFiles.length > 0 && (
								<div className={styles.selectedFiles}>
									{draftState.draftFiles.map((file, index) => (
										<div
											key={`${file.name}-${index}`}
											className={styles.selectedFileItem}
										>
											<IconPaperclip size={14} />
											<Text size="1">{file.name}</Text>
											<Text size="1" color="gray">
												({formatFileSize(file.size)})
											</Text>
											<button
												type="button"
												className={styles.selectedFileRemove}
												onClick={() => draftState.removeDraftFile(index)}
											>
												<IconX size={12} />
											</button>
										</div>
									))}
								</div>
							)}
							<div className={styles.replyFileArea}>
								<input
									ref={draftState.draftFileInputRef}
									type="file"
									multiple
									className={styles.fileInput}
									onChange={draftState.handleDraftFileSelect}
								/>
								<button
									type="button"
									className={styles.fileSelectButton}
									onClick={() => draftState.draftFileInputRef.current?.click()}
								>
									<IconPaperclip size={16} />
									<Text size="2">ファイルを選択</Text>
								</button>
							</div>
						</div>
					</div>
				) : (
					<InquiryTimeline
						inquiry={inquiry}
						timelineEntries={timelineEntries}
						currentUserId={currentUserId}
						onPublishDraft={onPublishDraft}
						onDeleteComment={onDeleteComment}
						onUpdateDraft={onUpdateDraft}
					/>
				)}

				{!isDraftInquiry && (
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
						onUpdateDraft={onUpdateDraft}
						onUpdateStatus={onUpdateStatus}
					/>
				)}
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
				onRemoveAssignee={handleSidebarRemoveAssignee}
				statusLabel={config.label}
				statusColor={config.color}
				StatusIcon={StatusIcon}
				currentUserId={currentUserId}
				isDraftEditing={draftState.editingDraft}
				onStartEditDraft={draftState.handleStartEditDraft}
				onCancelEditDraft={draftState.handleCancelEditDraft}
				onSaveDraft={handleSaveDraft}
				onPublishDraftInquiry={draftActions.handlePublishDraftInquiry}
				isSavingDraft={draftState.isSavingDraft}
				isPublishingDraftInquiry={draftActions.isPublishingDraftInquiry}
				isDeletingDraftInquiry={draftActions.isDeletingDraftInquiry}
				onRequestDeleteDraftInquiry={
					draftActions.handleRequestDeleteDraftInquiry
				}
			/>

			<AlertDialog.Root
				open={assigneeRemoval.selfRemoveConfirmOpen}
				onOpenChange={assigneeRemoval.setSelfRemoveConfirmOpen}
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
						<Button
							intent="danger"
							size="2"
							onClick={assigneeRemoval.handleConfirmSelfRemove}
						>
							外す
						</Button>
					</div>
				</AlertDialog.Content>
			</AlertDialog.Root>

			<AlertDialog.Root
				open={draftActions.deleteDraftConfirmOpen}
				onOpenChange={draftActions.setDeleteDraftConfirmOpen}
			>
				<AlertDialog.Content maxWidth="400px">
					<AlertDialog.Title>下書きを削除</AlertDialog.Title>
					<AlertDialog.Description size="2">
						本の下書きを削除しますか？削除の操作は戻せません。
					</AlertDialog.Description>
					<div className={styles.deleteActions}>
						<AlertDialog.Cancel>
							<Button intent="secondary" size="2">
								キャンセル
							</Button>
						</AlertDialog.Cancel>
						<Button
							intent="danger"
							size="2"
							onClick={draftActions.handleConfirmDeleteDraftInquiry}
							loading={draftActions.isDeletingDraftInquiry}
						>
							削除する
						</Button>
					</div>
				</AlertDialog.Content>
			</AlertDialog.Root>
		</div>
	);
}
