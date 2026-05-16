import { Badge, Heading, Text, Tooltip } from "@radix-ui/themes";
import type { ListProjectInquiriesResponse } from "@sos26/shared";
import {
	IconAlertCircle,
	IconBell,
	IconCircleCheck,
	IconCircleDot,
	IconEye,
	IconPencil,
	IconPlus,
	IconSearch,
	IconUserCheck,
} from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { UserAvatar } from "@/components/common/UserAvatar";
import { Button, Switch, TextField } from "@/components/primitives";
import { formatProjectNumber, formatRelativeTime } from "@/lib/format";
import { statusConfig } from "./constants";
import styles from "./SupportList.module.scss";

type InquirySummary = ListProjectInquiriesResponse["inquiries"][number];
type AssigneeInfo = InquirySummary["projectAssignees"][number];

type SupportListProps = {
	inquiries: InquirySummary[];
	currentUser: { id: string; name: string };
	viewerRole: "project" | "committee";
	basePath: string;
	onNewInquiry: () => void;
	isAdmin?: boolean;
	committeeActiveTab?: CommitteeTab;
	onCommitteeTabChange?: (tab: CommitteeTab) => void;
};

type CommitteeTab = "open" | "draft" | "resolved";

export function SupportList({
	inquiries,
	currentUser,
	viewerRole,
	basePath,
	onNewInquiry,
	isAdmin = false,
	committeeActiveTab,
	onCommitteeTabChange,
}: SupportListProps) {
	const [localActiveTab, setLocalActiveTab] = useState<CommitteeTab>("open");
	const [searchQuery, setSearchQuery] = useState("");
	const [onlyUnreplied, setOnlyUnreplied] = useState(false);
	const isCommittee = viewerRole === "committee";
	const activeTab = committeeActiveTab ?? localActiveTab;
	const showUnrepliedFilter = isCommittee && activeTab === "open";

	const handleChangeTab = (tab: CommitteeTab) => {
		setLocalActiveTab(tab);
		onCommitteeTabChange?.(tab);
	};

	const searched = (() => {
		const q = searchQuery.trim().toLowerCase();
		if (!q) return inquiries;
		return inquiries.filter(inq => {
			const inTitle = inq.title.toLowerCase().includes(q);
			const inProjectName = inq.project?.name?.toLowerCase().includes(q);
			const projectNumberFormatted =
				inq.project && typeof inq.project.number === "number"
					? formatProjectNumber(inq.project.number)
					: "";
			const inProjectNumberFormatted = projectNumberFormatted
				.toLowerCase()
				.includes(q);
			const inProjectNumberRaw =
				inq.project && inq.project.number !== undefined
					? String(inq.project.number).includes(q)
					: false;
			return (
				inTitle ||
				inProjectName ||
				inProjectNumberFormatted ||
				inProjectNumberRaw
			);
		});
	})();

	const isAssignedToMe = (inq: InquirySummary) => {
		const assignees = isCommittee
			? inq.committeeAssignees
			: inq.projectAssignees;
		return assignees.some(a => a.user.id === currentUser.id);
	};

	const myCount = searched.filter(
		inq => inq.status !== "RESOLVED" && !inq.isDraft && isAssignedToMe(inq)
	).length;

	// 企画者側: 未解決 / 解決済みに分割
	const draftItems = searched.filter(inq => inq.isDraft);
	const openItemsAll = searched.filter(
		inq => inq.status !== "RESOLVED" && !inq.isDraft
	);
	const unrepliedActive = showUnrepliedFilter && onlyUnreplied;
	const openItems = unrepliedActive
		? openItemsAll.filter(inq => inq.awaitingReplyFrom === "COMMITTEE")
		: openItemsAll;
	const resolvedItems = searched.filter(
		inq => inq.status === "RESOLVED" && !inq.isDraft
	);
	const openEmptyMessage = unrepliedActive
		? "未返信のお問い合わせはありません"
		: "未完了のお問い合わせはありません";

	return (
		<div className={styles.container}>
			<div className={styles.header}>
				<div
					className={styles.titleRow}
					data-mobile-stack={isCommittee ? "true" : "false"}
				>
					<Heading size="6">お問い合わせ</Heading>
					<Button onClick={onNewInquiry}>
						<IconPlus size={16} />
						新しいお問い合わせ
					</Button>
				</div>
				<Text size="2" color="gray">
					{isCommittee
						? "企画からのお問い合わせを管理します。"
						: "実行委員会へのお問い合わせを管理します。"}
				</Text>
			</div>

			<div className={styles.toolbar}>
				{isCommittee && (
					<CommitteeTabs
						activeTab={activeTab}
						myCount={myCount}
						draftCount={draftItems.length}
						onChangeTab={handleChangeTab}
					/>
				)}
				<div className={styles.filters}>
					<div className={styles.search}>
						<TextField
							label="検索"
							placeholder="キーワードで検索..."
							value={searchQuery}
							onChange={setSearchQuery}
							type="search"
						/>
					</div>
					{showUnrepliedFilter && (
						<div className={styles.filterToggle}>
							<Switch
								label="未返信のみ"
								size="1"
								checked={onlyUnreplied}
								onCheckedChange={setOnlyUnreplied}
							/>
						</div>
					)}
				</div>
			</div>

			{isCommittee ? (
				activeTab === "open" ? (
					<CommitteeOpenSections
						inquiries={openItems}
						currentUser={currentUser}
						basePath={basePath}
						isAdmin={isAdmin}
						viewerRole={viewerRole}
						emptyMessage={openEmptyMessage}
					/>
				) : activeTab === "draft" ? (
					<CommitteeDraftList
						inquiries={draftItems}
						basePath={basePath}
						viewerRole={viewerRole}
					/>
				) : (
					<CommitteeResolvedList
						inquiries={resolvedItems}
						basePath={basePath}
						isAssignedToMe={isAssignedToMe}
						viewerRole={viewerRole}
					/>
				)
			) : (
				<ProjectList
					openItems={openItems}
					resolvedItems={resolvedItems}
					basePath={basePath}
					viewerRole={viewerRole}
				/>
			)}
		</div>
	);
}

