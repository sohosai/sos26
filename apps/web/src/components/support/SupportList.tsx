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

export type CommitteeTab = "open" | "draft" | "resolved";

/** 「もっと見る」で続きを読み込む列 */
export type PagedInquiries = { items: InquirySummary[]; hasMore: boolean };
export type PagedView = "VIEWING" | "RESOLVED";

/** 実委側の一覧の列。検索は取得時にサーバーで済ませてある */
export type CommitteeInquiryLists = {
	mine: InquirySummary[];
	unassigned: InquirySummary[];
	viewing: PagedInquiries;
	draft: InquirySummary[];
	resolved: PagedInquiries;
};

export type CommitteeListProps = {
	activeTab: CommitteeTab;
	onTabChange: (tab: CommitteeTab) => void;
	/** 取得中は null */
	lists: CommitteeInquiryLists | null;
	searchQuery: string;
	onSearchQueryChange: (query: string) => void;
	onlyUnreplied: boolean;
	onOnlyUnrepliedChange: (onlyUnreplied: boolean) => void;
	onLoadMore: (view: PagedView) => void;
	loadingMore: boolean;
};

type SupportListProps = {
	currentUser: { id: string; name: string };
	basePath: string;
	onNewInquiry: () => void;
} & (
	| { viewerRole: "project"; inquiries: InquirySummary[] }
	| { viewerRole: "committee"; committee: CommitteeListProps }
);

export function SupportList(props: SupportListProps) {
	const { currentUser, viewerRole, basePath, onNewInquiry } = props;
	const isCommittee = viewerRole === "committee";

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

			{props.viewerRole === "committee" ? (
				<CommitteeSupportList
					{...props.committee}
					currentUser={currentUser}
					basePath={basePath}
				/>
			) : (
				<ProjectSupportList inquiries={props.inquiries} basePath={basePath} />
			)}
		</div>
	);
}

function SearchField({
	value,
	onChange,
}: {
	value: string;
	onChange: (value: string) => void;
}) {
	return (
		<div className={styles.search}>
			<TextField
				label="検索"
				placeholder="キーワードで検索..."
				value={value}
				onChange={onChange}
				type="search"
			/>
		</div>
	);
}

function CommitteeSupportList({
	activeTab,
	onTabChange,
	lists,
	searchQuery,
	onSearchQueryChange,
	onlyUnreplied,
	onOnlyUnrepliedChange,
	onLoadMore,
	loadingMore,
	currentUser,
	basePath,
}: CommitteeListProps & {
	currentUser: { id: string; name: string };
	basePath: string;
}) {
	const showUnrepliedFilter = activeTab === "open";
	const isAssignedToMe = (inq: InquirySummary) =>
		inq.committeeAssignees.some(a => a.user.id === currentUser.id);

	return (
		<>
			<div className={styles.toolbar}>
				<CommitteeTabs
					activeTab={activeTab}
					myCount={lists?.mine.length ?? 0}
					draftCount={lists?.draft.length ?? 0}
					onChangeTab={onTabChange}
				/>
				<div className={styles.filters}>
					<SearchField value={searchQuery} onChange={onSearchQueryChange} />
					{showUnrepliedFilter && (
						<div className={styles.filterToggle}>
							<Switch
								label="未返信のみ"
								size="1"
								checked={onlyUnreplied}
								onCheckedChange={onOnlyUnrepliedChange}
							/>
						</div>
					)}
				</div>
			</div>

			{lists ? (
				<CommitteeTabContent
					activeTab={activeTab}
					lists={lists}
					onlyUnreplied={onlyUnreplied}
					basePath={basePath}
					isAssignedToMe={isAssignedToMe}
					onLoadMore={onLoadMore}
					loadingMore={loadingMore}
				/>
			) : (
				<Text size="2" color="gray">
					読み込み中...
				</Text>
			)}
		</>
	);
}

