import {
	Badge,
	Heading,
	IconButton,
	Popover,
	TextField as RadixTextField,
	Separator,
	Text,
} from "@radix-ui/themes";
import type {
	Bureau,
	GetProjectInquiryResponse,
	InquiryAttachment,
	InquiryStatus,
	InquiryViewerScope,
} from "@sos26/shared";
import { bureauLabelMap } from "@sos26/shared";
import {
	IconAlertCircle,
	IconArrowLeft,
	IconCheck,
	IconChevronDown,
	IconCircleCheck,
	IconDownload,
	IconMessageDots,
	IconPaperclip,
	IconPlus,
	IconSearch,
	IconTrash,
	IconX,
} from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import Avatar from "boring-avatars";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { Button, TextArea } from "@/components/primitives";
import { downloadFile, uploadFile } from "@/lib/api/files";
import { formatFileSize } from "@/lib/format";
import { useStorageUrl } from "@/lib/storage";
import styles from "./SupportDetail.module.scss";

type InquiryDetail = GetProjectInquiryResponse["inquiry"];
type CommentInfo = InquiryDetail["comments"][number];
type ActivityInfo = InquiryDetail["activities"][number];
type AssigneeInfo = InquiryDetail["projectAssignees"][number];

type ViewerDetail = {
	id: string;
	scope: InquiryViewerScope;
	bureauValue: Bureau | null;
	createdAt: Date;
	user: { id: string; name: string } | null;
};

type ViewerInput = {
	scope: InquiryViewerScope;
	bureauValue?: Bureau;
	userId?: string;
};