/* ─── サブコンポーネント ─── */

function CommitteeTabs({
	activeTab,
	myCount,
	draftCount,
	onChangeTab,
}: {
	activeTab: CommitteeTab;
	myCount: number;
	draftCount: number;
	onChangeTab: (tab: CommitteeTab) => void;
}) {
	return (
		<nav className={styles.tabs} aria-label="フィルター">
			<button
				type="button"
				className={`${styles.tab} ${activeTab === "open" ? styles.tabActive : ""}`}
				onClick={() => onChangeTab("open")}
			>
				<IconCircleDot size={14} />
				未完了
				{myCount > 0 && <span className={styles.tabBadge}>{myCount}</span>}
			</button>
			<button
				type="button"
				className={`${styles.tab} ${activeTab === "draft" ? styles.tabActive : ""}`}
				onClick={() => onChangeTab("draft")}
			>
				<IconPencil size={14} />
				下書き
				{draftCount > 0 && (
					<span className={styles.tabBadge}>{draftCount}</span>
				)}
			</button>
			<button
				type="button"
				className={`${styles.tab} ${activeTab === "resolved" ? styles.tabActive : ""}`}
				onClick={() => onChangeTab("resolved")}
			>
				<IconCircleCheck size={14} />
				解決済み
			</button>
		</nav>
	);
}

