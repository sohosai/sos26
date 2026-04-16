import { Badge, Separator, Text } from "@radix-ui/themes";
import type { DeliveryMode, GetNoticeResponse } from "@sos26/shared";
import {
	IconCheck,
	IconPlus,
	IconSend,
	IconTrash,
	IconX,
} from "@tabler/icons-react";
import { useState } from "react";
import { AddCollaboratorDialog } from "@/components/committee/AddCollaboratorDialog";
import { UserAvatar } from "@/components/common/UserAvatar";
import { Button, IconButton } from "@/components/primitives";
import { formatDate } from "@/lib/format";
import {
	PROJECT_LOCATION_LABELS,
	PROJECT_TYPE_LABELS,
} from "@/lib/project/options";
import styles from "./NoticeDetailSidebar.module.scss";
import { PublishRequestDialog } from "./PublishRequestDialog";

type NoticeDetail = GetNoticeResponse["notice"];

type AvailableMember = {
	userId: string;
	name: string;
	avatarFileId?: string | null;
};

type Approver = {
	userId: string;
	name: string;
	avatarFileId?: string | null;
};

type Props = {
	notice: NoticeDetail;
	noticeId: string;
	userId: string;
	isOwner: boolean;
	canEdit: boolean;
	availableMembers: AvailableMember[];
	approvers: Approver[];
	removingId: string | null;
	onAddCollaborator: (userId: string) => Promise<void>;
	onRemoveCollaborator: (collaboratorId: string) => void;
	onApprove: (authorizationId: string) => Promise<void>;
	onReject: (authorizationId: string) => Promise<void>;
	onPublishSuccess: () => void;
	onEdit: () => void;
	onDelete: () => void;
};

export function NoticeDetailSidebar({
	notice,
	noticeId,
	userId,
	isOwner,
	canEdit,
	availableMembers,
	approvers,
	removingId,
	onAddCollaborator,
	onRemoveCollaborator,
	onApprove,
	onReject,
	onPublishSuccess,
	onEdit,
	onDelete,
}: Props) {
	const [addCollaboratorOpen, setAddCollaboratorOpen] = useState(false);
	const [publishRequestOpen, setPublishRequestOpen] = useState(false);
	const [approvingId, setApprovingId] = useState<string | null>(null);
	const [rejectingId, setRejectingId] = useState<string | null>(null);

	const pendingAuth = notice.authorizations.find(a => a.status === "PENDING");
	const approvedAuth = notice.authorizations.find(a => a.status === "APPROVED");
	const latestAuth = pendingAuth ?? approvedAuth;
	const isApprover = pendingAuth?.requestedToId === userId;
	const hasApprovedAuth = notice.authorizations.some(
		a => a.status === "APPROVED"
	);
	const hasPendingAuth = notice.authorizations.some(
		a => a.status === "PENDING"
	);
	const canEditNotice = canEdit && !hasApprovedAuth && !hasPendingAuth;
	const canPublish = canEditNotice;

	const showAuthBox = canPublish || latestAuth;

	return (
		<>
			<div className={styles.sidebarWrapper}>
				{/* ボックス1: メンバー & アクション */}
				<aside className={styles.sidebar}>
					{/* オーナー */}
					<div className={styles.section}>
						<Text size="2" weight="medium" color="gray">
							オーナー
						</Text>
						<div className={styles.ownerItem}>
							<UserAvatar
								size={32}
								name={notice.owner.name}
								avatarFileId={notice.owner.avatarFileId}
							/>
							<Text size="2" weight="medium">
								{notice.owner.name}
							</Text>
						</div>
					</div>

					<Separator size="4" />

					{/* 共同編集者 */}
					<div className={styles.section}>
						<div className={styles.sectionHeader}>
							<Text size="2" weight="medium" color="gray">
								共同編集者
							</Text>
							{notice.collaborators.length > 0 && (
								<Badge variant="soft" size="1">
									{notice.collaborators.length}
								</Badge>
							)}
						</div>
						{notice.collaborators.length === 0 ? (
							<Text size="1" color="gray">
								なし
							</Text>
						) : (
							<div className={styles.collaboratorList}>
								{notice.collaborators.map(c => (
									<div key={c.id} className={styles.collaboratorItem}>
										<UserAvatar
											size={24}
											name={c.user.name}
											avatarFileId={c.user.avatarFileId}
										/>
										<Text size="2">{c.user.name}</Text>
										{isOwner && (
											<IconButton
												aria-label={`${c.user.name}を削除`}
												onClick={() => onRemoveCollaborator(c.id)}
												disabled={removingId === c.id}
											>
												<IconTrash size={16} />
											</IconButton>
										)}
									</div>
								))}
							</div>
						)}
						{isOwner && (
							<Button
								intent="secondary"
								size="2"
								onClick={() => setAddCollaboratorOpen(true)}
							>
								<IconPlus size={14} />
								共同編集者を追加
							</Button>
						)}
					</div>

					{(canEditNotice || isOwner) && (
						<>
							<Separator size="4" />
							<div className={styles.actions}>
								{canEditNotice && (
									<Button intent="secondary" size="2" onClick={onEdit}>
										編集
									</Button>
								)}
								{isOwner && (
									<Button intent="ghost" size="2" onClick={onDelete}>
										<IconTrash size={14} />
										削除
									</Button>
								)}
							</div>
						</>
					)}
				</aside>

				{/* ボックス2: 承認依頼 */}
				{showAuthBox && (
					<aside className={styles.sidebar}>
						{canPublish && (
							<div className={styles.section}>
								<Text size="2" weight="medium" color="gray">
									公開申請
								</Text>
								<Button
									intent="primary"
									size="2"
									onClick={() => setPublishRequestOpen(true)}
								>
									<IconSend size={16} />
									公開申請を行う
								</Button>
							</div>
						)}

						{latestAuth && (
							<AuthDetailSection
								auth={latestAuth}
								pendingAuth={pendingAuth}
								isApprover={isApprover}
								approvingId={approvingId}
								rejectingId={rejectingId}
								onApprove={async id => {
									setApprovingId(id);
									try {
										await onApprove(id);
									} finally {
										setApprovingId(null);
									}
								}}
								onReject={async id => {
									setRejectingId(id);
									try {
										await onReject(id);
									} finally {
										setRejectingId(null);
									}
								}}
							/>
						)}
					</aside>
				)}
			</div>

			<AddCollaboratorDialog
				open={addCollaboratorOpen}
				onOpenChange={setAddCollaboratorOpen}
				availableMembers={availableMembers}
				onAdd={onAddCollaborator}
			/>

			<PublishRequestDialog
				open={publishRequestOpen}
				onOpenChange={setPublishRequestOpen}
				noticeId={noticeId}
				approvers={approvers}
				onSuccess={onPublishSuccess}
			/>
		</>
	);
}

