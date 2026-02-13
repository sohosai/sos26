import {
	Badge,
	Heading,
	IconButton,
	Popover,
	TextField as RadixTextField,
	Separator,
	Text,
} from "@radix-ui/themes";
import {
	IconAlertCircle,
	IconArrowLeft,
	IconCheck,
	IconChevronDown,
	IconCircleCheck,
	IconFileText,
	IconLoader,
	IconSearch,
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
	const [committeePopoverOpen, setCommitteePopoverOpen] = useState(false);
	const [projectPopoverOpen, setProjectPopoverOpen] = useState(false);
	const [committeeSearchQuery, setCommitteeSearchQuery] = useState("");
	const [projectSearchQuery, setProjectSearchQuery] = useState("");

	const config = statusConfig[inquiry.status];
	const StatusIcon = config.icon;

	const handleSubmitReply = () => {
		if (!replyText.trim()) return;
		onAddMessage(replyText.trim());
		setReplyText("");
	};

	const toggleAssignee = (person: Person, side: "project" | "committee") => {
		const assignees =
			side === "committee"
				? inquiry.committeeAssignees
				: inquiry.projectAssignees;
		const isAssigned = assignees.some(a => a.id === person.id);
		if (isAssigned) {
			onRemoveAssignee(person.id, side);
		} else {
			onAddAssignee(person, side);
		}
	};

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
						{inquiry.createdBy.name}
						{(inquiry.createdBy.projectName || inquiry.createdBy.department) &&
							`（${inquiry.createdBy.projectName ?? inquiry.createdBy.department}）`}{" "}
						が {formatDateTime(inquiry.createdAt)} に作成
					</Text>
				</header>

				{/* 本文（最初の投稿） */}
				<div className={styles.timeline}>
					<TimelineItem
						name={inquiry.createdBy.name}
						role={inquiry.creatorRole}
						affiliation={
							inquiry.createdBy.projectName ?? inquiry.createdBy.department
						}
						date={inquiry.createdAt}
						body={inquiry.body}
					/>

					{sortedMessages.map(msg => (
						<TimelineItem
							key={msg.id}
							name={msg.createdBy.name}
							role={msg.createdBy.role}
							affiliation={
								msg.createdBy.projectName ?? msg.createdBy.department
							}
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
					<Text size="2" weight="medium" color="gray">
						実行委員 担当者
					</Text>
					<AssigneeList
						assignees={inquiry.committeeAssignees}
						variant="committee"
						canEdit={viewerRole === "committee"}
						onRemove={id => onRemoveAssignee(id, "committee")}
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
											return (
												person.name.toLowerCase().includes(q) ||
												(person.department?.toLowerCase().includes(q) ?? false)
											);
										})
										.map(person => {
											const isAssigned = inquiry.committeeAssignees.some(
												a => a.id === person.id
											);
											return (
												<button
													key={person.id}
													type="button"
													className={`${styles.assignDropdownOption} ${isAssigned ? styles.assignDropdownOptionSelected : ""}`}
													onClick={() => toggleAssignee(person, "committee")}
												>
													<Avatar size={20} name={person.name} variant="beam" />
													<div className={styles.assignDropdownOptionText}>
														<Text size="2">{person.name}</Text>
														{person.department && (
															<Text size="1" color="gray">
																{person.department}
															</Text>
														)}
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
						canEdit={viewerRole === "committee"}
						onRemove={id => onRemoveAssignee(id, "project")}
					/>
					{viewerRole === "committee" && (
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
											return (
												person.name.toLowerCase().includes(q) ||
												(person.projectName?.toLowerCase().includes(q) ?? false)
											);
										})
										.map(person => {
											const isAssigned = inquiry.projectAssignees.some(
												a => a.id === person.id
											);
											return (
												<button
													key={person.id}
													type="button"
													className={`${styles.assignDropdownOption} ${isAssigned ? styles.assignDropdownOptionSelected : ""}`}
													onClick={() => toggleAssignee(person, "project")}
												>
													<Avatar size={20} name={person.name} variant="beam" />
													<div className={styles.assignDropdownOptionText}>
														<Text size="2">{person.name}</Text>
														{person.projectName && (
															<Text size="1" color="gray">
																{person.projectName}
															</Text>
														)}
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
		</div>
	);
}

/* ─── サブコンポーネント ─── */

function TimelineItem({
	name,
	role,
	affiliation,
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
					{affiliation && (
						<Text size="1" color="gray">
							{affiliation}
						</Text>
					)}
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
					<div>
						<Text size="2">{p.name}</Text>
						{(p.projectName || p.department) && (
							<Text size="1" color="gray" as="p">
								{p.projectName ?? p.department}
							</Text>
						)}
					</div>
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
