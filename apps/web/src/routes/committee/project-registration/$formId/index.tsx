import { AlertDialog, Badge, Heading, Text } from "@radix-ui/themes";
import type {
	ListProjectRegistrationFormResponsesResponse,
	ProjectRegistrationFormDetail,
} from "@sos26/shared";
import { IconArrowLeft, IconCalendar, IconClock } from "@tabler/icons-react";
import {
	createFileRoute,
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
	listProjectRegistrationFormResponses,
	listProjectRegistrationForms,
	removeProjectRegistrationFormCollaborator,
	updateProjectRegistrationFormAuthorization,
} from "@/lib/api/committee-project-registration-form";
import { useAuthStore } from "@/lib/auth";
import { reportHandledError } from "@/lib/error/report";
import {
	type BaseAnswerRow,
	buildAnswerValueMap,
} from "@/lib/form/answer-table";
import { getProjectRegistrationFormStatus } from "@/lib/form/form-status";
import { formatDate } from "@/lib/format";
import {
	PROJECT_LOCATION_LABELS,
	PROJECT_TYPE_LABELS,
} from "@/lib/project/options";
import { FormItemsPreview } from "@/routes/committee/forms/$formId/-components/FormItemsPreview";
import { AnswerDetailDialog } from "./-components/AnswerDetailDialog";
import { EditProjectRegistrationFormDialog } from "./-components/EditProjectRegistrationFormDialog";
import { ProjectRegistrationFormDetailSidebar } from "./-components/ProjectRegistrationFormDetailSidebar";
import styles from "./index.module.scss";

type AnswerRow = BaseAnswerRow & {
	organizationName: string;
};

function buildAnswerRows(
	responses: ListProjectRegistrationFormResponsesResponse["responses"]
): AnswerRow[] {
	return responses.map(r => {
		return {
			id: r.id,
			projectName: r.project.name,
			organizationName: r.project.organizationName,
			submittedAt: r.submittedAt,
			answers: buildAnswerValueMap(r.answers),
		};
	});
}

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
		const [{ form }, { committeeMembers }, { forms: allForms }, responsesRes] =
			await Promise.all([
				getProjectRegistrationFormDetail(params.formId),
				listCommitteeMembers(),
				listProjectRegistrationForms(),
				listProjectRegistrationFormResponses(params.formId).catch(() => ({
					responses: [],
				})),
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
			.map(m => ({
				userId: m.user.id,
				name: m.user.name,
				avatarFileId: m.user.avatarFileId,
			}));
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
			.map(m => ({
				userId: m.user.id,
				name: m.user.name,
				avatarFileId: m.user.avatarFileId,
			}));
		const activeForms = allForms
			.filter(f => f.isActive && f.id !== params.formId)
			.sort((a, b) => a.sortOrder - b.sortOrder)
			.map(f => ({
				id: f.id,
				title: f.title,
				filterTypes: f.filterTypes,
				filterLocations: f.filterLocations,
			}));
		return {
			form,
			canCreate,
			approvers,
			availableMembers,
			activeForms,
			responses: responsesRes.responses,
		};
	},
});

