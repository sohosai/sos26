import {
	Badge,
	Heading,
	IconButton,
	Popover,
	TextField as RadixTextField,
	Separator,
	Text,
} from "@radix-ui/themes";
import type { GetProjectInquiryResponse, InquiryStatus } from "@sos26/shared";
import {
	IconAlertCircle,
	IconArrowLeft,
	IconCheck,
	IconChevronDown,
	IconCircleCheck,
	IconLoader,
	IconSearch,
	IconTrash,
} from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import Avatar from "boring-avatars";
import { useState } from "react";
import { Button, TextArea } from "@/components/primitives";
import styles from "./SupportDetail.module.scss";

type InquiryDetail = GetProjectInquiryResponse["inquiry"];
type CommentInfo = InquiryDetail["comments"][number];
type ActivityInfo = InquiryDetail["activities"][number];
type AssigneeInfo = InquiryDetail["projectAssignees"][number];

type SupportDetailProps = {
	inquiry: InquiryDetail;
	viewerRole: "project" | "committee";
	basePath: string;
	committeeMembers: { id: string; name: string }[];
	projectMembers: { id: string; name: string }[];
	onUpdateStatus: (status: "RESOLVED" | "IN_PROGRESS") => Promise<void>;
	onAddComment: (body: string) => Promise<void>;
	onAddAssignee: (
		userId: string,
		side: "PROJECT" | "COMMITTEE"
	) => Promise<void>;
	onRemoveAssignee: (assigneeId: string) => Promise<void>;
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
	IN_PROGRESS: { label: "対応中", color: "blue", icon: IconLoader },
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
}: SupportDetailProps) {
	const navigate = useNavigate();
	const [replyText, setReplyText] = useState("");
	const [committeePopoverOpen, setCommitteePopoverOpen] = useState(false);
	const [projectPopoverOpen, setProjectPopoverOpen] = useState(false);
	const [committeeSearchQuery, setCommitteeSearchQuery] = useState("");
	const [projectSearchQuery, setProjectSearchQuery] = useState("");

	const config = statusConfig[inquiry.status];
	const StatusIcon = config.icon;

	const handleSubmitReply = async () => {
		if (!replyText.trim()) return;
		await onAddComment(replyText.trim());
		setReplyText("");
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
					<Text size="2">問い合わせ一覧に戻る</Text>
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
					/>

					{timelineEntries.map(entry =>
						entry.kind === "comment" ? (
							<TimelineItem
								key={entry.data.id}
								name={entry.data.createdBy.name}
								role={getCommentRole(entry.data.createdBy)}
								date={entry.data.createdAt}
								body={entry.data.body}
							/>
						) : (
							<ActivityItem key={entry.data.id} activity={entry.data} />
						)
					)}
				</div>

				<Separator size="4" />

				{/* 返信フォーム */}
				{inquiry.status !== "RESOLVED" ? (
					<section className={styles.replySection}>
						<Heading size="3">コメントを追加</Heading>
						<TextArea
							label="返信内容"
							placeholder="返信内容を入力..."
							value={replyText}
							onChange={setReplyText}
							rows={3}
						/>
						<div className={styles.replyActions}>
							<Button onClick={handleSubmitReply} disabled={!replyText.trim()}>
								送信
							</Button>
						</div>
					</section>
				) : (
					<section className={styles.replySection}>
						<Text size="2" color="gray">
							この問い合わせは解決済みのため、コメントを追加できません。
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
						canEdit={viewerRole === "committee"}
						onRemove={assigneeId => onRemoveAssignee(assigneeId)}
					/>
					{viewerRole === "committee" && (
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
						canEdit={viewerRole === "committee" || viewerRole === "project"}
						onRemove={assigneeId => onRemoveAssignee(assigneeId)}
					/>
					{(viewerRole === "committee" || viewerRole === "project") && (
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

				{viewerRole === "committee" && (
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

function TimelineItem({
	name,
	role,
	date,
	body,
}: {
	name: string;
	role: "project" | "committee";
	affiliation?: string;
	date: Date;
	body: string;
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
			</div>
		</div>
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

function formatDateTime(date: Date): string {
	const d = new Date(date);
	const y = d.getFullYear();
	const m = (d.getMonth() + 1).toString().padStart(2, "0");
	const day = d.getDate().toString().padStart(2, "0");
	const h = d.getHours().toString().padStart(2, "0");
	const min = d.getMinutes().toString().padStart(2, "0");
	return `${y}/${m}/${day} ${h}:${min}`;
}
