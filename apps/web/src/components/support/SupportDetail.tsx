import {
	Badge,
	Dialog,
	Heading,
	IconButton,
	Separator,
	Text,
	Tooltip,
} from "@radix-ui/themes";
import {
	IconAlertCircle,
	IconArrowLeft,
	IconCheck,
	IconCircleCheck,
	IconFileText,
	IconLoader,
	IconPlus,
	IconTrash,
} from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import Avatar from "boring-avatars";
import { useState } from "react";
import { Button, Select, TextArea } from "@/components/primitives";
import type { Inquiry, InquiryStatus, Person } from "@/mock/support";
import styles from "./SupportDetail.module.scss";

type SupportDetailProps = {
	inquiry: Inquiry;
	viewerRole: "project" | "committee";
	basePath: string;
	committeeMembers: Person[];
	projectMembers: Person[];
	onUpdateStatus: (status: InquiryStatus) => void;
	onAddMessage: (body: string) => void;
	onAddAssignee: (person: Person, side: "project" | "committee") => void;
	onRemoveAssignee: (personId: string, side: "project" | "committee") => void;
};

const statusConfig: Record<
	InquiryStatus,
	{
		label: string;
		color: "orange" | "blue" | "green";
		icon: typeof IconAlertCircle;
	}
> = {
	new: { label: "新規", color: "orange", icon: IconAlertCircle },
	in_progress: { label: "対応中", color: "blue", icon: IconLoader },
	resolved: { label: "解決済み", color: "green", icon: IconCircleCheck },
};

