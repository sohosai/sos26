import { AlertDialog, Badge, Heading, Separator, Text } from "@radix-ui/themes";
import type { GetFormDetailResponse } from "@sos26/shared";
import { IconArrowLeft, IconCalendar, IconClock } from "@tabler/icons-react";
import {
	createFileRoute,
	useNavigate,
	useRouter,
} from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/primitives";
import {
	addFormCollaborator,
	approveFormAuthorization,
	deleteForm,
	getFormDetail,
	rejectFormAuthorization,
	removeFormCollaborator,
} from "@/lib/api/committee-form";
import { listCommitteeMembers } from "@/lib/api/committee-member";
import { useAuthStore } from "@/lib/auth";
import { formDetailToForm } from "@/lib/form/convert";
import { getFormStatusFromAuth } from "@/lib/form/form-status";
import { formatDate } from "@/lib/format";
import { EditFormDialog } from "./-components/EditFormDialog";
import { FormDetailSidebar } from "./-components/FormDetailSidebar";
import { FormItemsPreview } from "./-components/FormItemsPreview";
import styles from "./index.module.scss";

export const Route = createFileRoute("/committee/forms/$formId/")({
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "フォーム詳細 | 雙峰祭オンラインシステム" }],
	}),
	loader: async ({ params }) => {
		const [formRes, membersRes] = await Promise.all([
			getFormDetail(params.formId),
			listCommitteeMembers(),
		]);
		return {
			form: formRes.form,
			committeeMembers: membersRes.committeeMembers,
		};
	},
});

function RouteComponent() {
	const { formId } = Route.useParams();
	const { form, committeeMembers } = Route.useLoaderData();
	const navigate = useNavigate();
	const router = useRouter();
	const { user } = useAuthStore();

	const [editDialogOpen, setEditDialogOpen] = useState(false);
	const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [removingId, setRemovingId] = useState<string | null>(null);

	const isOwner = form.ownerId === user?.id;
	const isCollaborator = form.collaborators.some(c => c.user.id === user?.id);
	const canEdit = isOwner || isCollaborator;

	const collaboratorUserIds = new Set(form.collaborators.map(c => c.user.id));
	const availableMembers = committeeMembers
		.filter(
			m => m.user.id !== form.ownerId && !collaboratorUserIds.has(m.user.id)
		)
		.map(m => ({ userId: m.user.id, name: m.user.name }));

	const approvers = committeeMembers
		.filter(
			m =>
				m.user.id !== user?.id &&
				m.permissions.some(p => p.permission === "FORM_DELIVER")
		)
		.map(m => ({ userId: m.user.id, name: m.user.name }));

	const previewForm = useMemo(() => formDetailToForm({ form: form }), [form]);

	const handleAddCollaborator = async (userId: string) => {
		try {
			await addFormCollaborator(form.id, userId, { isWrite: true });
			await router.invalidate();
		} catch {
			toast.error("共同編集者の追加に失敗しました");
		}
	};

	const handleRemoveCollaborator = async (userId: string) => {
		setRemovingId(userId);
		try {
			await removeFormCollaborator(form.id, userId);
			await router.invalidate();
		} catch {
			toast.error("共同編集者の削除に失敗しました");
		} finally {
			setRemovingId(null);
		}
	};

	const handleDelete = async () => {
		setIsDeleting(true);
		try {
			await deleteForm(formId);
			navigate({ to: "/committee/forms" });
		} catch {
			toast.error("フォームの削除に失敗しました");
		} finally {
			setIsDeleting(false);
		}
	};

	const handleApprove = async (authorizationId: string) => {
		try {
			await approveFormAuthorization(formId, authorizationId);
			await router.invalidate();
		} catch {
			toast.error("承認に失敗しました");
		}
	};

	const handleReject = async (authorizationId: string) => {
		try {
			await rejectFormAuthorization(formId, authorizationId);
			await router.invalidate();
		} catch {
			toast.error("却下に失敗しました");
		}
	};

	return (
		<div className={styles.layout}>
			<div className={styles.main}>
				<button
					type="button"
					className={styles.backLink}
					onClick={() => navigate({ to: "/committee/forms" })}
				>
					<IconArrowLeft size={16} />
					<Text size="2">フォーム一覧に戻る</Text>
				</button>

				<header className={styles.titleSection}>
					<FormStatusBadge form={form} />
					<Heading size="5">{form.title}</Heading>
					{form.description && (
						<Text size="2" color="gray">
							{form.description}
						</Text>
					)}
					<div className={styles.meta}>
						<span className={styles.metaItem}>
							<IconCalendar size={14} />
							<Text size="2" color="gray">
								作成: {formatDate(form.createdAt, "datetime")}
							</Text>
						</span>
						<span className={styles.metaItem}>
							<IconClock size={14} />
							<Text size="2" color="gray">
								更新: {formatDate(form.updatedAt, "datetime")}
							</Text>
						</span>
					</div>
				</header>

				<Separator size="4" />

				{/* フォーム項目プレビュー */}
				<FormItemsPreview items={previewForm.items} />
			</div>

			<FormDetailSidebar
				form={form}
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
				onPublishSuccess={() => router.invalidate()}
				onEdit={() => setEditDialogOpen(true)}
				onDelete={() => setDeleteConfirmOpen(true)}
			/>

			{/* 編集ダイアログ */}
			<EditFormDialog
				open={editDialogOpen}
				onOpenChange={setEditDialogOpen}
				formId={form.id}
				initialValues={formDetailToForm({ form: form })}
				onSuccess={() => router.invalidate()}
			/>

			{/* 削除確認ダイアログ */}
			<AlertDialog.Root
				open={deleteConfirmOpen}
				onOpenChange={setDeleteConfirmOpen}
			>
				<AlertDialog.Content maxWidth="400px">
					<AlertDialog.Title>フォームを削除</AlertDialog.Title>
					<AlertDialog.Description size="2">
						このフォームを削除しますか？この操作は取り消せません。
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

function FormStatusBadge({ form }: { form: GetFormDetailResponse["form"] }) {
	const latestAuth = form.authorizationDetail;

	const status = getFormStatusFromAuth(
		latestAuth
			? {
					status: latestAuth.status,
					deliveredAt: latestAuth.scheduledSendAt,
					allowLateResponse: latestAuth.allowLateResponse,
					deadlineAt: latestAuth.deadlineAt,
				}
			: null
	);

	return (
		<div>
			<Badge variant="soft" size="2" color={status.color}>
				{status.label}
			</Badge>
		</div>
	);
}