function CommitteeTabContent({
	activeTab,
	lists,
	onlyUnreplied,
	basePath,
	isAssignedToMe,
	onLoadMore,
	loadingMore,
}: {
	activeTab: CommitteeTab;
	lists: CommitteeInquiryLists;
	onlyUnreplied: boolean;
	basePath: string;
	isAssignedToMe: (inq: InquirySummary) => boolean;
	onLoadMore: (view: PagedView) => void;
	loadingMore: boolean;
}) {
	if (activeTab === "draft") {
		return (
			<CommitteeDraftList
				inquiries={lists.draft}
				basePath={basePath}
				viewerRole="committee"
			/>
		);
	}
	if (activeTab === "resolved") {
		return (
			<CommitteeResolvedList
				resolved={lists.resolved}
				basePath={basePath}
				isAssignedToMe={isAssignedToMe}
				onLoadMore={() => onLoadMore("RESOLVED")}
				loadingMore={loadingMore}
			/>
		);
	}
	// 自分の担当と担当者未割り当ては全件を取得しているので、未返信の絞り込みはここで行う
	const filterUnreplied = (items: InquirySummary[]) =>
		onlyUnreplied ? items.filter(isAwaitingCommitteeReply) : items;
	return (
		<CommitteeOpenSections
			myItems={filterUnreplied(lists.mine)}
			unassignedItems={filterUnreplied(lists.unassigned)}
			viewing={lists.viewing}
			basePath={basePath}
			emptyMessage={
				onlyUnreplied
					? "未返信のお問い合わせはありません"
					: "未完了のお問い合わせはありません"
			}
			onLoadMore={() => onLoadMore("VIEWING")}
			loadingMore={loadingMore}
		/>
	);
}

function isAwaitingCommitteeReply(inq: InquirySummary) {
	return inq.awaitingReplyFrom === "COMMITTEE";
}

function ProjectSupportList({
	inquiries,
	basePath,
}: {
	inquiries: InquirySummary[];
	basePath: string;
}) {
	const [searchQuery, setSearchQuery] = useState("");

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

	return (
		<>
			<div className={styles.toolbar}>
				<div className={styles.filters}>
					<SearchField value={searchQuery} onChange={setSearchQuery} />
				</div>
			</div>
			<ProjectList
				openItems={searched.filter(
					inq => inq.status !== "RESOLVED" && !inq.isDraft
				)}
				resolvedItems={searched.filter(
					inq => inq.status === "RESOLVED" && !inq.isDraft
				)}
				basePath={basePath}
				viewerRole="project"
			/>
		</>
	);
}

function LoadMoreButton({
	onLoadMore,
	loadingMore,
}: {
	onLoadMore: () => void;
	loadingMore: boolean;
}) {
	return (
		<Button intent="secondary" onClick={onLoadMore} loading={loadingMore}>
			もっと見る
		</Button>
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
	myItems,
	unassignedItems,
	viewing,
	basePath,
	emptyMessage,
	onLoadMore,
	loadingMore,
}: {
	myItems: InquirySummary[];
	unassignedItems: InquirySummary[];
	viewing: PagedInquiries;
	basePath: string;
	emptyMessage: string;
	onLoadMore: () => void;
	loadingMore: boolean;
}) {
	const viewingItems = viewing.items;
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
								viewerRole="committee"
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
								viewerRole="committee"
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
					</div>
					<ul className={styles.list}>
						{viewingItems.map(inq => (
							<InquiryCard
								key={inq.id}
								inquiry={inq}
								basePath={basePath}
								isMyInquiry={false}
								showAssignees
								viewerRole="committee"
							/>
						))}
					</ul>
					{viewing.hasMore && (
						<LoadMoreButton onLoadMore={onLoadMore} loadingMore={loadingMore} />
					)}
				</section>
			)}
		</div>
	);
}

function CommitteeResolvedList({
	resolved,
	basePath,
	isAssignedToMe,
	onLoadMore,
	loadingMore,
}: {
	resolved: PagedInquiries;
	basePath: string;
	isAssignedToMe: (inq: InquirySummary) => boolean;
	onLoadMore: () => void;
	loadingMore: boolean;
}) {
	if (resolved.items.length === 0) {
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
		<>
			<ul className={styles.list}>
				{resolved.items.map(inq => (
					<InquiryCard
						key={inq.id}
						inquiry={inq}
						basePath={basePath}
						isMyInquiry={isAssignedToMe(inq)}
						showAssignees
						viewerRole="committee"
					/>
				))}
			</ul>
			{resolved.hasMore && (
				<LoadMoreButton onLoadMore={onLoadMore} loadingMore={loadingMore} />
			)}
		</>
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
