import { Badge, Separator, Text } from "@radix-ui/themes";
import type { ProjectRegistrationFormDetail } from "@sos26/shared";
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
import { RequestAuthorizationDialog } from "../../-components/RequestAuthorizationDialog";
import styles from "./ProjectRegistrationFormDetailSidebar.module.scss";

type AvailableMember = {
	userId: string;
	name: string;
	avatarFileId?: string | null;
};
type Approver = { userId: string; name: string; avatarFileId?: string | null };

type Props = {
	form: ProjectRegistrationFormDetail;
	userId: string;
	isOwner: boolean;
	canEdit: boolean;
	availableMembers: AvailableMember[];
	approvers: Approver[];
	removingId: string | null;
	onAddCollaborator: (userId: string) => Promise<void>;
	onRemoveCollaborator: (userId: string) => Promise<void>;
	onApprove: (authorizationId: string) => Promise<void>;
	onReject: (authorizationId: string) => Promise<void>;
	onAuthRequestSuccess: () => void;
	onEdit: () => void;
	onDelete: () => void;
};

export function ProjectRegistrationFormDetailSidebar({
	form,
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
	onAuthRequestSuccess,
	onEdit,
	onDelete,
}: Props) {
	const [addCollaboratorOpen, setAddCollaboratorOpen] = useState(false);
	const [authRequestOpen, setAuthRequestOpen] = useState(false);
	const [approvingId, setApprovingId] = useState<string | null>(null);
	const [rejectingId, setRejectingId] = useState<string | null>(null);

	const latestAuth = form.authorizations[0] ?? null;
	const isApprover =
		latestAuth?.status === "PENDING" && latestAuth.requestedToId === userId;

	const canRequestAuth =
		canEdit && !form.isActive && latestAuth?.status !== "PENDING";

	const showAuthBox = canRequestAuth || latestAuth;

	const canDelete = isOwner && !form.isActive;

	const handleApprove = async (id: string) => {
		setApprovingId(id);
		try {
			await onApprove(id);
		} finally {
			setApprovingId(null);
		}
	};
	const handleReject = async (id: string) => {
		setRejectingId(id);
		try {
			await onReject(id);
		} finally {
			setRejectingId(null);
		}
	};

	return (
		<>
			<div className={styles.sidebarWrapper}>
				{/* ボックス1: オーナー・共同編集者・アクション */}
				<aside className={styles.sidebar}>
					{/* オーナー */}
					<div className={styles.section}>
						<Text size="2" weight="medium" color="gray">
							オーナー
						</Text>
						<div className={styles.ownerItem}>
							<UserAvatar
								size={32}
								name={form.owner.name}
								avatarFileId={form.owner.avatarFileId}
							/>
							<Text size="2" weight="medium">
								{form.owner.name}
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
							{form.collaborators.length > 0 && (
								<Badge variant="soft" size="1">
									{form.collaborators.length}
								</Badge>
							)}
						</div>
						{form.collaborators.length === 0 ? (
							<Text size="1" color="gray">
								なし
							</Text>
						) : (
							<div className={styles.collaboratorList}>
								{form.collaborators.map(c => (
									<div key={c.user.id} className={styles.collaboratorItem}>
										<UserAvatar
											size={24}
											name={c.user.name}
											avatarFileId={c.user.avatarFileId}
										/>
										<Text size="2">{c.user.name}</Text>
										{isOwner && (
											<IconButton
												aria-label={`${c.user.name}を削除`}
												onClick={() => onRemoveCollaborator(c.user.id)}
												disabled={removingId === c.user.id}
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

					<ActionsSection
						canEdit={canEdit}
						canDelete={canDelete}
						onEdit={onEdit}
						onDelete={onDelete}
					/>
				</aside>

				{/* ボックス2: 承認依頼 */}
				{showAuthBox && (
					<aside className={styles.sidebar}>
						{canRequestAuth && (
							<div className={styles.section}>
								<Text size="2" weight="medium" color="gray">
									承認依頼
								</Text>
								<Button
									intent="primary"
									size="2"
									onClick={() => setAuthRequestOpen(true)}
								>
									<IconSend size={16} />
									承認依頼を行う
								</Button>
							</div>
						)}

						{latestAuth && (
							<AuthDetailSection
								auth={latestAuth}
								isApprover={isApprover}
								approvingId={approvingId}
								rejectingId={rejectingId}
								onApprove={handleApprove}
								onReject={handleReject}
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

			<RequestAuthorizationDialog
				open={authRequestOpen}
				onOpenChange={setAuthRequestOpen}
				formId={form.id}
				approvers={approvers}
				onSuccess={onAuthRequestSuccess}
			/>
		</>
	);
}

type ActionsSectionProps = {
	canEdit: boolean;
	canDelete: boolean;
	onEdit: () => void;
	onDelete: () => void;
};

function ActionsSection({
	canEdit,
	canDelete,
	onEdit,
	onDelete,
}: ActionsSectionProps) {
	if (!canEdit && !canDelete) return null;
	return (
		<>
			<Separator size="4" />
			<div className={styles.actions}>
				{canEdit && (
					<Button intent="secondary" size="2" onClick={onEdit}>
						編集
					</Button>
				)}
				{canDelete && (
					<Button intent="ghost" size="2" onClick={onDelete}>
						<IconTrash size={14} />
						削除
					</Button>
				)}
			</div>
		</>
	);
}

type Auth = ProjectRegistrationFormDetail["authorizations"][number];

type AuthDetailSectionProps = {
	auth: Auth;
	isApprover: boolean;
	approvingId: string | null;
	rejectingId: string | null;
	onApprove: (id: string) => void;
	onReject: (id: string) => void;
};

function AuthDetailSection({
	auth,
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
			{isApprover && auth.status === "PENDING" && (
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
					申請日時
				</Text>
				<Text size="2">{formatDate(auth.createdAt, "datetime")}</Text>
			</div>
			<div className={styles.authDetailRow}>
				<Text size="2" color="gray">
					ステータス
				</Text>
				<div>
					<AuthStatusBadge status={auth.status} />
				</div>
			</div>
			{isApprover && auth.status === "PENDING" && (
				<div className={styles.authorizationActions}>
					<Button
						intent="primary"
						size="2"
						onClick={() => onApprove(auth.id)}
						loading={approvingId === auth.id}
						disabled={rejectingId !== null || approvingId === auth.id}
					>
						<IconCheck size={16} />
						承認
					</Button>
					<Button
						intent="secondary"
						size="2"
						onClick={() => onReject(auth.id)}
						loading={rejectingId === auth.id}
						disabled={approvingId !== null || rejectingId === auth.id}
					>
						<IconX size={16} />
						却下
					</Button>
				</div>
			)}
		</div>
	);
}

function AuthStatusBadge({ status }: { status: string }) {
	if (status === "PENDING")
		return (
			<Badge variant="soft" color="orange">
				承認待機中
			</Badge>
		);
	if (status === "APPROVED")
		return (
			<Badge variant="soft" color="green">
				承認済み
			</Badge>
		);
	if (status === "REJECTED")
		return (
			<Badge variant="soft" color="red">
				却下
			</Badge>
		);
	return (
		<Badge variant="soft" color="gray">
			{status}
		</Badge>
	);
}
