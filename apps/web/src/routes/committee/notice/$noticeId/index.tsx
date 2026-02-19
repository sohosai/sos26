import {
	AlertDialog,
	Badge,
	type BadgeProps,
	Heading,
	Separator,
	Text,
} from "@radix-ui/themes";
import type { GetNoticeResponse } from "@sos26/shared";
import { IconArrowLeft, IconCalendar, IconClock } from "@tabler/icons-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/primitives";
import { listCommitteeMembers } from "@/lib/api/committee-member";
import {
	addCollaborator,
	deleteNotice,
	getNotice,
	removeCollaborator,
	updateNoticeAuthorization,
} from "@/lib/api/committee-notice";
import { useAuthStore } from "@/lib/auth";
import { sanitizeHtml } from "@/lib/sanitize";
import { CreateNoticeDialog } from "../CreateNoticeDialog";
import styles from "./index.module.scss";
import { NoticeDetailSidebar } from "./NoticeDetailSidebar";
import { formatDateTime } from "./utils";

type NoticeDetail = GetNoticeResponse["notice"];
type CommitteeMember = {
	id: string;
	userId: string;
	user: { id: string; name: string };
};

export const Route = createFileRoute("/committee/notice/$noticeId/")({
	component: RouteComponent,
});

function RouteComponent() {
	const { noticeId } = Route.useParams();
	const navigate = useNavigate();
	const { user } = useAuthStore();

	const [notice, setNotice] = useState<NoticeDetail | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [committeeMembers, setCommitteeMembers] = useState<CommitteeMember[]>(
		[]
	);

	const [editDialogOpen, setEditDialogOpen] = useState(false);
	const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [removingId, setRemovingId] = useState<string | null>(null);

	const fetchNotice = useCallback(async () => {
		setIsLoading(true);
		try {
			const [noticeRes, membersRes] = await Promise.all([
				getNotice(noticeId),
				listCommitteeMembers(),
			]);
			setNotice(noticeRes.notice);
			setCommitteeMembers(membersRes.committeeMembers);
		} catch (error) {
			console.error(error);
		} finally {
			setIsLoading(false);
		}
	}, [noticeId]);

	useEffect(() => {
		fetchNotice();
	}, [fetchNotice]);

	const sanitizedBody = useMemo(
		() => (notice?.body ? sanitizeHtml(notice.body) : null),
		[notice?.body]
	);

	const isOwner = notice?.ownerId === user?.id;
	const isCollaborator =
		notice?.collaborators.some(c => c.user.id === user?.id) ?? false;
	const canEdit = isOwner || isCollaborator;

	const collaboratorUserIds = new Set(
		notice?.collaborators.map(c => c.user.id) ?? []
	);
	const availableMembers = committeeMembers
		.filter(
			m => m.user.id !== notice?.ownerId && !collaboratorUserIds.has(m.user.id)
		)
		.map(m => ({ userId: m.user.id, name: m.user.name }));

	const handleAddCollaborator = async (userId: string) => {
		if (!notice) return;
		try {
			await addCollaborator(notice.id, { userId });
			const res = await getNotice(notice.id);
			setNotice(res.notice);
		} catch (error) {
			console.error(error);
		}
	};

	const handleRemoveCollaborator = async (collaboratorId: string) => {
		if (!notice) return;
		setRemovingId(collaboratorId);
		try {
			await removeCollaborator(notice.id, collaboratorId);
			const res = await getNotice(notice.id);
			setNotice(res.notice);
		} catch (error) {
			console.error(error);
		} finally {
			setRemovingId(null);
		}
	};

	const handleDelete = async () => {
		setIsDeleting(true);
		try {
			await deleteNotice(noticeId);
			navigate({ to: "/committee/notice" });
		} catch (error) {
			console.error(error);
		} finally {
			setIsDeleting(false);
		}
	};

	const handleApprove = async (authorizationId: string) => {
		try {
			await updateNoticeAuthorization(noticeId, authorizationId, {
				status: "APPROVED",
			});
			await fetchNotice();
		} catch (error) {
			console.error(error);
		}
	};

	const handleReject = async (authorizationId: string) => {
		try {
			await updateNoticeAuthorization(noticeId, authorizationId, {
				status: "REJECTED",
			});
			await fetchNotice();
		} catch (error) {
			console.error(error);
		}
	};

	if (isLoading) {
		return (
			<div>
				<Text size="2" color="gray">
					読み込み中...
				</Text>
			</div>
		);
	}

	if (!notice) {
		return (
			<div>
				<Heading size="5">お知らせが見つかりません</Heading>
				<Text as="p" size="2" color="gray">
					指定されたお知らせは存在しないか、削除された可能性があります。
				</Text>
				<button
					type="button"
					className={styles.backLink}
					onClick={() => navigate({ to: "/committee/notice" })}
				>
					<IconArrowLeft size={16} />
					<Text size="2">一覧に戻る</Text>
				</button>
			</div>
		);
	}

	return (
		<div className={styles.layout}>
			{/* メインコンテンツ */}
			<div className={styles.main}>
				<button
					type="button"
					className={styles.backLink}
					onClick={() => navigate({ to: "/committee/notice" })}
				>
					<IconArrowLeft size={16} />
					<Text size="2">お知らせ一覧に戻る</Text>
				</button>

				<header className={styles.titleSection}>
					<NoticeStatusBadge notice={notice} />
					<Heading size="5">{notice.title}</Heading>
					<div className={styles.meta}>
						<span className={styles.metaItem}>
							<IconCalendar size={14} />
							<Text size="2" color="gray">
								作成: {formatDateTime(notice.createdAt)}
							</Text>
						</span>
						<span className={styles.metaItem}>
							<IconClock size={14} />
							<Text size="2" color="gray">
								更新: {formatDateTime(notice.updatedAt)}
							</Text>
						</span>
					</div>
				</header>

				<Separator size="4" />

				{sanitizedBody ? (
					<div
						className={styles.body}
						// お知らせ本文はRichTextEditorで入力されたHTMLをDOMPurifyでサニタイズして表示
						// biome-ignore lint/security/noDangerouslySetInnerHtml: サニタイズ済みHTML
						dangerouslySetInnerHTML={{ __html: sanitizedBody }}
					/>
				) : (
					<Text size="2" color="gray">
						本文なし
					</Text>
				)}
			</div>

			{/* サイドバー */}
			<NoticeDetailSidebar
				notice={notice}
				noticeId={noticeId}
				userId={user?.id ?? ""}
				isOwner={isOwner}
				canEdit={canEdit}
				availableMembers={availableMembers}
				removingId={removingId}
				onAddCollaborator={handleAddCollaborator}
				onRemoveCollaborator={handleRemoveCollaborator}
				onApprove={handleApprove}
				onReject={handleReject}
				onPublishSuccess={fetchNotice}
				onEdit={() => setEditDialogOpen(true)}
				onDelete={() => setDeleteConfirmOpen(true)}
			/>

			{/* 編集ダイアログ */}
			<CreateNoticeDialog
				open={editDialogOpen}
				onOpenChange={setEditDialogOpen}
				noticeId={notice.id}
				initialValues={{ title: notice.title, body: notice.body ?? "" }}
				onSuccess={fetchNotice}
			/>

			{/* 削除確認ダイアログ */}
			<AlertDialog.Root
				open={deleteConfirmOpen}
				onOpenChange={setDeleteConfirmOpen}
			>
				<AlertDialog.Content maxWidth="400px">
					<AlertDialog.Title>お知らせを削除</AlertDialog.Title>
					<AlertDialog.Description size="2">
						このお知らせを削除しますか？この操作は取り消せません。
					</AlertDialog.Description>
					<div className={styles.deleteActions}>
						<AlertDialog.Cancel>
							<Button intent="secondary" size="2">
								キャンセル
							</Button>
						</AlertDialog.Cancel>
						<Button
							intent="danger"
							size="2"
							onClick={handleDelete}
							loading={isDeleting}
						>
							削除する
						</Button>
					</div>
				</AlertDialog.Content>
			</AlertDialog.Root>
		</div>
	);
}

type NoticeStatus = {
	label: string;
	color: BadgeProps["color"];
};

function getNoticeStatus(notice: NoticeDetail): NoticeStatus {
	if (notice.authorizations.length === 0) {
		return { label: "公開申請前", color: "gray" };
	}

	// 最新の承認情報で判定
	const latest = notice.authorizations.reduce((a, b) =>
		a.createdAt > b.createdAt ? a : b
	);

	switch (latest.status) {
		case "PENDING":
			return { label: "承認待機中", color: "orange" };
		case "REJECTED":
			return { label: "却下", color: "red" };
		case "APPROVED": {
			const now = new Date();
			if (latest.deliveredAt > now) {
				return { label: "公開予定", color: "blue" };
			}
			return { label: "公開済み", color: "green" };
		}
	}
}

function NoticeStatusBadge({ notice }: { notice: NoticeDetail }) {
	const status = getNoticeStatus(notice);
	return (
		<div>
			<Badge variant="soft" size="2" color={status.color}>
				{status.label}
			</Badge>
		</div>
	);
}
