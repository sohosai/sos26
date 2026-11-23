import { AlertDialog, Badge, Heading, Separator, Text } from "@radix-ui/themes";
import type {
	GetNoticeResponse,
	UpdateNoticeAuthorizationResponse,
} from "@sos26/shared";
import {
	IconArrowLeft,
	IconCalendar,
	IconClock,
	IconPaperclip,
} from "@tabler/icons-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AttachmentPreviewButton } from "@/components/filePreview/AttachmentPreviewButton";
import { Button } from "@/components/primitives";
import {
	addCollaborator,
	deleteNotice,
	getNotice,
	removeCollaborator,
	updateNoticeAuthorization,
} from "@/lib/api/committee-notice";
import { useAuthStore } from "@/lib/auth";
import { reportHandledError } from "@/lib/error/report";
import { formatDate } from "@/lib/format";
import { getNoticeStatusFromAuth } from "@/lib/notice-status";
import { queryClient } from "@/lib/query/client";
import { committeeMembersPickerQuery } from "@/lib/query/committee";
import { sanitizeHtml } from "@/lib/sanitize";
import { CreateNoticeDialog } from "../-components/CreateNoticeDialog";
import { NoticeDetailSidebar } from "./-components/NoticeDetailSidebar";
import styles from "./index.module.scss";

type NoticeDetail = GetNoticeResponse["notice"];

export const Route = createFileRoute("/committee/notice/$noticeId/")({
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "お知らせ詳細 | 雙峰祭オンラインシステム" }],
	}),
	// 操作の結果は画面の state にだけ反映するので、ページを離れたら loader のデータを捨て、開き直したときに古い表示を出さない
	gcTime: 0,
	// パラメータが変わったら作り直し、前の詳細を待っていた応答を移った先の画面に入れない
	remountDeps: ({ params }) => params,
	loader: async ({ params }) => {
		const [noticeRes, membersRes] = await Promise.all([
			getNotice(params.noticeId),
			queryClient.fetchQuery(committeeMembersPickerQuery),
		]);
		return {
			notice: noticeRes.notice,
			committeeMembers: membersRes.committeeMembers,
		};
	},
});

