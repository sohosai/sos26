import { Badge, Separator, Text } from "@radix-ui/themes";
import type { GetNoticeResponse } from "@sos26/shared";
import {
	IconCheck,
	IconPlus,
	IconSend,
	IconTrash,
	IconX,
} from "@tabler/icons-react";
import Avatar from "boring-avatars";
import { useState } from "react";
import { Button, IconButton } from "@/components/primitives";
import { AddCollaboratorDialog } from "./AddCollaboratorDialog";
import styles from "./NoticeDetailSidebar.module.scss";
import { PublishRequestDialog } from "./PublishRequestDialog";
import { formatDateTime } from "./utils";

type NoticeDetail = GetNoticeResponse["notice"];

type AvailableMember = {
	userId: string;
	name: string;
};

type Props = {
	notice: NoticeDetail;
	noticeId: string;
	userId: string;
	isOwner: boolean;
	canEdit: boolean;
	availableMembers: AvailableMember[];
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
	const isApprover = pendingAuth?.requestedToId === userId;
	const hasApprovedAuth = notice.authorizations.some(
		a => a.status === "APPROVED"
	);
	const hasPendingAuth = notice.authorizations.some(
		a => a.status === "PENDING"
	);
	const canPublish = canEdit && !hasApprovedAuth && !hasPendingAuth;

	const showAuthBox = canPublish || pendingAuth;

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
							<Avatar size={32} name={notice.owner.name} variant="beam" />
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
										<Avatar size={24} name={c.user.name} variant="beam" />
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
							<button
								type="button"
								className={styles.addButton}
								onClick={() => setAddCollaboratorOpen(true)}
							>
								<IconPlus size={14} />
								<Text size="2">共同編集者を追加</Text>
							</button>
						)}
					</div>

					{(canEdit || isOwner) && (
						<>
							<Separator size="4" />
							<div className={styles.actions}>
								{canEdit && (
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

						{pendingAuth && (
							<div className={styles.section}>
								<Text size="2" weight="medium" color="gray">
									承認依頼
								</Text>
								{isApprover && (
									<Text size="2" color="orange" weight="medium">
										あなたに承認リクエストが届いています
									</Text>
								)}
								<div className={styles.authDetailRow}>
									<Text size="2" color="gray">
										申請者
									</Text>
									<div className={styles.authPerson}>
										<Avatar
											size={20}
											name={pendingAuth.requestedBy.name}
											variant="beam"
										/>
										<Text size="2">{pendingAuth.requestedBy.name}</Text>
									</div>
								</div>
								<div className={styles.authDetailRow}>
									<Text size="2" color="gray">
										承認者
									</Text>
									<div className={styles.authPerson}>
										<Avatar
											size={20}
											name={pendingAuth.requestedTo.name}
											variant="beam"
										/>
										<Text size="2">{pendingAuth.requestedTo.name}</Text>
									</div>
								</div>
								<div className={styles.authDetailRow}>
									<Text size="2" color="gray">
										公開希望日時
									</Text>
									<Text size="2">
										{formatDateTime(pendingAuth.deliveredAt)}
									</Text>
								</div>
								{pendingAuth.deliveries.length > 0 && (
									<div className={styles.authDetailRow}>
										<Text size="2" color="gray">
											配信先
										</Text>
										<div className={styles.projectTags}>
											{pendingAuth.deliveries.map(d => (
												<Badge key={d.id} variant="soft" size="1">
													{d.project.name}
												</Badge>
											))}
										</div>
									</div>
								)}
								{isApprover && (
									<div className={styles.authorizationActions}>
										<Button
											intent="primary"
											size="2"
											onClick={async () => {
												setApprovingId(pendingAuth.id);
												try {
													await onApprove(pendingAuth.id);
												} finally {
													setApprovingId(null);
												}
											}}
											loading={approvingId === pendingAuth.id}
											disabled={rejectingId !== null}
										>
											<IconCheck size={16} />
											承認
										</Button>
										<Button
											intent="secondary"
											size="2"
											onClick={async () => {
												setRejectingId(pendingAuth.id);
												try {
													await onReject(pendingAuth.id);
												} finally {
													setRejectingId(null);
												}
											}}
											loading={rejectingId === pendingAuth.id}
											disabled={approvingId !== null}
										>
											<IconX size={16} />
											却下
										</Button>
									</div>
								)}
							</div>
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
				collaborators={notice.collaborators}
				onSuccess={onPublishSuccess}
			/>
		</>
	);
}
