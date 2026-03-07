import { AlertDialog, Badge, Heading, Separator, Text } from "@radix-ui/themes";
import type { ProjectRegistrationFormDetail } from "@sos26/shared";
import { IconArrowLeft, IconCalendar, IconClock } from "@tabler/icons-react";
import {
	createFileRoute,
	Link,
	useNavigate,
	useRouter,
} from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { Form } from "@/components/form/type";
import { Button } from "@/components/primitives";
import { listCommitteeMembers } from "@/lib/api/committee-member";
import {
	addProjectRegistrationFormCollaborator,
	deleteProjectRegistrationForm,
	getProjectRegistrationFormDetail,
	listProjectRegistrationForms,
	removeProjectRegistrationFormCollaborator,
	updateProjectRegistrationFormAuthorization,
} from "@/lib/api/committee-project-registration-form";
import { useAuthStore } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { FormItemsPreview } from "@/routes/committee/forms/$formId/-components/FormItemsPreview";
import { EditProjectRegistrationFormDialog } from "./-components/EditProjectRegistrationFormDialog";
import { ProjectRegistrationFormDetailSidebar } from "./-components/ProjectRegistrationFormDetailSidebar";
import styles from "./index.module.scss";

const PROJECT_TYPE_LABELS: Record<string, string> = {
	NORMAL: "通常",
	FOOD: "食品",
	STAGE: "ステージ",
};

const PROJECT_LOCATION_LABELS: Record<string, string> = {
	INDOOR: "屋内",
	OUTDOOR: "屋外",
	STAGE: "ステージ",
};

function formDetailToPreviewForm(form: ProjectRegistrationFormDetail): Form {
	return {
		id: form.id,
		name: form.title,
		description: form.description ?? undefined,
		items: [...form.items]
			.sort((a, b) => a.sortOrder - b.sortOrder)
			.map(item => ({
				id: item.id,
				label: item.label,
				description: item.description ?? undefined,
				type: item.type,
				required: item.required,
				options: [...item.options]
					.sort((a, b) => a.sortOrder - b.sortOrder)
					.map(opt => ({ id: opt.id, label: opt.label })),
			})),
	};
}

export const Route = createFileRoute(
	"/committee/project-registration/$formId/"
)({
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "企画登録フォーム詳細 | 雙峰祭オンラインシステム" }],
	}),
	loader: async ({ params }) => {
		const [{ form }, { committeeMembers }, { forms: allForms }] =
			await Promise.all([
				getProjectRegistrationFormDetail(params.formId),
				listCommitteeMembers(),
				listProjectRegistrationForms(),
			]);
		const currentUserId = useAuthStore.getState().user?.id;
		const currentMember = committeeMembers.find(
			m => m.user.id === currentUserId
		);
		const canCreate =
			currentMember?.permissions.some(
				p => p.permission === "PROJECT_REGISTRATION_FORM_CREATE"
			) === true;
		const approvers = committeeMembers
			.filter(m =>
				m.permissions.some(
					p => p.permission === "PROJECT_REGISTRATION_FORM_DELIVER"
				)
			)
			.map(m => ({ userId: m.user.id, name: m.user.name }));
		const existingCollaboratorIds = new Set(
			form.collaborators.map(c => c.user.id)
		);
		const availableMembers = committeeMembers
			.filter(
				m =>
					m.user.id !== form.ownerId &&
					!existingCollaboratorIds.has(m.user.id) &&
					m.permissions.some(
						p => p.permission === "PROJECT_REGISTRATION_FORM_CREATE"
					)
			)
			.map(m => ({ userId: m.user.id, name: m.user.name }));
		const activeForms = allForms
			.filter(f => f.isActive && f.id !== params.formId)
			.sort((a, b) => a.sortOrder - b.sortOrder)
			.map(f => ({
				id: f.id,
				title: f.title,
				filterTypes: f.filterTypes,
				filterLocations: f.filterLocations,
			}));
		return { form, canCreate, approvers, availableMembers, activeForms };
	},
});