export function SupportDetail({
	inquiry,
	viewerRole,
	basePath,
	committeeMembers,
	projectMembers,
	onUpdateStatus,
	onAddMessage,
	onAddAssignee,
	onRemoveAssignee,
}: SupportDetailProps) {
	const navigate = useNavigate();
	const [replyText, setReplyText] = useState("");
	const [assignDialogOpen, setAssignDialogOpen] = useState(false);
	const [assignDialogSide, setAssignDialogSide] = useState<
		"project" | "committee"
	>("committee");

	const config = statusConfig[inquiry.status];
	const StatusIcon = config.icon;

	const handleSubmitReply = () => {
		if (!replyText.trim()) return;
		onAddMessage(replyText.trim());
		setReplyText("");
	};

	const openAssignDialog = (side: "project" | "committee") => {
		setAssignDialogSide(side);
		setAssignDialogOpen(true);
	};

	const availableForAssign =
		assignDialogSide === "committee"
			? committeeMembers.filter(
					m => !inquiry.committeeAssignees.some(a => a.id === m.id)
				)
			: projectMembers.filter(
					m => !inquiry.projectAssignees.some(a => a.id === m.id)
				);

	// 時系列で全メッセージをフラットに表示（GitHub issue 風）
	const sortedMessages = [...inquiry.messages].sort(
		(a, b) => a.createdAt.getTime() - b.createdAt.getTime()
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
						role={inquiry.creatorRole}
						date={inquiry.createdAt}
						body={inquiry.body}
					/>

					{sortedMessages.map(msg => (
						<TimelineItem
							key={msg.id}
							name={msg.createdBy.name}
							role={msg.createdBy.role}
							date={msg.createdAt}
							body={msg.body}
						/>
					))}
				</div>

				<Separator size="4" />

				{/* 返信フォーム */}
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
			</div>

			{/* サイドバー */}
			<aside className={styles.sidebar}>
				<div className={styles.sidebarSection}>
					<Text size="2" weight="medium" color="gray">
						対応状況
					</Text>
					<Select
						options={[
							{ value: "new", label: "新規" },
							{ value: "in_progress", label: "対応中" },
							{ value: "resolved", label: "解決済み" },
						]}
						value={inquiry.status}
						onValueChange={v => onUpdateStatus(v as InquiryStatus)}
						aria-label="対応状況"
					/>
				</div>

				<Separator size="4" />

				{/* 実行委員担当者 */}
				<div className={styles.sidebarSection}>
					<div className={styles.sidebarSectionHeader}>
						<Text size="2" weight="medium" color="gray">
							実行委員 担当者
						</Text>
						{viewerRole === "committee" && (
							<Tooltip content="担当者を追加">
								<IconButton
									variant="ghost"
									size="1"
									onClick={() => openAssignDialog("committee")}
								>
									<IconPlus size={14} />
								</IconButton>
							</Tooltip>
						)}
					</div>
					<AssigneeList
						assignees={inquiry.committeeAssignees}
						variant="committee"
						canEdit={viewerRole === "committee"}
						onRemove={id => onRemoveAssignee(id, "committee")}
					/>
				</div>

				<Separator size="4" />

				{/* 企画側担当者 */}
				<div className={styles.sidebarSection}>
					<div className={styles.sidebarSectionHeader}>
						<Text size="2" weight="medium" color="gray">
							企画側 担当者
						</Text>
						{viewerRole === "committee" && (
							<Tooltip content="担当者を追加">
								<IconButton
									variant="ghost"
									size="1"
									onClick={() => openAssignDialog("project")}
								>
									<IconPlus size={14} />
								</IconButton>
							</Tooltip>
						)}
					</div>
					<AssigneeList
						assignees={inquiry.projectAssignees}
						variant="project"
						canEdit={viewerRole === "committee"}
						onRemove={id => onRemoveAssignee(id, "project")}
					/>
				</div>

				<Separator size="4" />

				{/* 関連フォーム */}
				<div className={styles.sidebarSection}>
					<Text size="2" weight="medium" color="gray">
						関連フォーム
					</Text>
					{inquiry.relatedForm ? (
						<div className={styles.formLink}>
							<IconFileText size={16} />
							<Text size="2">{inquiry.relatedForm.name}</Text>
						</div>
					) : (
						<Text size="1" color="gray">
							なし
						</Text>
					)}
				</div>

				{inquiry.status !== "resolved" && (
					<>
						<Separator size="4" />
						<Button
							intent="secondary"
							onClick={() => onUpdateStatus("resolved")}
						>
							<IconCheck size={16} />
							解決済みにする
						</Button>
					</>
				)}
			</aside>

			{/* 担当者追加ダイアログ */}
			<Dialog.Root open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
				<Dialog.Content maxWidth="400px">
					<Dialog.Title>
						{assignDialogSide === "committee"
							? "実行委員の担当者を追加"
							: "企画側の担当者を追加"}
					</Dialog.Title>
					<div className={styles.assignDialog}>
						{availableForAssign.length === 0 ? (
							<Text size="2" color="gray">
								追加できるメンバーがいません
							</Text>
						) : (
							availableForAssign.map(person => (
								<button
									key={person.id}
									type="button"
									className={styles.assignOption}
									onClick={() => {
										onAddAssignee(person, assignDialogSide);
										setAssignDialogOpen(false);
									}}
								>
									<Avatar size={20} name={person.name} variant="beam" />
									<Text size="2">{person.name}</Text>
								</button>
							))
						)}
					</div>
					<Button intent="ghost" onClick={() => setAssignDialogOpen(false)}>
						閉じる
					</Button>
				</Dialog.Content>
			</Dialog.Root>
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

function AssigneeList({
	assignees,
	variant,
	canEdit,
	onRemove,
}: {
	assignees: Person[];
	variant: "project" | "committee";
	canEdit: boolean;
	onRemove: (id: string) => void;
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
			{assignees.map(p => (
				<div key={p.id} className={styles.assigneeItem}>
					<span className={styles.sidebarAvatar} data-variant={variant}>
						<Avatar size={20} name={p.name} variant="beam" />
					</span>
					<Text size="2">{p.name}</Text>
					{canEdit && (
						<IconButton
							variant="ghost"
							size="1"
							color="red"
							onClick={() => onRemove(p.id)}
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
	const y = date.getFullYear();
	const m = date.getMonth() + 1;
	const d = date.getDate();
	const h = date.getHours().toString().padStart(2, "0");
	const min = date.getMinutes().toString().padStart(2, "0");
	return `${y}/${m}/${d} ${h}:${min}`;
}
