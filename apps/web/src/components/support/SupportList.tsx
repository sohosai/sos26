import { Badge, Heading, Text, Tooltip } from "@radix-ui/themes";
import type {
	InquiryStatus,
	ListProjectInquiriesResponse,
} from "@sos26/shared";
import {
	IconAlertCircle,
	IconCircleCheck,
	IconCircleDot,
	IconEye,
	IconLoader,
	IconSearch,
	IconStar,
	IconStarFilled,
} from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import Avatar from "boring-avatars";
import { useState } from "react";
import { Button, TextField } from "@/components/primitives";
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

type CommitteeTab = "open" | "resolved";

export function SupportList({
	inquiries,
	currentUser,
	viewerRole,
	basePath,
	onNewInquiry,
	isAdmin = false,
}: SupportListProps) {
	const [activeTab, setActiveTab] = useState<CommitteeTab>("open");
	const [searchQuery, setSearchQuery] = useState("");
	const isCommittee = viewerRole === "committee";

	const searched = searchQuery
		? inquiries.filter(inq => inq.title.includes(searchQuery))
		: inquiries;

	const isAssignedToMe = (inq: InquirySummary) => {
		const assignees = isCommittee
			? inq.committeeAssignees
			: inq.projectAssignees;
		return assignees.some(a => a.user.id === currentUser.id);
	};

	const myCount = searched.filter(
		inq => inq.status !== "RESOLVED" && isAssignedToMe(inq)
	).length;

	// 企画者側: 未解決 / 解決済みに分割
	const openItems = searched.filter(inq => inq.status !== "RESOLVED");
	const resolvedItems = searched.filter(inq => inq.status === "RESOLVED");

	return (
		<div className={styles.container}>
			<div className={styles.header}>
				<div className={styles.titleRow}>
					<Heading size="6">問い合わせ</Heading>
					<Button onClick={onNewInquiry}>新しい問い合わせ</Button>
				</div>
				<Text size="2" color="gray">
					{isCommittee
						? "企画からの問い合わせを管理します"
						: "実行委員会への問い合わせを管理します"}
				</Text>
			</div>

			<div className={styles.toolbar}>
				{isCommittee && (
					<CommitteeTabs
						activeTab={activeTab}
						myCount={myCount}
						onChangeTab={setActiveTab}
					/>
				)}
				<div className={styles.search}>
					<TextField
						label="検索"
						placeholder="キーワードで検索..."
						value={searchQuery}
						onChange={setSearchQuery}
						type="search"
					/>
				</div>
			</div>

			{isCommittee ? (
				activeTab === "open" ? (
					<CommitteeOpenSections
						inquiries={searched}
						currentUser={currentUser}
						basePath={basePath}
						isAdmin={isAdmin}
					/>
				) : (
					<CommitteeResolvedList
						inquiries={searched}
						basePath={basePath}
						isAssignedToMe={isAssignedToMe}
					/>
				)
			) : (
				<ProjectList
					openItems={openItems}
					resolvedItems={resolvedItems}
					basePath={basePath}
				/>
			)}
		</div>
	);
}

/* ─── サブコンポーネント ─── */