function RouteComponent() {
	const { formId } = Route.useParams();
	const { form, canCreate, approvers, availableMembers, activeForms } =
		Route.useLoaderData();
	const navigate = useNavigate();
	const router = useRouter();
	const { user } = useAuthStore();

	const [editDialogOpen, setEditDialogOpen] = useState(false);
	const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [removingId, setRemovingId] = useState<string | null>(null);

	const isOwner = form.ownerId === user?.id;
	const isWriteCollaborator = form.collaborators.some(
		c => c.user.id === user?.id && c.isWrite
	);
	const canEdit =
		(isOwner || isWriteCollaborator) && canCreate && !form.isActive;

	const previewForm = useMemo(() => formDetailToPreviewForm(form), [form]);

	const handleAddCollaborator = async (targetUserId: string) => {
		try {
			await addProjectRegistrationFormCollaborator(formId, targetUserId, {
				isWrite: true,
			});
			await router.invalidate();
			toast.success("共同編集者を追加しました");
		} catch {
			toast.error("共同編集者の追加に失敗しました");
		}
	};

	const handleRemoveCollaborator = async (targetUserId: string) => {
		setRemovingId(targetUserId);
		try {
			await removeProjectRegistrationFormCollaborator(formId, targetUserId);
			await router.invalidate();
			toast.success("共同編集者を削除しました");
		} catch {
			toast.error("共同編集者の削除に失敗しました");
		} finally {
			setRemovingId(null);
		}
	};

	const handleApprove = async (authId: string) => {
		try {
			await updateProjectRegistrationFormAuthorization(formId, authId, {
				status: "APPROVED",
			});
			await router.invalidate();
			toast.success("承認しました。フォームが有効化されました。");
		} catch {
			toast.error("承認に失敗しました");
		}
	};

	const handleReject = async (authId: string) => {
		try {
			await updateProjectRegistrationFormAuthorization(formId, authId, {
				status: "REJECTED",
			});
			await router.invalidate();
			toast.success("却下しました");
		} catch {
			toast.error("却下に失敗しました");
		}
	};

	const handleDelete = async () => {
		setIsDeleting(true);
		try {
			await deleteProjectRegistrationForm(formId);
			navigate({ to: "/committee/project-registration" });
		} catch {
			toast.error("フォームの削除に失敗しました");
		} finally {
			setIsDeleting(false);
		}
	};

	return (
		<div className={styles.layout}>
			<div className={styles.main}>
				<Link to="/committee/project-registration" className={styles.backLink}>
					<IconArrowLeft size={16} />
					<Text size="2">企画登録管理に戻る</Text>
				</Link>

				<header className={styles.titleSection}>
					<div>
						<FormStatusBadge form={form} />
					</div>
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
					<div className={styles.filterBadges}>
						{form.filterTypes.length === 0 ? (
							<Badge variant="soft" color="gray" size="1">
								全区分
							</Badge>
						) : (
							form.filterTypes.map(t => (
								<Badge key={t} variant="soft" size="1">
									{PROJECT_TYPE_LABELS[t] ?? t}
								</Badge>
							))
						)}
						{form.filterLocations.length === 0 ? (
							<Badge variant="soft" color="gray" size="1">
								全場所
							</Badge>
						) : (
							form.filterLocations.map(l => (
								<Badge key={l} variant="soft" color="blue" size="1">
									{PROJECT_LOCATION_LABELS[l] ?? l}
								</Badge>
							))
						)}
						<Badge variant="soft" color="gray" size="1">
							表示順: {form.sortOrder}
						</Badge>
					</div>
				</header>

				<Separator size="4" />

				<FormItemsPreview items={previewForm.items} />
			</div>

			<ProjectRegistrationFormDetailSidebar
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
				onAuthRequestSuccess={() => router.invalidate()}
				onEdit={() => setEditDialogOpen(true)}
				onDelete={() => setDeleteConfirmOpen(true)}
			/>

			<EditProjectRegistrationFormDialog
				open={editDialogOpen}
				onOpenChange={setEditDialogOpen}
				formId={form.id}
				initialForm={form}
				activeForms={activeForms}
				onSuccess={() => router.invalidate()}
			/>

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

function FormStatusBadge({ form }: { form: ProjectRegistrationFormDetail }) {
	if (form.isActive)
		return (
			<Badge variant="soft" color="green">
				有効
			</Badge>
		);
	const latestAuth = form.authorizations[0];
	if (latestAuth?.status === "PENDING")
		return (
			<Badge variant="soft" color="orange">
				承認待機中
			</Badge>
		);
	if (latestAuth?.status === "REJECTED")
		return (
			<Badge variant="soft" color="red">
				却下
			</Badge>
		);
	return (
		<Badge variant="soft" color="gray">
			下書き
		</Badge>
	);
}
