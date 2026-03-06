import { AlertDialog, Badge, Heading, Separator, Text } from "@radix-ui/themes";
import type { ProjectRegistrationFormDetail } from "@sos26/shared";
import {
	IconArrowLeft,
	IconCalendar,
	IconCheck,
	IconClock,
	IconSend,
	IconTrash,
	IconX,
} from "@tabler/icons-react";
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
	deleteProjectRegistrationForm,
	getProjectRegistrationFormDetail,
	updateProjectRegistrationFormAuthorization,
} from "@/lib/api/committee-project-registration-form";
import { useAuthStore } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { FormItemsPreview } from "@/routes/committee/forms/$formId/-components/FormItemsPreview";
import { RequestAuthorizationDialog } from "../-components/RequestAuthorizationDialog";
import { EditProjectRegistrationFormDialog } from "./-components/EditProjectRegistrationFormDialog";
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
		const [{ form }, { committeeMembers }] = await Promise.all([
			getProjectRegistrationFormDetail(params.formId),
			listCommitteeMembers(),
		]);
		const currentUserId = useAuthStore.getState().user?.id;
		const currentMember = committeeMembers.find(
			m => m.user.id === currentUserId
		);
		const canCreate =
			currentMember?.permissions.some(
				p => p.permission === "PROJECT_REGISTRATION_FORM_CREATE"
			) === true;
		const canDeliver =
			currentMember?.permissions.some(
				p => p.permission === "PROJECT_REGISTRATION_FORM_DELIVER"
			) === true;
		const approvers = committeeMembers
			.filter(m =>
				m.permissions.some(
					p => p.permission === "PROJECT_REGISTRATION_FORM_DELIVER"
				)
			)
			.map(m => ({ userId: m.user.id, name: m.user.name }));
		return { form, canCreate, canDeliver, approvers };
	},
});

function RouteComponent() {
	const { formId } = Route.useParams();
	const { form, canCreate, canDeliver, approvers } = Route.useLoaderData();
	const navigate = useNavigate();
	const router = useRouter();
	const { user } = useAuthStore();

	const [editDialogOpen, setEditDialogOpen] = useState(false);
	const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
	const [authRequestOpen, setAuthRequestOpen] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [approvingId, setApprovingId] = useState<string | null>(null);
	const [rejectingId, setRejectingId] = useState<string | null>(null);

	const isOwner = form.ownerId === user?.id;
	const canEdit = isOwner && canCreate;

	const latestAuth = form.authorizations[0] ?? null;
	const isApprover =
		canDeliver &&
		latestAuth?.status === "PENDING" &&
		latestAuth.requestedToId === user?.id;

	const canRequestAuth =
		canEdit && !form.isActive && latestAuth?.status !== "PENDING";

	const previewForm = useMemo(() => formDetailToPreviewForm(form), [form]);

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

	const handleApprove = async (authId: string) => {
		setApprovingId(authId);
		try {
			await updateProjectRegistrationFormAuthorization(formId, authId, {
				status: "APPROVED",
			});
			await router.invalidate();
			toast.success("承認しました。フォームが有効化されました。");
		} catch {
			toast.error("承認に失敗しました");
		} finally {
			setApprovingId(null);
		}
	};

	const handleReject = async (authId: string) => {
		setRejectingId(authId);
		try {
			await updateProjectRegistrationFormAuthorization(formId, authId, {
				status: "REJECTED",
			});
			await router.invalidate();
			toast.success("却下しました");
		} catch {
			toast.error("却下に失敗しました");
		} finally {
			setRejectingId(null);
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

			{/* サイドバー */}
			<div className={styles.sidebarWrapper}>
				<aside className={styles.sidebar}>
					<div className={styles.section}>
						{canEdit && (
							<Button
								intent="secondary"
								size="2"
								onClick={() => setEditDialogOpen(true)}
							>
								編集
							</Button>
						)}
						{canRequestAuth && (
							<Button
								intent="primary"
								size="2"
								onClick={() => setAuthRequestOpen(true)}
							>
								<IconSend size={14} />
								承認申請
							</Button>
						)}
						{canEdit && isOwner && (
							<Button
								intent="ghost"
								size="2"
								onClick={() => setDeleteConfirmOpen(true)}
							>
								<IconTrash size={14} />
								削除
							</Button>
						)}
					</div>

					{latestAuth && (
						<>
							<Separator size="4" />
							<div className={styles.section}>
								<Text size="2" weight="medium" color="gray">
									承認依頼
								</Text>
								{isApprover && (
									<Text size="2" color="orange" weight="medium">
										あなたに承認リクエストが届いています
									</Text>
								)}
								<div className={styles.authRow}>
									<Text size="2" color="gray">
										申請日
									</Text>
									<Text size="2">
										{formatDate(latestAuth.createdAt, "datetime")}
									</Text>
								</div>
								<div className={styles.authRow}>
									<Text size="2" color="gray">
										ステータス
									</Text>
									<AuthStatusBadge status={latestAuth.status} />
								</div>
								{isApprover && latestAuth.status === "PENDING" && (
									<div className={styles.authActions}>
										<Button
											intent="primary"
											size="2"
											onClick={() => handleApprove(latestAuth.id)}
											loading={approvingId === latestAuth.id}
											disabled={rejectingId !== null}
										>
											<IconCheck size={16} />
											承認
										</Button>
										<Button
											intent="secondary"
											size="2"
											onClick={() => handleReject(latestAuth.id)}
											loading={rejectingId === latestAuth.id}
											disabled={approvingId !== null}
										>
											<IconX size={16} />
											却下
										</Button>
									</div>
								)}
							</div>
						</>
					)}
				</aside>
			</div>

			<EditProjectRegistrationFormDialog
				open={editDialogOpen}
				onOpenChange={setEditDialogOpen}
				formId={form.id}
				initialForm={form}
				onSuccess={() => router.invalidate()}
			/>

			<RequestAuthorizationDialog
				open={authRequestOpen}
				onOpenChange={setAuthRequestOpen}
				formId={form.id}
				approvers={approvers}
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
			<Badge variant="soft" color="yellow">
				承認待ち
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

function AuthStatusBadge({ status }: { status: string }) {
	if (status === "PENDING")
		return (
			<Badge variant="soft" color="yellow">
				保留中
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