function CommitteeOpenSections({
	inquiries,
	currentUser,
	basePath,
	isAdmin,
	viewerRole,
	emptyMessage,
}: {
	inquiries: InquirySummary[];
	currentUser: { id: string; name: string };
	basePath: string;
	isAdmin: boolean;
	viewerRole: "project" | "committee";
	emptyMessage: string;
}) {
	const isAssignedToMe = (inq: InquirySummary) =>
		inq.committeeAssignees.some(a => a.user.id === currentUser.id);

	// セクション1: 自分の担当（実委側担当者かつ未解決）
	const myItems = inquiries.filter(
		inq => inq.status !== "RESOLVED" && isAssignedToMe(inq)
	);

	// セクション2: 担当者未割り当て（INQUIRY_ADMIN のみ）
	const unassignedItems = isAdmin
		? inquiries.filter(inq => inq.status === "UNASSIGNED")
		: [];

	// セクション3: 閲覧中（自分が担当者ではなく未解決のもの）
	// 管理者は UNASSIGNED を専用セクションで表示するため除外
	const viewingItems = inquiries.filter(
		inq =>
			inq.status !== "RESOLVED" &&
			!isAssignedToMe(inq) &&
			!(isAdmin && inq.status === "UNASSIGNED")
	);

	const hasAnyItems =
		myItems.length > 0 || unassignedItems.length > 0 || viewingItems.length > 0;

	if (!hasAnyItems) {
		return (
			<div className={styles.empty}>
				<IconSearch size={40} />
				<Text size="3" color="gray">
					{emptyMessage}
				</Text>
			</div>
		);
	}

	return (
		<div className={styles.sections}>
			{myItems.length > 0 && (
				<section className={styles.section}>
					<div className={styles.sectionTitle}>
						<IconUserCheck size={14} />
						<Text size="2" weight="medium">
							自分の担当
						</Text>
						<Badge size="1" variant="soft" radius="full">
							{myItems.length}
						</Badge>
					</div>
					<ul className={styles.list}>
						{myItems.map(inq => (
							<InquiryCard
								key={inq.id}
								inquiry={inq}
								basePath={basePath}
								isMyInquiry
								showAssignees
								viewerRole={viewerRole}
							/>
						))}
					</ul>
				</section>
			)}

			{unassignedItems.length > 0 && (
				<section className={`${styles.section} ${styles.sectionHighlight}`}>
					<div className={styles.sectionTitle}>
						<IconAlertCircle size={14} />
						<Text size="2" weight="medium">
							担当者未割り当て
						</Text>
						<Badge size="1" variant="soft" color="orange" radius="full">
							{unassignedItems.length}
						</Badge>
					</div>
					<ul className={styles.list}>
						{unassignedItems.map(inq => (
							<InquiryCard
								key={inq.id}
								inquiry={inq}
								basePath={basePath}
								isMyInquiry={false}
								showAssignees
								viewerRole={viewerRole}
							/>
						))}
					</ul>
				</section>
			)}

			{viewingItems.length > 0 && (
				<section className={styles.section}>
					<div className={styles.sectionTitle}>
						<IconEye size={14} />
						<Text size="2" weight="medium">
							閲覧中
						</Text>
						<Badge size="1" variant="soft" color="gray" radius="full">
							{viewingItems.length}
						</Badge>
					</div>
					<ul className={styles.list}>
						{viewingItems.map(inq => (
							<InquiryCard
								key={inq.id}
								inquiry={inq}
								basePath={basePath}
								isMyInquiry={false}
								showAssignees
								viewerRole={viewerRole}
							/>
						))}
					</ul>
				</section>
			)}
		</div>
	);
}

function CommitteeResolvedList({
	inquiries,
	basePath,
	isAssignedToMe,
	viewerRole,
}: {
	inquiries: InquirySummary[];
	basePath: string;
	isAssignedToMe: (inq: InquirySummary) => boolean;
	viewerRole: "project" | "committee";
}) {
	const items = inquiries.filter(inq => inq.status === "RESOLVED");

	if (items.length === 0) {
		return (
			<div className={styles.empty}>
				<IconSearch size={40} />
				<Text size="3" color="gray">
					解決済みのお問い合わせはありません
				</Text>
			</div>
		);
	}

	return (
		<ul className={styles.list}>
			{items.map(inq => (
				<InquiryCard
					key={inq.id}
					inquiry={inq}
					basePath={basePath}
					isMyInquiry={isAssignedToMe(inq)}
					showAssignees
					viewerRole={viewerRole}
				/>
			))}
		</ul>
	);
}

function CommitteeDraftList({
	inquiries,
	basePath,
	viewerRole,
}: {
	inquiries: InquirySummary[];
	basePath: string;
	viewerRole: "project" | "committee";
}) {
	if (inquiries.length === 0) {
		return (
			<div className={styles.empty}>
				<IconSearch size={40} />
				<Text size="3" color="gray">
					下書きはありません
				</Text>
			</div>
		);
	}

	return (
		<ul className={styles.list}>
			{inquiries.map(inq => (
				<InquiryCard
					key={inq.id}
					inquiry={inq}
					basePath={basePath}
					isMyInquiry={false}
					showAssignees
					viewerRole={viewerRole}
				/>
			))}
		</ul>
	);
}

function ProjectList({
	openItems,
	resolvedItems,
	basePath,
	viewerRole,
}: {
	openItems: InquirySummary[];
	resolvedItems: InquirySummary[];
	basePath: string;
	viewerRole: "project" | "committee";
}) {
	if (openItems.length === 0 && resolvedItems.length === 0) {
		return (
			<div className={styles.empty}>
				<IconSearch size={40} />
				<Text size="3" color="gray">
					お問い合わせはまだありません
				</Text>
			</div>
		);
	}

	return (
		<>
			{openItems.length > 0 ? (
				<ul className={styles.list}>
					{openItems.map(inq => (
						<InquiryCard
							key={inq.id}
							inquiry={inq}
							basePath={basePath}
							isMyInquiry={false}
							showAssignees={false}
							viewerRole={viewerRole}
						/>
					))}
				</ul>
			) : (
				<Text size="2" color="gray">
					未解決のお問い合わせはありません
				</Text>
			)}

			{resolvedItems.length > 0 && (
				<section className={styles.resolvedSection}>
					<Text size="2" weight="medium" color="gray">
						<IconCircleCheck size={14} />
						対応済み（{resolvedItems.length}件）
					</Text>
					<ul className={styles.list}>
						{resolvedItems.map(inq => (
							<InquiryCard
								key={inq.id}
								inquiry={inq}
								basePath={basePath}
								isMyInquiry={false}
								showAssignees={false}
								viewerRole={viewerRole}
							/>
						))}
					</ul>
				</section>
			)}
		</>
	);
}