function CommitteeTabs({
	activeTab,
	myCount,
	onChangeTab,
}: {
	activeTab: CommitteeTab;
	myCount: number;
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
}: {
	inquiries: InquirySummary[];
	currentUser: { id: string; name: string };
	basePath: string;
	isAdmin: boolean;
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

	// セクション3: 閲覧中（自分が担当者ではなく対応中のもの）
	const viewingItems = inquiries.filter(
		inq => inq.status === "IN_PROGRESS" && !isAssignedToMe(inq)
	);

	const hasAnyItems =
		myItems.length > 0 || unassignedItems.length > 0 || viewingItems.length > 0;

	if (!hasAnyItems) {
		return (
			<div className={styles.empty}>
				<IconSearch size={40} />
				<Text size="3" color="gray">
					未完了の問い合わせはありません
				</Text>
			</div>
		);
	}

	return (
		<div className={styles.sections}>
			{myItems.length > 0 && (
				<section className={styles.section}>
					<div className={styles.sectionTitle}>
						<IconStarFilled size={14} />
						<Text size="2" weight="medium">
							自分の担当
						</Text>
						<Badge size="1" variant="soft">
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
						<Badge size="1" variant="soft" color="orange">
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
						<Badge size="1" variant="soft" color="gray">
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
}: {
	inquiries: InquirySummary[];
	basePath: string;
	isAssignedToMe: (inq: InquirySummary) => boolean;
}) {
	const items = inquiries.filter(inq => inq.status === "RESOLVED");

	if (items.length === 0) {
		return (
			<div className={styles.empty}>
				<IconSearch size={40} />
				<Text size="3" color="gray">
					解決済みの問い合わせはありません
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
				/>
			))}
		</ul>
	);
}

function ProjectList({
	openItems,
	resolvedItems,
	basePath,
}: {
	openItems: InquirySummary[];
	resolvedItems: InquirySummary[];
	basePath: string;
}) {
	if (openItems.length === 0 && resolvedItems.length === 0) {
		return (
			<div className={styles.empty}>
				<IconSearch size={40} />
				<Text size="3" color="gray">
					問い合わせはまだありません
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
						/>
					))}
				</ul>
			) : (
				<Text size="2" color="gray">
					未解決の問い合わせはありません
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
							/>
						))}
					</ul>
				</section>
			)}
		</>
	);
}

function InquiryCard({
	inquiry,
	basePath,
	isMyInquiry,
	showAssignees,
}: {
	inquiry: InquirySummary;
	basePath: string;
	isMyInquiry: boolean;
	showAssignees: boolean;
}) {
	const navigate = useNavigate();
	const config = statusConfig[inquiry.status];
	const StatusIcon = config.icon;
	const hasNoAssignee =
		inquiry.committeeAssignees.length === 0 ||
		inquiry.projectAssignees.length === 0;

	const allAssignees: AssigneeInfo[] = [
		...inquiry.committeeAssignees,
		...inquiry.projectAssignees,
	];

	return (
		<li
			className={`${styles.card} ${inquiry.status === "UNASSIGNED" ? styles.cardNew : ""}`}
		>
			<button
				type="button"
				className={styles.cardButton}
				onClick={() => navigate({ to: `${basePath}/${inquiry.id}` as string })}
			>
				<span className={styles.statusIcon} data-status={inquiry.status}>
					<Tooltip content={config.label}>
						<StatusIcon size={20} />
					</Tooltip>
				</span>

				<span className={styles.cardBody}>
					<span className={styles.cardTitleRow}>
						<Text size="3" weight="medium">
							{inquiry.title}
						</Text>
						{isMyInquiry && showAssignees && (
							<Tooltip content="自分が担当">
								<IconStar size={14} className={styles.myBadge} />
							</Tooltip>
						)}
					</span>

					<Text size="1" color="gray">
						{formatDate(inquiry.createdAt)} に作成
						{inquiry.commentCount > 0 && ` / ${inquiry.commentCount}件の返信`}
					</Text>

					<span className={styles.cardTags}>
						<Badge color={config.color} size="1" variant="soft">
							{config.label}
						</Badge>
						{showAssignees &&
							hasNoAssignee &&
							inquiry.status === "UNASSIGNED" && (
								<Badge color="red" size="1" variant="soft">
									担当者未設定
								</Badge>
							)}
						{showAssignees && (
							<span className={styles.assignees}>
								{allAssignees.slice(0, 3).map(a => (
									<Tooltip key={a.id} content={a.user.name}>
										<span className={styles.avatar}>
											<Avatar size={20} name={a.user.name} variant="beam" />
										</span>
									</Tooltip>
								))}
								{allAssignees.length > 3 && (
									<span className={styles.avatarMore}>
										+{allAssignees.length - 3}
									</span>
								)}
							</span>
						)}
					</span>
				</span>
			</button>
		</li>
	);
}

function formatDate(date: Date): string {
	const m = (date.getMonth() + 1).toString().padStart(2, "0");
	const d = date.getDate().toString().padStart(2, "0");
	const h = date.getHours().toString().padStart(2, "0");
	const min = date.getMinutes().toString().padStart(2, "0");
	return `${m}/${d} ${h}:${min}`;
}
