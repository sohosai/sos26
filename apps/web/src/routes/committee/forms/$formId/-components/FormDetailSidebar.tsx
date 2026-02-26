import { Badge, Separator, Text } from "@radix-ui/themes";
import type { GetFormDetailResponse } from "@sos26/shared";
import {
	IconCheck,
	IconPlus,
	IconSend,
	IconTrash,
	IconX,
} from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import Avatar from "boring-avatars";
import { useState } from "react";
import { AddCollaboratorDialog } from "@/components/committee/AddCollaboratorDialog";
import { Button, IconButton } from "@/components/primitives";
import { getFormStatusFromAuth } from "@/lib/form/form-status";
import { formatDate } from "@/lib/format";
import styles from "./FormDetailSidebar.module.scss";
import { FormPublishRequestDialog } from "./FormPublishRequestDialog";

type FormDetail = GetFormDetailResponse["form"];

type AvailableMember = {
	userId: string;
	name: string;
};

type Approver = {
	userId: string;
	name: string;
};

function resolveFormPermissions(params: {
	canEdit: boolean;
	statusCode: string;
}) {
	const { canEdit, statusCode } = params;

	return {
		// 公開申請できるのは「下書き or 却下」のみ
		canPublish:
			canEdit && (statusCode === "DRAFT" || statusCode === "REJECTED"),
		// 編集できるのは「承認済み以外」
		canEditForm:
			canEdit && statusCode !== "PUBLISHED" && statusCode !== "SCHEDULED",
		// 回答確認は「公開済み」または「期限切れ」
		canViewAnswers:
			canEdit && (statusCode === "PUBLISHED" || statusCode === "EXPIRED"),
	};
}

type Props = {
	form: FormDetail;
	userId: string;
	isOwner: boolean;
	canEdit: boolean;
	availableMembers: AvailableMember[];
	approvers: Approver[];
	removingId: string | null;
	isEditMode: boolean;
	isSaving: boolean;
	onAddCollaborator: (userId: string) => Promise<void>;
	onRemoveCollaborator: (collaboratorId: string) => void;
	onApprove: (authorizationId: string) => Promise<void>;
	onReject: (authorizationId: string) => Promise<void>;
	onPublishSuccess: () => void;
	onEdit: () => void;
	onSave: () => void;
	onCancelEdit: () => void;
	onDelete: () => void;
};

export function FormDetailSidebar({
	form,
	userId,
	isOwner,
	canEdit,
	availableMembers,
	approvers,
	removingId,
	isEditMode,
	isSaving,
	onAddCollaborator,
	onRemoveCollaborator,
	onApprove,
	onReject,
	onPublishSuccess,
	onEdit,
	onSave,
	onCancelEdit,
	onDelete,
}: Props) {
	const [addCollaboratorOpen, setAddCollaboratorOpen] = useState(false);
	const [publishRequestOpen, setPublishRequestOpen] = useState(false);
	const [approvingId, setApprovingId] = useState<string | null>(null);
	const [rejectingId, setRejectingId] = useState<string | null>(null);

	const latestAuth = form.authorizationDetail;
	const statusInfo = getFormStatusFromAuth(
		latestAuth
			? {
					status: latestAuth.status,
					deliveredAt: latestAuth.scheduledSendAt,
					allowLateResponse: latestAuth.allowLateResponse,
					deadlineAt: latestAuth.deadlineAt,
				}
			: null
	);
	const isApprover =
		latestAuth?.status === "PENDING" && latestAuth.requestedToId === userId;

	const { canPublish, canEditForm, canViewAnswers } = resolveFormPermissions({
		canEdit,
		statusCode: statusInfo.code,
	});

	const showAuthBox =
		canPublish || (latestAuth && latestAuth?.status === "PENDING");

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
							<Avatar size={32} name={form.owner.name} variant="beam" />
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
									<div key={c.id} className={styles.collaboratorItem}>
										<Avatar size={24} name={c.user.name} variant="beam" />
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
								disabled={isEditMode}
							>
								<IconPlus size={14} />
								共同編集者を追加
							</Button>
						)}
					</div>

					{canEditForm && (
						<>
							<Separator size="4" />
							<div className={styles.actions}>
								{isEditMode ? (
									<>
										<Button
											intent="primary"
											size="2"
											onClick={onSave}
											loading={isSaving}
										>
											保存
										</Button>
										<Button
											intent="ghost"
											size="2"
											onClick={onCancelEdit}
											disabled={isSaving}
										>
											キャンセル
										</Button>
									</>
								) : (
									<>
										<Button intent="secondary" size="2" onClick={onEdit}>
											編集
										</Button>
										{isOwner && (
											<Button intent="ghost" size="2" onClick={onDelete}>
												<IconTrash size={14} />
												削除
											</Button>
										)}
									</>
								)}
							</div>
						</>
					)}
				</aside>

				{/* ボックス2: 承認依頼 */}
				{showAuthBox && !isEditMode && (
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

						{latestAuth && latestAuth?.status === "PENDING" && (
							<AuthDetailSection
								auth={latestAuth}
								pendingAuth={latestAuth}
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

				{/* ボックス3: 回答確認 */}
				{canViewAnswers && !isEditMode && (
					<aside className={styles.sidebar}>
						<Link
							to="/committee/forms/$formId/answers"
							params={{ formId: form.id }}
						>
							<div className={styles.section}>
								<Button intent="primary" size="2">
									回答を確認する
								</Button>
							</div>
						</Link>
					</aside>
				)}
			</div>

			<AddCollaboratorDialog
				open={addCollaboratorOpen}
				onOpenChange={setAddCollaboratorOpen}
				availableMembers={availableMembers}
				onAdd={onAddCollaborator}
			/>

			<FormPublishRequestDialog
				open={publishRequestOpen}
				onOpenChange={setPublishRequestOpen}
				formId={form.id}
				approvers={approvers}
				onSuccess={onPublishSuccess}
			/>
		</>
	);
}

type AuthDetailSectionProps = {
	auth: FormDetail["authorizationDetail"];
	pendingAuth: FormDetail["authorizationDetail"] | undefined;
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
	if (!auth) {
		return null;
	}
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
					<Avatar size={20} name={auth.requestedBy.name} variant="beam" />
					<Text size="2">{auth.requestedBy.name}</Text>
				</div>
			</div>
			<div className={styles.authDetailRow}>
				<Text size="2" color="gray">
					承認者
				</Text>
				<div className={styles.authPerson}>
					<Avatar size={20} name={auth.requestedTo.name} variant="beam" />
					<Text size="2">{auth.requestedTo.name}</Text>
				</div>
			</div>
			<div className={styles.authDetailRow}>
				<Text size="2" color="gray">
					公開希望日時
				</Text>
				<Text size="2">{formatDate(auth.scheduledSendAt, "datetime")}</Text>
			</div>
			{auth.deadlineAt && (
				<>
					<div className={styles.authDetailRow}>
						<Text size="2" color="gray">
							回答期限
						</Text>
						<Text size="2">{formatDate(auth.deadlineAt, "datetime")}</Text>
					</div>
					<div className={styles.authDetailRow}>
						<Text size="2" color="gray">
							遅延提出
						</Text>
						<Text size="2">{auth.allowLateResponse ? "許可" : "不可"}</Text>
					</div>
				</>
			)}

			<div className={styles.authDetailRow}>
				<Text size="2" color="gray">
					回答
				</Text>
				<Text size="2">{auth.required ? "必須" : "任意"}</Text>
			</div>
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