function resolveInquiryStatusDisplay(inquiry: InquirySummary) {
	if (inquiry.isDraft) {
		return {
			label: "下書き",
			color: "orange" as const,
			icon: IconPencil,
			status: "DRAFT" as const,
		};
	}
	const config = statusConfig[inquiry.status];
	return {
		label: config.label,
		color: config.color,
		icon: config.icon,
		status: inquiry.status,
	};
}

function getInquiryPublishedAt(inquiry: InquirySummary) {
	if (inquiry.isDraft) return inquiry.createdAt;
	return inquiry.sentAt ?? inquiry.createdAt;
}

function CommitteeInquiryMeta({ inquiry }: { inquiry: InquirySummary }) {
	return (
		<Text size="1" color="gray">
			# {formatProjectNumber(inquiry.project.number)} / {inquiry.project.name} /{" "}
			{formatRelativeTime(getInquiryPublishedAt(inquiry), "auto")} に
			{inquiry.isDraft ? "作成" : "送信"}
			{inquiry.commentCount > 0 ? ` / ${inquiry.commentCount}件の返信` : ""}
		</Text>
	);
}

function InquiryAssignees({ assignees }: { assignees: AssigneeInfo[] }) {
	return (
		<span className={styles.assignees}>
			{assignees.slice(0, 3).map(a => (
				<Tooltip key={a.id} content={a.user.name}>
					<span className={styles.avatar}>
						<UserAvatar
							size={20}
							name={a.user.name}
							avatarFileId={a.user.avatarFileId}
						/>
					</span>
				</Tooltip>
			))}
			{assignees.length > 3 ? (
				<span className={styles.avatarMore}>+{assignees.length - 3}</span>
			) : null}
		</span>
	);
}

function InquiryCard({
	inquiry,
	basePath,
	isMyInquiry,
	showAssignees,
	viewerRole,
}: {
	inquiry: InquirySummary;
	basePath: string;
	isMyInquiry: boolean;
	showAssignees: boolean;
	viewerRole: "project" | "committee";
}) {
	const display = resolveInquiryStatusDisplay(inquiry);
	const isDraft = inquiry.isDraft;

	const viewerSide = viewerRole === "committee" ? "COMMITTEE" : "PROJECT";
	const needsResponse =
		!isDraft &&
		inquiry.status !== "RESOLVED" &&
		inquiry.awaitingReplyFrom === viewerSide;

	const allAssignees: AssigneeInfo[] = [
		...inquiry.committeeAssignees,
		...inquiry.projectAssignees,
	];
	const showMyAssigneeBadge = isMyInquiry && showAssignees;
	const showCommitteeMeta = viewerRole === "committee";

	const inquiryDetailPath =
		basePath === "/committee/support"
			? "/committee/support/$inquiryId"
			: "/project/support/$inquiryId";

	return (
		<li
			className={`${styles.card} ${inquiry.status === "UNASSIGNED" ? styles.cardNew : ""}`}
		>
			<Link
				to={inquiryDetailPath}
				params={{ inquiryId: inquiry.id }}
				className={styles.cardButton}
			>
				<span className={styles.statusIcon} data-status={display.status}>
					<Tooltip content={display.label}>
						<display.icon size={20} />
					</Tooltip>
				</span>

				<span className={styles.cardBody}>
					<span className={styles.cardTitleRow}>
						<Text size="3" weight="medium">
							{inquiry.title}
						</Text>
						{showMyAssigneeBadge && (
							<Tooltip content="自分が担当">
								<IconUserCheck size={14} className={styles.myBadge} />
							</Tooltip>
						)}
						{needsResponse && (
							<Badge
								color="red"
								size="1"
								variant="solid"
								radius="full"
								className={styles.attentionBadge}
							>
								<IconBell size={12} />
								未返信
							</Badge>
						)}
					</span>

					{showCommitteeMeta ? (
						<CommitteeInquiryMeta inquiry={inquiry} />
					) : null}

					<span className={styles.cardTags}>
						<Badge color={display.color} size="1" variant="soft">
							{display.label}
						</Badge>
						{showAssignees ? (
							<InquiryAssignees assignees={allAssignees} />
						) : null}
					</span>
				</span>
			</Link>
		</li>
	);
}