function RouteComponent() {
	const { noticeId } = Route.useParams();
	const { notice: loadedNotice, committeeMembers } = Route.useLoaderData();
	const navigate = useNavigate();
	const { user } = useAuthStore();
	const [notice, setNotice] = useState(loadedNotice);
	const latestRefetchIdRef = useRef(0);

	// 別のお知らせに移ったら、取得中の再取得の応答を捨てる
	useEffect(() => {
		latestRefetchIdRef.current += 1;
		setNotice(loadedNotice);
	}, [loadedNotice]);

	const [editDialogOpen, setEditDialogOpen] = useState(false);
	const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [removingId, setRemovingId] = useState<string | null>(null);

	const sanitizedBody = useMemo(
		() => (notice.body ? sanitizeHtml(notice.body) : null),
		[notice.body]
	);

	const isOwner = notice.ownerId === user?.id;
	const isCollaborator = notice.collaborators.some(c => c.user.id === user?.id);
	const canEdit = isOwner || isCollaborator;

	const collaboratorUserIds = new Set(notice.collaborators.map(c => c.user.id));
	const availableMembers = committeeMembers
		.filter(
			m => m.user.id !== notice.ownerId && !collaboratorUserIds.has(m.user.id)
		)
		.map(m => ({
			userId: m.user.id,
			name: m.user.name,
			avatarFileId: m.user.avatarFileId,
		}));

	const approvers = committeeMembers
		.filter(m => m.permissions.some(p => p.permission === "NOTICE_DELIVER"))
		.map(m => ({
			userId: m.user.id,
			name: m.user.name,
			avatarFileId: m.user.avatarFileId,
		}));

	// 応答で差し替えるときも番号を進め、その前に出ていた再取得の応答で差し替えを戻さない
	const updateNoticeLocally = (
		update: (prev: typeof notice) => typeof notice
	) => {
		latestRefetchIdRef.current += 1;
		setNotice(update);
	};

	// 応答は最後に出した再取得の分だけ反映する。続けて操作したときに古い応答で上書きしないため
	const refetchNotice = async () => {
		latestRefetchIdRef.current += 1;
		const refetchId = latestRefetchIdRef.current;
		try {
			const res = await getNotice(noticeId);
			if (refetchId === latestRefetchIdRef.current) setNotice(res.notice);
		} catch (error) {
			if (refetchId !== latestRefetchIdRef.current) return;
			reportHandledError({
				error,
				operation: "read",
				userMessage: "お知らせの最新の状態を取得できませんでした",
				ui: { type: "toast" },
				context: { noticeId },
			});
		}
	};

	const handleAddCollaborator = async (userId: string) => {
		try {
			const res = await addCollaborator(notice.id, { userId });
			updateNoticeLocally(prev => ({
				...prev,
				collaborators: [...prev.collaborators, res.collaborator],
			}));
		} catch {
			toast.error("共同編集者の追加に失敗しました");
		}
	};

	const handleRemoveCollaborator = async (collaboratorId: string) => {
		setRemovingId(collaboratorId);
		try {
			await removeCollaborator(notice.id, collaboratorId);
			updateNoticeLocally(prev => ({
				...prev,
				collaborators: prev.collaborators.filter(c => c.id !== collaboratorId),
			}));
		} catch {
			toast.error("共同編集者の削除に失敗しました");
		} finally {
			setRemovingId(null);
		}
	};

	const handleDelete = async () => {
		setIsDeleting(true);
		try {
			await deleteNotice(noticeId);
			navigate({ to: "/committee/notice" });
		} catch {
			toast.error("お知らせの削除に失敗しました");
		} finally {
			setIsDeleting(false);
		}
	};

	// 承認では配信先が作られることがあり、応答に含まれないので詳細を取り直す
	const handleApprove = async (authorizationId: string) => {
		try {
			await updateNoticeAuthorization(noticeId, authorizationId, {
				status: "APPROVED",
			});
		} catch {
			toast.error("承認に失敗しました");
			return;
		}
		await refetchNotice();
	};

	const applyAuthorization = (
		authorization: UpdateNoticeAuthorizationResponse["authorization"]
	) => {
		updateNoticeLocally(prev => ({
			...prev,
			authorizations: prev.authorizations.map(a =>
				a.id === authorization.id ? { ...a, ...authorization } : a
			),
		}));
	};

	const handleReject = async (authorizationId: string) => {
		try {
			const res = await updateNoticeAuthorization(noticeId, authorizationId, {
				status: "REJECTED",
			});
			applyAuthorization(res.authorization);
		} catch {
			toast.error("却下に失敗しました");
		}
	};

	const handleCancelApproval = async (authorizationId: string) => {
		try {
			const res = await updateNoticeAuthorization(noticeId, authorizationId, {
				status: "REJECTED",
			});
			applyAuthorization(res.authorization);
			toast.success("承認を取り消しました");
		} catch {
			toast.error("承認の取り消しに失敗しました");
		}
	};

	return (
		<div className={styles.layout}>
			{/* メインコンテンツ */}
			<div className={styles.main}>
				<button
					type="button"
					className={styles.backLink}
					onClick={() => window.history.back()}
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
								作成: {formatDate(notice.createdAt, "datetime")}
							</Text>
						</span>
						<span className={styles.metaItem}>
							<IconClock size={14} />
							<Text size="2" color="gray">
								更新: {formatDate(notice.updatedAt, "datetime")}
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

				{notice.attachments.length > 0 && (
					<div className={styles.attachmentSection}>
						<Text size="2" weight="medium" color="gray">
							<IconPaperclip size={14} style={{ verticalAlign: "middle" }} />{" "}
							添付ファイル
						</Text>
						<div className={styles.attachmentList}>
							{notice.attachments.map(att => (
								<AttachmentPreviewButton key={att.id} attachment={att} />
							))}
						</div>
					</div>
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
				approvers={approvers}
				removingId={removingId}
				onAddCollaborator={handleAddCollaborator}
				onRemoveCollaborator={handleRemoveCollaborator}
				onApprove={handleApprove}
				onReject={handleReject}
				onCancelApproval={handleCancelApproval}
				onPublishSuccess={refetchNotice}
				onEdit={() => setEditDialogOpen(true)}
				onDelete={() => setDeleteConfirmOpen(true)}
			/>

			{/* 編集ダイアログ */}
			<CreateNoticeDialog
				open={editDialogOpen}
				onOpenChange={setEditDialogOpen}
				noticeId={notice.id}
				initialValues={{ title: notice.title, body: notice.body ?? "" }}
				initialAttachments={notice.attachments}
				onSuccess={refetchNotice}
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

function NoticeStatusBadge({ notice }: { notice: NoticeDetail }) {
	const latestAuth =
		notice.authorizations.length > 0
			? notice.authorizations.reduce((a, b) =>
					a.createdAt > b.createdAt ? a : b
				)
			: null;
	const status = getNoticeStatusFromAuth(latestAuth);
	return (
		<div>
			<Badge variant="soft" size="2" color={status.color}>
				{status.label}
			</Badge>
		</div>
	);
}