function RouteComponent() {
	const { formId } = Route.useParams();
	const {
		form,
		canCreate,
		approvers,
		availableMembers,
		activeForms,
		responses,
	} = Route.useLoaderData();
	const navigate = useNavigate();
	const router = useRouter();
	const { user } = useAuthStore();

	const [editDialogOpen, setEditDialogOpen] = useState(false);
	const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [removingId, setRemovingId] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState<"content" | "answers">("content");
	const [answerDialogOpen, setAnswerDialogOpen] = useState(false);
	const [selectedResponseId, setSelectedResponseId] = useState<string | null>(
		null
	);

	const isOwner = form.ownerId === user?.id;
	const isWriteCollaborator = form.collaborators.some(
		c => c.user.id === user?.id && c.isWrite
	);
	const canEdit =
		(isOwner || isWriteCollaborator) && canCreate && !form.isActive;
	const canEditAnswers = isOwner || isWriteCollaborator;

	const previewForm = useMemo(() => formDetailToPreviewForm(form), [form]);
	const answerRows = useMemo(() => buildAnswerRows(responses), [responses]);

	if (!user) return null;

	const handleAddCollaborator = async (targetUserId: string) => {
		try {
			await addProjectRegistrationFormCollaborator(formId, targetUserId, {
				isWrite: true,
			});
			await router.invalidate();
			toast.success("共同編集者を追加しました");
		} catch (error) {
			reportHandledError({
				error,
				operation: "collaborator_update",
				userMessage: "共同編集者の追加に失敗しました",
				ui: { type: "toast" },
				context: {
					formId,
					targetUserId,
				},
			});
		}
	};

	const handleRemoveCollaborator = async (targetUserId: string) => {
		setRemovingId(targetUserId);
		try {
			await removeProjectRegistrationFormCollaborator(formId, targetUserId);
			await router.invalidate();
			toast.success("共同編集者を削除しました");
		} catch (error) {
			reportHandledError({
				error,
				operation: "collaborator_update",
				userMessage: "共同編集者の削除に失敗しました",
				ui: { type: "toast" },
				context: {
					formId,
					targetUserId,
				},
			});
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
			toast.success("承認しました。フォームが公開されました。");
		} catch (error) {
			reportHandledError({
				error,
				operation: "approve",
				userMessage: "承認に失敗しました",
				ui: { type: "toast" },
				context: {
					formId,
					authId,
				},
			});
		}
	};

	const handleReject = async (authId: string) => {
		try {
			await updateProjectRegistrationFormAuthorization(formId, authId, {
				status: "REJECTED",
			});
			await router.invalidate();
			toast.success("却下しました");
		} catch (error) {
			reportHandledError({
				error,
				operation: "reject",
				userMessage: "却下に失敗しました",
				ui: { type: "toast" },
				context: {
					formId,
					authId,
				},
			});
		}
	};

	const handleDelete = async () => {
		setIsDeleting(true);
		try {
			await deleteProjectRegistrationForm(formId);
			toast.success("フォームを削除しました");
			navigate({ to: "/committee/project-registration" });
		} catch (error) {
			reportHandledError({
				error,
				operation: "delete",
				userMessage: "フォームの削除に失敗しました",
				ui: { type: "toast" },
				context: {
					formId,
				},
			});
			setIsDeleting(false);
		}
	};

	return (
		<div className={styles.layout}>
			<div className={styles.main}>
				<button
					type="button"
					className={styles.backLink}
					onClick={() => window.history.back()}
				>
					<IconArrowLeft size={16} />
					<Text size="2">企画登録管理に戻る</Text>
				</button>

				<header className={styles.titleSection}>
					<div>
						<FormStatusBadge form={form} />
					</div>
					<Heading size="5">{form.title}</Heading>
					{form.description && (
						<Text size="2" color="gray" className={styles.description}>
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

				<div className={styles.tabs} role="tablist" aria-label="表示切替">
					<button
						type="button"
						role="tab"
						aria-selected={activeTab === "content"}
						data-active={activeTab === "content" || undefined}
						className={styles.tabButton}
						onClick={() => setActiveTab("content")}
					>
						内容
					</button>
					<button
						type="button"
						role="tab"
						aria-selected={activeTab === "answers"}
						data-active={activeTab === "answers" || undefined}
						className={styles.tabButton}
						onClick={() => setActiveTab("answers")}
					>
						回答
						{responses.length > 0 && (
							<span className={styles.tabBadge}>{responses.length}</span>
						)}
					</button>
				</div>

				{activeTab === "answers" ? (
					<section className={styles.answersSection}>
						{answerRows.length === 0 ? (
							<Text size="2" color="gray">
								まだ回答がありません。
							</Text>
						) : (
							<div className={styles.answerTableWrapper}>
								<table className={styles.answerTable}>
									<thead>
										<tr>
											<th>企画名</th>
											<th>団体名</th>
											<th>提出日</th>
											{previewForm.items.map(item => (
												<th key={item.id}>{item.label}</th>
											))}
										</tr>
									</thead>
									<tbody>
										{answerRows.map(row => (
											<tr
												key={row.id}
												className={styles.answerRow}
												onClick={() => {
													setSelectedResponseId(row.id);
													setAnswerDialogOpen(true);
												}}
											>
												<td>{row.projectName}</td>
												<td>{row.organizationName}</td>
												<td>
													{row.submittedAt
														? formatDate(row.submittedAt, "date")
														: "-"}
												</td>
												{previewForm.items.map(item => {
													const v = row.answers[item.id];
													return (
														<td key={item.id}>
															{Array.isArray(v) ? (
																<div className={styles.tags}>
																	{v.map(t => (
																		<Badge
																			key={t.label}
																			color={t.color}
																			size="1"
																		>
																			{t.label}
																		</Badge>
																	))}
																</div>
															) : (
																(v as string)
															)}
														</td>
													);
												})}
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</section>
				) : (
					<FormItemsPreview items={previewForm.items} />
				)}

				<AnswerDetailDialog
					open={answerDialogOpen}
					onOpenChange={setAnswerDialogOpen}
					formId={formId}
					responseId={selectedResponseId}
					form={previewForm}
					canEditAnswers={canEditAnswers}
				/>
			</div>

			<ProjectRegistrationFormDetailSidebar
				form={form}
				userId={user.id}
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
						<AlertDialog.Action>
							<Button
								intent="danger"
								size="2"
								onClick={handleDelete}
								loading={isDeleting}
							>
								削除する
							</Button>
						</AlertDialog.Action>
					</div>
				</AlertDialog.Content>
			</AlertDialog.Root>
		</div>
	);
}

function FormStatusBadge({ form }: { form: ProjectRegistrationFormDetail }) {
	const latestAuth = form.authorizations[0];
	const { label, color } = getProjectRegistrationFormStatus(
		form.isActive,
		latestAuth?.status ?? null
	);
	return (
		<Badge variant="soft" color={color}>
			{label}
		</Badge>
	);
}