type SupportDetailProps = {
	inquiry: InquiryDetail;
	viewerRole: "project" | "committee";
	basePath: string;
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

const statusConfig: Record<
	InquiryStatus,
	{
		label: string;
		color: "orange" | "blue" | "green";
		icon: typeof IconAlertCircle;
	}
> = {
	UNASSIGNED: {
		label: "担当者未割り当て",
		color: "orange",
		icon: IconAlertCircle,
	},
	IN_PROGRESS: { label: "対応中", color: "blue", icon: IconMessageDots },
	RESOLVED: { label: "解決済み", color: "green", icon: IconCircleCheck },
};

export function SupportDetail({
	inquiry,
	viewerRole,
	basePath,
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
	const [committeePopoverOpen, setCommitteePopoverOpen] = useState(false);
	const [projectPopoverOpen, setProjectPopoverOpen] = useState(false);
	const [committeeSearchQuery, setCommitteeSearchQuery] = useState("");
	const [projectSearchQuery, setProjectSearchQuery] = useState("");

	const config = statusConfig[inquiry.status];
	const StatusIcon = config.icon;

	// 実委側で担当者/管理者の場合のみ編集 UI を表示
	const canEditCommittee = viewerRole === "committee" && isAssigneeOrAdmin;
	// 担当者/管理者のみコメント可能
	const canComment = isAssigneeOrAdmin;

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
			await onRemoveAssignee(existing.id);
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

	// コメント投稿者のロールを推定
	const getCommentRole = (createdBy: {
		id: string;
		name: string;
	}): "project" | "committee" => {
		if (inquiry.committeeAssignees.some(a => a.user.id === createdBy.id)) {
			return "committee";
		}
		return "project";
	};

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
						{inquiry.createdBy.name} が {formatDateTime(inquiry.createdAt)}{" "}
						に作成
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
								role={getCommentRole(entry.data.createdBy)}
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
						onRemove={assigneeId => onRemoveAssignee(assigneeId)}
					/>
					{canEditCommittee && (
						<Popover.Root
							open={committeePopoverOpen}
							onOpenChange={o => {
								setCommitteePopoverOpen(o);
								if (!o) setCommitteeSearchQuery("");
							}}
						>
							<Popover.Trigger>
								<button type="button" className={styles.assignTrigger}>
									<Text size="1" color="gray">
										担当者を変更...
									</Text>
									<IconChevronDown size={14} />
								</button>
							</Popover.Trigger>
							<Popover.Content
								className={styles.assignPopover}
								side="bottom"
								align="start"
							>
								<div className={styles.assignSearch}>
									<RadixTextField.Root
										placeholder="検索..."
										size="1"
										value={committeeSearchQuery}
										onChange={e => setCommitteeSearchQuery(e.target.value)}
									>
										<RadixTextField.Slot>
											<IconSearch size={14} />
										</RadixTextField.Slot>
									</RadixTextField.Root>
								</div>
								<div className={styles.assignList}>
									{committeeMembers
										.filter(person => {
											const q = committeeSearchQuery.toLowerCase();
											if (!q) return true;
											return person.name.toLowerCase().includes(q);
										})
										.map(person => {
											const isAssigned = inquiry.committeeAssignees.some(
												a => a.user.id === person.id
											);
											return (
												<button
													key={person.id}
													type="button"
													className={`${styles.assignDropdownOption} ${isAssigned ? styles.assignDropdownOptionSelected : ""}`}
													onClick={() => toggleAssignee(person.id, "COMMITTEE")}
												>
													<Avatar size={20} name={person.name} variant="beam" />
													<div className={styles.assignDropdownOptionText}>
														<Text size="2">{person.name}</Text>
													</div>
													{isAssigned && (
														<IconCheck
															size={14}
															className={styles.assignDropdownOptionCheck}
														/>
													)}
												</button>
											);
										})}
								</div>
							</Popover.Content>
						</Popover.Root>
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
						onRemove={assigneeId => onRemoveAssignee(assigneeId)}
					/>
					{(canEditCommittee || viewerRole === "project") && (
						<Popover.Root
							open={projectPopoverOpen}
							onOpenChange={o => {
								setProjectPopoverOpen(o);
								if (!o) setProjectSearchQuery("");
							}}
						>
							<Popover.Trigger>
								<button type="button" className={styles.assignTrigger}>
									<Text size="1" color="gray">
										担当者を変更...
									</Text>
									<IconChevronDown size={14} />
								</button>
							</Popover.Trigger>
							<Popover.Content
								className={styles.assignPopover}
								side="bottom"
								align="start"
							>
								<div className={styles.assignSearch}>
									<RadixTextField.Root
										placeholder="検索..."
										size="1"
										value={projectSearchQuery}
										onChange={e => setProjectSearchQuery(e.target.value)}
									>
										<RadixTextField.Slot>
											<IconSearch size={14} />
										</RadixTextField.Slot>
									</RadixTextField.Root>
								</div>
								<div className={styles.assignList}>
									{projectMembers
										.filter(person => {
											const q = projectSearchQuery.toLowerCase();
											if (!q) return true;
											return person.name.toLowerCase().includes(q);
										})
										.map(person => {
											const isAssigned = inquiry.projectAssignees.some(
												a => a.user.id === person.id
											);
											return (
												<button
													key={person.id}
													type="button"
													className={`${styles.assignDropdownOption} ${isAssigned ? styles.assignDropdownOptionSelected : ""}`}
													onClick={() => toggleAssignee(person.id, "PROJECT")}
												>
													<Avatar size={20} name={person.name} variant="beam" />
													<div className={styles.assignDropdownOptionText}>
														<Text size="2">{person.name}</Text>
													</div>
													{isAssigned && (
														<IconCheck
															size={14}
															className={styles.assignDropdownOptionCheck}
														/>
													)}
												</button>
											);
										})}
								</div>
							</Popover.Content>
						</Popover.Root>
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

				{canEditCommittee && viewers && onUpdateViewers && (
					<>
						<Separator size="4" />
						<ViewerSettings
							viewers={viewers}
							committeeMembers={committeeMembers}
							onUpdate={onUpdateViewers}
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

/* ─── サブコンポーネント ─── */

function ReplySection({
	onAddComment,
	disabled,
}: {
	onAddComment: (body: string, fileIds?: string[]) => Promise<void>;
	disabled?: boolean;
}) {
	const [replyText, setReplyText] = useState("");
	const [replyFiles, setReplyFiles] = useState<File[]>([]);
	const [replySending, setReplySending] = useState(false);
	const replyFileInputRef = useRef<HTMLInputElement>(null);

	const handleSubmitReply = async () => {
		if (!replyText.trim() || disabled) return;
		setReplySending(true);
		try {
			let fileIds: string[] | undefined;
			if (replyFiles.length > 0) {
				const results = await Promise.all(replyFiles.map(f => uploadFile(f)));
				fileIds = results.map(r => r.file.id);
			}
			await onAddComment(replyText.trim(), fileIds);
			setReplyText("");
			setReplyFiles([]);
		} catch {
			toast.error("コメントの送信に失敗しました");
		} finally {
			setReplySending(false);
		}
	};

	const handleReplyFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		const { files } = e.target;
		if (files) {
			setReplyFiles(prev => [...prev, ...Array.from(files)]);
		}
		e.target.value = "";
	};

	const removeReplyFile = (index: number) => {
		setReplyFiles(prev => prev.filter((_, i) => i !== index));
	};

	return (
		<section className={styles.replySection}>
			<Heading size="3">コメントを追加</Heading>
			{disabled && (
				<Text size="2" color="gray">
					閲覧権限のため、コメントを送信できません。
				</Text>
			)}
			<TextArea
				label="返信内容"
				placeholder="返信内容を入力..."
				value={replyText}
				onChange={setReplyText}
				rows={3}
				disabled={disabled}
			/>
			{!disabled && replyFiles.length > 0 && (
				<div className={styles.selectedFiles}>
					{replyFiles.map((f, i) => (
						<div key={`${f.name}-${i}`} className={styles.selectedFileItem}>
							<IconPaperclip size={14} />
							<Text size="1">{f.name}</Text>
							<Text size="1" color="gray">
								({formatFileSize(f.size)})
							</Text>
							<button
								type="button"
								className={styles.selectedFileRemove}
								onClick={() => removeReplyFile(i)}
							>
								<IconX size={12} />
							</button>
						</div>
					))}
				</div>
			)}
			{!disabled && (
				<div className={styles.replyFileArea}>
					<input
						ref={replyFileInputRef}
						type="file"
						multiple
						className={styles.fileInput}
						onChange={handleReplyFileSelect}
					/>
					<button
						type="button"
						className={styles.fileSelectButton}
						onClick={() => replyFileInputRef.current?.click()}
						disabled={replySending}
					>
						<IconPaperclip size={16} />
						<Text size="2">ファイルを添付</Text>
					</button>
				</div>
			)}
			<div className={styles.replyActions}>
				<Button
					onClick={handleSubmitReply}
					disabled={disabled || !replyText.trim() || replySending}
				>
					{replySending ? "送信中..." : "送信"}
				</Button>
			</div>
		</section>
	);
}

function TimelineItem({
	name,
	role,
	date,
	body,
	attachments,
}: {
	name: string;
	role: "project" | "committee";
	date: Date;
	body: string;
	attachments?: InquiryAttachment[];
}) {
	return (
		<div className={styles.timelineItem}>
			<span className={styles.avatar}>
				<Avatar size={28} name={name} variant="beam" />
			</span>
			<div className={styles.timelineContent}>
				<div className={styles.timelineHeader}>
					<Text size="2" weight="medium">
						{name}
					</Text>
					<Badge
						size="1"
						variant="soft"
						color={role === "committee" ? "blue" : "green"}
					>
						{role === "committee" ? "実行委員" : "企画者"}
					</Badge>
					<Text size="1" color="gray" className={styles.timelineHeaderMeta}>
						{formatDateTime(date)}
					</Text>
				</div>
				<Text size="2" className={styles.timelineBody}>
					{body}
				</Text>
				{attachments && attachments.length > 0 && (
					<div className={styles.attachmentSection}>
						{attachments.map(att =>
							att.mimeType.startsWith("image/") ? (
								<AttachmentImage key={att.id} attachment={att} />
							) : (
								<button
									key={att.id}
									type="button"
									className={styles.attachmentItem}
									onClick={() =>
										downloadFile(att.fileId, att.fileName, att.isPublic).catch(
											() => toast.error("ファイルの取得に失敗しました")
										)
									}
								>
									<IconDownload size={14} />
									<Text size="2">{att.fileName}</Text>
									<Text size="1" color="gray">
										({formatFileSize(att.size)})
									</Text>
								</button>
							)
						)}
					</div>
				)}
			</div>
		</div>
	);
}

function AttachmentImage({ attachment }: { attachment: InquiryAttachment }) {
	const url = useStorageUrl(attachment.fileId, attachment.isPublic);
	if (!url) return null;
	return (
		<img
			src={url}
			alt={attachment.fileName}
			className={styles.attachmentImage}
		/>
	);
}

function getActivityText(activity: ActivityInfo): string {
	const actor = activity.actor.name;
	switch (activity.type) {
		case "ASSIGNEE_ADDED": {
			const target = activity.target?.name ?? "";
			return actor === target
				? `${actor} が担当者になりました`
				: `${actor} が ${target} を担当者に設定しました`;
		}
		case "ASSIGNEE_REMOVED": {
			const target = activity.target?.name ?? "";
			return actor === target
				? `${actor} が担当者から外れました`
				: `${actor} が ${target} を担当者から外しました`;
		}
		case "STATUS_RESOLVED":
			return `${actor} がこのお問い合わせを解決済みにしました`;
		case "STATUS_REOPENED":
			return `${actor} がこのお問い合わせを再オープンしました`;
		case "VIEWER_UPDATED":
			return `${actor} が閲覧者設定を変更しました`;
	}
}

function ActivityItem({ activity }: { activity: ActivityInfo }) {
	return (
		<div className={styles.activityItem}>
			<Text size="1" color="gray">
				{getActivityText(activity)} — {formatDateTime(activity.createdAt)}
			</Text>
		</div>
	);
}

function AssigneeList({
	assignees,
	variant,
	canEdit,
	onRemove,
}: {
	assignees: AssigneeInfo[];
	variant: "project" | "committee";
	canEdit: boolean;
	onRemove: (assigneeId: string) => void;
}) {
	if (assignees.length === 0) {
		return (
			<Text size="1" color="red">
				未設定
			</Text>
		);
	}

	return (
		<div className={styles.assigneeList}>
			{assignees.map(a => (
				<div key={a.id} className={styles.assigneeItem}>
					<span className={styles.sidebarAvatar} data-variant={variant}>
						<Avatar size={20} name={a.user.name} variant="beam" />
					</span>
					<div>
						<Text size="2">{a.user.name}</Text>
					</div>
					{canEdit && !a.isCreator && (
						<IconButton
							variant="ghost"
							size="1"
							color="red"
							onClick={() => onRemove(a.id)}
						>
							<IconTrash size={12} />
						</IconButton>
					)}
				</div>
			))}
		</div>
	);
}

/* ─── 閲覧者設定 ─── */

const BUREAU_OPTIONS = Object.entries(bureauLabelMap).map(([value, label]) => ({
	value: value as Bureau,
	label,
}));

function ViewerSettings({
	viewers,
	committeeMembers,
	onUpdate,
}: {
	viewers: ViewerDetail[];
	committeeMembers: { id: string; name: string }[];
	onUpdate: (viewers: ViewerInput[]) => Promise<void>;
}) {
	const [addMode, setAddMode] = useState<
		"idle" | "BUREAU" | "INDIVIDUAL" | null
	>("idle");
	const [memberSearchQuery, setMemberSearchQuery] = useState("");

	const hasAllScope = viewers.some(v => v.scope === "ALL");

	const viewersToInputs = useCallback(
		(list: ViewerDetail[]): ViewerInput[] =>
			list.map(v => ({
				scope: v.scope,
				...(v.scope === "BUREAU" && v.bureauValue
					? { bureauValue: v.bureauValue }
					: {}),
				...(v.scope === "INDIVIDUAL" && v.user ? { userId: v.user.id } : {}),
			})),
		[]
	);

	const handleSetAll = async () => {
		await onUpdate([{ scope: "ALL" }]);
	};

	const handleRemoveViewer = async (viewerId: string) => {
		const remaining = viewers.filter(v => v.id !== viewerId);
		await onUpdate(viewersToInputs(remaining));
	};

	const handleAddBureau = async (bureau: Bureau) => {
		if (viewers.some(v => v.scope === "BUREAU" && v.bureauValue === bureau)) {
			return;
		}
		const inputs = [
			...viewersToInputs(viewers.filter(v => v.scope !== "ALL")),
			{ scope: "BUREAU" as const, bureauValue: bureau },
		];
		await onUpdate(inputs);
		setAddMode("idle");
	};

	const handleAddIndividual = async (userId: string) => {
		if (viewers.some(v => v.scope === "INDIVIDUAL" && v.user?.id === userId)) {
			return;
		}
		const inputs = [
			...viewersToInputs(viewers.filter(v => v.scope !== "ALL")),
			{ scope: "INDIVIDUAL" as const, userId },
		];
		await onUpdate(inputs);
		setAddMode("idle");
		setMemberSearchQuery("");
	};

	const getViewerLabel = (viewer: ViewerDetail): string => {
		if (viewer.scope === "ALL") return "全員";
		if (viewer.scope === "BUREAU" && viewer.bureauValue) {
			return bureauLabelMap[viewer.bureauValue] ?? viewer.bureauValue;
		}
		if (viewer.scope === "INDIVIDUAL" && viewer.user) {
			return viewer.user.name;
		}
		return "不明";
	};

	const getScopeColor = (
		scope: InquiryViewerScope
	): "blue" | "orange" | "green" => {
		if (scope === "ALL") return "blue";
		if (scope === "BUREAU") return "orange";
		return "green";
	};

	return (
		<div className={styles.sidebarSection}>
			<div className={styles.sidebarSectionHeader}>
				<Text size="2" weight="medium" color="gray">
					閲覧者設定
				</Text>
			</div>

			{viewers.length === 0 ? (
				<Text size="1" color="gray">
					閲覧者が設定されていません
				</Text>
			) : (
				<div className={styles.viewerList}>
					{viewers.map(v => (
						<div key={v.id} className={styles.viewerItem}>
							<Badge size="1" variant="soft" color={getScopeColor(v.scope)}>
								{getViewerLabel(v)}
							</Badge>
							<IconButton
								variant="ghost"
								size="1"
								color="gray"
								onClick={() => handleRemoveViewer(v.id)}
							>
								<IconX size={12} />
							</IconButton>
						</div>
					))}
				</div>
			)}

			{!hasAllScope && (
				<Popover.Root
					open={addMode !== "idle" && addMode !== null}
					onOpenChange={o => {
						if (!o) {
							setAddMode("idle");
							setMemberSearchQuery("");
						}
					}}
				>
					<div className={styles.viewerActions}>
						<button
							type="button"
							className={styles.viewerAddButton}
							onClick={handleSetAll}
						>
							全体公開にする
						</button>
						<Popover.Trigger>
							<button
								type="button"
								className={styles.viewerAddButton}
								onClick={() => setAddMode("BUREAU")}
							>
								<IconPlus size={12} />
								局を追加
							</button>
						</Popover.Trigger>
						<Popover.Trigger>
							<button
								type="button"
								className={styles.viewerAddButton}
								onClick={() => setAddMode("INDIVIDUAL")}
							>
								<IconPlus size={12} />
								個人を追加
							</button>
						</Popover.Trigger>
					</div>

					<Popover.Content
						className={styles.assignPopover}
						side="bottom"
						align="start"
					>
						{addMode === "BUREAU" && (
							<div className={styles.assignList}>
								{BUREAU_OPTIONS.map(opt => {
									const exists = viewers.some(
										v => v.scope === "BUREAU" && v.bureauValue === opt.value
									);
									return (
										<button
											key={opt.value}
											type="button"
											className={`${styles.assignDropdownOption} ${exists ? styles.assignDropdownOptionSelected : ""}`}
											onClick={() => handleAddBureau(opt.value)}
											disabled={exists}
										>
											<Text size="2">{opt.label}</Text>
											{exists && (
												<IconCheck
													size={14}
													className={styles.assignDropdownOptionCheck}
												/>
											)}
										</button>
									);
								})}
							</div>
						)}
						{addMode === "INDIVIDUAL" && (
							<>
								<div className={styles.assignSearch}>
									<RadixTextField.Root
										placeholder="検索..."
										size="1"
										value={memberSearchQuery}
										onChange={e => setMemberSearchQuery(e.target.value)}
									>
										<RadixTextField.Slot>
											<IconSearch size={14} />
										</RadixTextField.Slot>
									</RadixTextField.Root>
								</div>
								<div className={styles.assignList}>
									{committeeMembers
										.filter(m => {
											const q = memberSearchQuery.toLowerCase();
											if (!q) return true;
											return m.name.toLowerCase().includes(q);
										})
										.map(m => {
											const exists = viewers.some(
												v => v.scope === "INDIVIDUAL" && v.user?.id === m.id
											);
											return (
												<button
													key={m.id}
													type="button"
													className={`${styles.assignDropdownOption} ${exists ? styles.assignDropdownOptionSelected : ""}`}
													onClick={() => handleAddIndividual(m.id)}
													disabled={exists}
												>
													<Avatar size={20} name={m.name} variant="beam" />
													<Text size="2">{m.name}</Text>
													{exists && (
														<IconCheck
															size={14}
															className={styles.assignDropdownOptionCheck}
														/>
													)}
												</button>
											);
										})}
								</div>
							</>
						)}
					</Popover.Content>
				</Popover.Root>
			)}

			{hasAllScope && (
				<Text size="1" color="blue">
					全ての実委人が閲覧可能です
				</Text>
			)}
		</div>
	);
}

function formatDateTime(date: Date): string {
	const d = new Date(date);
	const y = d.getFullYear();
	const m = (d.getMonth() + 1).toString().padStart(2, "0");
	const day = d.getDate().toString().padStart(2, "0");
	const h = d.getHours().toString().padStart(2, "0");
	const min = d.getMinutes().toString().padStart(2, "0");
	return `${y}/${m}/${day} ${h}:${min}`;
}