type AuthDetailSectionProps = {
	auth: NoticeDetail["authorizations"][number];
	pendingAuth: NoticeDetail["authorizations"][number] | undefined;
	isApprover: boolean;
	approvingId: string | null;
	rejectingId: string | null;
	onApprove: (id: string) => void;
	onReject: (id: string) => void;
};

function AuthDetailSection({
	auth,
	pendingAuth,
	isApprover,
	approvingId,
	rejectingId,
	onApprove,
	onReject,
}: AuthDetailSectionProps) {
	return (
		<div className={styles.section}>
			<Text size="2" weight="medium" color="gray">
				承認依頼
			</Text>
			{isApprover && pendingAuth && (
				<Text size="2" color="orange" weight="medium">
					あなたに承認リクエストが届いています
				</Text>
			)}
			<div className={styles.authDetailRow}>
				<Text size="2" color="gray">
					申請者
				</Text>
				<div className={styles.authPerson}>
					<UserAvatar
						size={20}
						name={auth.requestedBy.name}
						avatarFileId={auth.requestedBy.avatarFileId}
					/>
					<Text size="2">{auth.requestedBy.name}</Text>
				</div>
			</div>
			<div className={styles.authDetailRow}>
				<Text size="2" color="gray">
					承認者
				</Text>
				<div className={styles.authPerson}>
					<UserAvatar
						size={20}
						name={auth.requestedTo.name}
						avatarFileId={auth.requestedTo.avatarFileId}
					/>
					<Text size="2">{auth.requestedTo.name}</Text>
				</div>
			</div>
			<div className={styles.authDetailRow}>
				<Text size="2" color="gray">
					公開希望日時
				</Text>
				<Text size="2">{formatDate(auth.deliveredAt, "datetime")}</Text>
			</div>
			<DeliveryTargetDisplay
				deliveryMode={auth.deliveryMode}
				filterTypes={auth.filterTypes}
				filterLocations={auth.filterLocations}
				deliveries={auth.deliveries}
			/>
			{isApprover && pendingAuth && (
				<div className={styles.authorizationActions}>
					<Button
						intent="primary"
						size="2"
						onClick={() => onApprove(pendingAuth.id)}
						loading={approvingId === pendingAuth.id}
						disabled={rejectingId !== null}
					>
						<IconCheck size={16} />
						承認
					</Button>
					<Button
						intent="secondary"
						size="2"
						onClick={() => onReject(pendingAuth.id)}
						loading={rejectingId === pendingAuth.id}
						disabled={approvingId !== null}
					>
						<IconX size={16} />
						却下
					</Button>
				</div>
			)}
		</div>
	);
}

function DeliveryTargetDisplay({
	deliveryMode,
	filterTypes,
	filterLocations,
	deliveries,
}: {
	deliveryMode: DeliveryMode;
	filterTypes: string[];
	filterLocations: string[];
	deliveries: { id: string; project: { id: string; name: string } }[];
}) {
	if (deliveryMode === "CATEGORY") {
		const isAll = filterTypes.length === 0 && filterLocations.length === 0;
		return (
			<div className={styles.authDetailRow}>
				<Text size="2" color="gray">
					配信先
				</Text>
				{isAll ? (
					<div className={styles.projectTags}>
						<Badge variant="soft" size="1" color="blue">
							全企画
						</Badge>
					</div>
				) : (
					<div className={styles.projectTags}>
						{filterTypes.map(t => (
							<Badge key={t} variant="soft" size="1" color="violet">
								{PROJECT_TYPE_LABELS[t] ?? t}
							</Badge>
						))}
						{filterLocations.map(l => (
							<Badge key={l} variant="soft" size="1" color="cyan">
								{PROJECT_LOCATION_LABELS[l] ?? l}
							</Badge>
						))}
					</div>
				)}
				<Text size="1" color="gray">
					カテゴリ指定
				</Text>
			</div>
		);
	}

	if (deliveries.length === 0) return null;

	return (
		<div className={styles.authDetailRow}>
			<Text size="2" color="gray">
				配信先
			</Text>
			<div className={styles.projectTags}>
				{deliveries.map(d => (
					<Badge key={d.id} variant="soft" size="1">
						{d.project.name}
					</Badge>
				))}
			</div>
			<Text size="1" color="gray">
				個別指定（{deliveries.length}件）
			</Text>
		</div>
	);
}
