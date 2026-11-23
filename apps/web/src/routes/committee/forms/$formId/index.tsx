import { AlertDialog, Badge, Heading, Text } from "@radix-ui/themes";
import type {
	GetFormDetailResponse,
	ListFormResponsesResponse,
} from "@sos26/shared";
import {
	IconArrowLeft,
	IconCalendar,
	IconClock,
	IconDownload,
	IconEye,
} from "@tabler/icons-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { useMemo, useRef, useState } from "react";
import { z } from "zod";
import { AttachmentPreviewButton } from "@/components/filePreview/AttachmentPreviewButton";
import { AnswerDetailDialog } from "@/components/form/Answer/AnswerDetailDialog";
import { DataTable, DateCell, NameCell } from "@/components/patterns";
import { Button } from "@/components/primitives";
import {
	addFormCollaborator,
	approveFormAuthorization,
	deleteForm,
	downloadFormResponseFilesZip,
	editFormAnswer,
	getFormDetail,
	getFormResponse,
	listFormResponses,
	rejectFormAuthorization,
	removeFormCollaborator,
	updateFormViewers,
} from "@/lib/api/committee-form";
import { listCommitteeMembersPicker } from "@/lib/api/committee-member";
import { useAuthStore } from "@/lib/auth";
import { reportHandledError } from "@/lib/error/report";
import {
	type BaseAnswerRow,
	buildAnswerValueMap,
} from "@/lib/form/answer-table";
import { formDetailToForm } from "@/lib/form/convert";
import { getFormStatusFromAuth } from "@/lib/form/form-status";
import { useLazyResponses } from "@/lib/form/use-lazy-responses";
import { formatDate, formatProjectNumber } from "@/lib/format";
import { EditFormDialog } from "./-components/EditFormDialog";
import { FormDetailSidebar } from "./-components/FormDetailSidebar";
import { FormItemsPreview } from "./-components/FormItemsPreview";
import styles from "./index.module.scss";

/* ─── 検索パラメータ ─── */

const searchSchema = z.object({
	tab: z.enum(["content", "answers"]).optional().default("content"),
});

/* ─── 回答テーブル用の型 ─── */

type AnswerRow = BaseAnswerRow & {
	projectNumber: number;
};

function buildAnswerRows(
	responses: ListFormResponsesResponse["responses"]
): AnswerRow[] {
	return responses.map(r => {
		return {
			id: r.id,
			projectNumber: r.project.number,
			projectName: r.project.name,
			submittedAt: r.submittedAt,
			answers: buildAnswerValueMap(r.answers),
		};
	});
}

/* ─── Route ─── */

export const Route = createFileRoute("/committee/forms/$formId/")({
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "申請詳細 | 雙峰祭オンラインシステム" }],
	}),
	validateSearch: searchSchema,
	// 操作の結果は画面の state にだけ反映するので、ページを離れたら loader のデータを捨て、開き直したときに古い表示を出さない
	gcTime: 0,
	// パラメータが変わったら作り直し、前の詳細を待っていた応答を移った先の画面に入れない
	remountDeps: ({ params }) => params,
	// タブの切り替えは search だけが変わるので、loader を取り直さない。開き直したときは gcTime: 0 で取り直す
	staleTime: Number.POSITIVE_INFINITY,
	loader: async ({ params }) => {
		const [formRes, membersRes] = await Promise.all([
			getFormDetail(params.formId),
			listCommitteeMembersPicker(),
		]);
		return {
			form: formRes.form,
			committeeMembers: membersRes.committeeMembers,
		};
	},
});

type TabName = "content" | "answers";

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: 1画面で申請の編集・共同編集者・閲覧者・承認・回答を扱うページのため
function RouteComponent() {
	const { formId } = Route.useParams();
	const { form: loadedForm, committeeMembers } = Route.useLoaderData();
	const { tab } = Route.useSearch();
	const navigate = useNavigate();
	const { user } = useAuthStore();

	// 操作の結果を loader の再実行なしで反映するため、手元で持つ
	const [form, setForm] = useState(loadedForm);
	const [loadedFrom, setLoadedFrom] = useState(loadedForm);
	if (loadedFrom !== loadedForm) {
		setLoadedFrom(loadedForm);
		setForm(loadedForm);
	}
	const latestDetailRequestIdRef = useRef(0);

	const [editDialogOpen, setEditDialogOpen] = useState(false);
	const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [removingId, setRemovingId] = useState<string | null>(null);

	// 回答詳細ダイアログ
	const [answerDialogResponseId, setAnswerDialogResponseId] = useState<
		string | null
	>(null);

	const isOwner = form.ownerId === user?.id;
	const isCollaborator = form.collaborators.some(c => c.user.id === user?.id);
	const canEdit = isOwner || isCollaborator;
	const canEditAnswers =
		isOwner ||
		form.collaborators.some(c => c.user.id === user?.id && c.isWrite);

	const currentMember = committeeMembers.find(m => m.user.id === user?.id);
	const isViewer = form.viewers.some(v => {
		if (v.scope === "ALL") return true;
		if (v.scope === "BUREAU" && currentMember)
			return v.bureauValue === currentMember.Bureau;
		if (v.scope === "INDIVIDUAL") return v.user?.id === user?.id;
		return false;
	});

	const collaboratorUserIds = new Set(form.collaborators.map(c => c.user.id));
	const availableMembers = committeeMembers
		.filter(
			m => m.user.id !== form.ownerId && !collaboratorUserIds.has(m.user.id)
		)
		.map(m => ({
			userId: m.user.id,
			name: m.user.name,
			avatarFileId: m.user.avatarFileId,
		}));

	const approvers = committeeMembers
		.filter(m => m.permissions.some(p => p.permission === "FORM_DELIVER"))
		.map(m => ({
			userId: m.user.id,
			name: m.user.name,
			avatarFileId: m.user.avatarFileId,
		}));

	const previewForm = useMemo(() => formDetailToForm({ form: form }), [form]);

	// ステータス判定
	const latestAuth = form.authorizationDetail;
	const statusInfo = getFormStatusFromAuth(
		latestAuth
			? {
					status: latestAuth.status,
					deliveredAt: latestAuth.scheduledSendAt,
					deadlineAt: latestAuth.deadlineAt,
				}
			: null
	);
	const canViewAnswers =
		(canEdit || isViewer) &&
		(statusInfo.code === "PUBLISHED" || statusInfo.code === "EXPIRED");

	const activeTab: TabName =
		tab === "answers" && canViewAnswers ? "answers" : "content";

	// 回答データ
	const {
		responses,
		error: responsesError,
		reload: reloadResponses,
	} = useLazyResponses(formId, activeTab === "answers", listFormResponses);
	const answerRows = useMemo(
		() => (responses ? buildAnswerRows(responses) : null),
		[responses]
	);

	const setActiveTab = (t: TabName) => {
		navigate({
			to: "/committee/forms/$formId",
			params: { formId },
			search: { tab: t },
			replace: true,
		});
	};

	// 応答で差し替えるときも番号を進め、その前に出ていた取り直しの応答で差し替えを戻さない
	const updateFormLocally = (update: (prev: typeof form) => typeof form) => {
		latestDetailRequestIdRef.current += 1;
		setForm(update);
	};

	// 応答に画面で使う形の詳細が含まれない操作のあとに、詳細だけを取り直す
	const reloadForm = async () => {
		latestDetailRequestIdRef.current += 1;
		const requestId = latestDetailRequestIdRef.current;
		try {
			const res = await getFormDetail(formId);
			// 続けて取り直したときの古い応答や、別の申請へ移る前の応答では上書きしない
			if (requestId !== latestDetailRequestIdRef.current) return;
			setForm(prev => (prev.id === res.form.id ? res.form : prev));
		} catch (error) {
			reportHandledError({
				error,
				operation: "read",
				userMessage: "申請の再取得に失敗しました",
				ui: { type: "toast" },
				context: { formId },
			});
		}
	};

	const handleAddCollaborator = async (userId: string) => {
		try {
			await addFormCollaborator(form.id, userId, { isWrite: true });
			await reloadForm();
		} catch (error) {
			reportHandledError({
				error,
				operation: "collaborator_update",
				userMessage: "共同編集者の追加に失敗しました",
				ui: { type: "toast" },
				context: {
					formId: form.id,
					userId,
				},
			});
		}
	};

	const handleRemoveCollaborator = async (userId: string) => {
		setRemovingId(userId);
		try {
			await removeFormCollaborator(form.id, userId);
			updateFormLocally(prev => ({
				...prev,
				collaborators: prev.collaborators.filter(c => c.user.id !== userId),
			}));
		} catch (error) {
			reportHandledError({
				error,
				operation: "collaborator_update",
				userMessage: "共同編集者の削除に失敗しました",
				ui: { type: "toast" },
				context: {
					formId: form.id,
					userId,
				},
			});
		} finally {
			setRemovingId(null);
		}
	};

	const handleUpdateViewers = async (
		viewers: { scope: string; bureauValue?: string; userId?: string }[]
	) => {
		try {
			const res = await updateFormViewers(form.id, {
				viewers: viewers as Parameters<typeof updateFormViewers>[1]["viewers"],
			});
			updateFormLocally(prev => ({ ...prev, viewers: res.viewers }));
		} catch (error) {
			reportHandledError({
				error,
				operation: "save",
				userMessage: "閲覧者の更新に失敗しました",
				ui: { type: "toast" },
				context: {
					formId: form.id,
					viewerCount: viewers.length,
				},
			});
		}
	};

	const handleDelete = async () => {
		setIsDeleting(true);
		try {
			await deleteForm(formId);
			navigate({ to: "/committee/forms" });
		} catch (error) {
			reportHandledError({
				error,
				operation: "delete",
				userMessage: "申請の削除に失敗しました",
				ui: { type: "toast" },
				context: {
					formId,
				},
			});
		} finally {
			setIsDeleting(false);
		}
	};

	const handleApprove = async (authorizationId: string) => {
		try {
			await approveFormAuthorization(formId, authorizationId);
			await reloadForm();
		} catch (error) {
			reportHandledError({
				error,
				operation: "approve",
				userMessage: "承認に失敗しました",
				ui: { type: "toast" },
				context: {
					formId,
					authorizationId,
				},
			});
		}
	};

	const handleReject = async (authorizationId: string) => {
		try {
			await rejectFormAuthorization(formId, authorizationId);
			await reloadForm();
		} catch (error) {
			reportHandledError({
				error,
				operation: "reject",
				userMessage: "却下に失敗しました",
				ui: { type: "toast" },
				context: {
					formId,
					authorizationId,
				},
			});
		}
	};

	const handleCancelApproval = async (authorizationId: string) => {
		try {
			await rejectFormAuthorization(formId, authorizationId);
			await reloadForm();
		} catch (error) {
			reportHandledError({
				error,
				operation: "cancel_approval",
				userMessage: "承認の取り消しに失敗しました",
				ui: { type: "toast" },
				context: {
					formId,
					authorizationId,
				},
			});
		}
	};

	const formDetailSidebar = (
		<FormDetailSidebar
			form={form}
			userId={user?.id ?? ""}
			isOwner={isOwner}
			canEdit={canEdit}
			isViewer={isViewer}
			availableMembers={availableMembers}
			approvers={approvers}
			committeeMembers={committeeMembers.map(m => ({
				id: m.user.id,
				name: m.user.name,
				avatarFileId: m.user.avatarFileId,
			}))}
			removingId={removingId}
			onAddCollaborator={handleAddCollaborator}
			onRemoveCollaborator={handleRemoveCollaborator}
			onApprove={handleApprove}
			onReject={handleReject}
			onCancelApproval={handleCancelApproval}
			onUpdateViewers={handleUpdateViewers}
			onPublishSuccess={reloadForm}
			onEdit={() => setEditDialogOpen(true)}
			onDelete={() => setDeleteConfirmOpen(true)}
		/>
	);

	return (
		<div className={styles.layout}>
			<div className={styles.main}>
				<button
					type="button"
					className={styles.backLink}
					onClick={() => window.history.back()}
				>
					<IconArrowLeft size={16} />
					<Text size="2">申請一覧に戻る</Text>
				</button>

				<header className={styles.titleSection}>
					<FormStatusBadge form={form} />
					<Heading size="5">{form.title}</Heading>
					{form.description && (
						<Text size="2" color="gray" className={styles.description}>
							{form.description}
						</Text>
					)}
				</header>

				{/* タブ */}
				<nav className={styles.tabs} aria-label="申請詳細タブ">
					<button
						type="button"
						className={`${styles.tab} ${activeTab === "content" ? styles.tabActive : ""}`}
						onClick={() => setActiveTab("content")}
					>
						内容
					</button>
					{canViewAnswers && (
						<button
							type="button"
							className={`${styles.tab} ${activeTab === "answers" ? styles.tabActive : ""}`}
							onClick={() => setActiveTab("answers")}
						>
							回答
							{!!form.responseCount && (
								<span className={styles.tabBadge}>{form.responseCount}</span>
							)}
						</button>
					)}
				</nav>

				{/* タブコンテンツ */}
				{activeTab === "content" ? (
					<div className={styles.contentLayout}>
						<ContentTab form={form} previewForm={previewForm} />
						{formDetailSidebar}
					</div>
				) : (
					<AnswersTab
						formId={form.id}
						formTitle={form.title}
						items={form.items}
						rows={answerRows}
						error={responsesError}
						onViewDetail={setAnswerDialogResponseId}
					/>
				)}
			</div>

			{/* 編集ダイアログ */}
			<EditFormDialog
				open={editDialogOpen}
				onOpenChange={setEditDialogOpen}
				formId={form.id}
				initialValues={previewForm}
				onSuccess={reloadForm}
			/>

			{/* 削除確認ダイアログ */}
			<AlertDialog.Root
				open={deleteConfirmOpen}
				onOpenChange={setDeleteConfirmOpen}
			>
				<AlertDialog.Content maxWidth="400px">
					<AlertDialog.Title>申請を削除</AlertDialog.Title>
					<AlertDialog.Description size="2">
						この申請を削除しますか？この操作は取り消せません。
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

			{/* 回答詳細ダイアログ */}
			<AnswerDetailDialog
				open={answerDialogResponseId !== null}
				onOpenChange={open => {
					if (!open) setAnswerDialogResponseId(null);
				}}
				formId={formId}
				responseId={answerDialogResponseId}
				form={previewForm}
				canEditAnswers={canEditAnswers}
				fetchResponse={getFormResponse}
				onSave={async (...args: Parameters<typeof editFormAnswer>) => {
					const res = await editFormAnswer(...args);
					reloadResponses();
					return res;
				}}
			/>
		</div>
	);
}

/* ─── 内容タブ ─── */

function ContentTab({
	form,
	previewForm,
}: {
	form: GetFormDetailResponse["form"];
	previewForm: ReturnType<typeof formDetailToForm>;
}) {
	return (
		<div className={styles.tabContent}>
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
			{form.attachments.length > 0 && (
				<div className={styles.attachmentSection}>
					<Text size="2" weight="medium" color="gray">
						添付ファイル
					</Text>
					<div className={styles.attachmentList}>
						{form.attachments.map(attachment => (
							<AttachmentPreviewButton
								key={attachment.id}
								attachment={attachment}
							/>
						))}
					</div>
				</div>
			)}
			<FormItemsPreview items={previewForm.items} />
		</div>
	);
}

/* ─── 回答タブ ─── */

function AnswersTab({
	formId,
	formTitle,
	items,
	rows,
	error,
	onViewDetail,
}: {
	formId: string;
	formTitle: string;
	items: GetFormDetailResponse["form"]["items"];
	rows: AnswerRow[] | null;
	error: string | null;
	onViewDetail: (responseId: string) => void;
}) {
	const [isDownloading, setIsDownloading] = useState(false);
	const columnHelper = createColumnHelper<AnswerRow>();
	const hasFileItems = items.some(item => item.type === "FILE");

	const columns = [
		columnHelper.display({
			id: "actions",
			header: "操作",
			cell: ({ row }) => (
				<Button
					intent="ghost"
					size="1"
					onClick={() => onViewDetail(row.original.id)}
				>
					<IconEye size={16} />
					詳細
				</Button>
			),
		}),
		columnHelper.accessor("projectNumber", {
			header: "企画番号",
			cell: ctx => <Text size="2">{formatProjectNumber(ctx.getValue())}</Text>,
		}),
		columnHelper.accessor("projectName", {
			header: "企画",
			cell: NameCell,
		}),
		columnHelper.accessor("submittedAt", {
			header: "提出日時",
			cell: DateCell,
			meta: { dateFormat: "datetime" },
		}),

		// 設問ごとの動的カラム
		...items.map(item =>
			columnHelper.accessor(row => row.answers[item.id] ?? "", {
				id: item.id,
				header: item.label,
				cell: ctx => {
					const value = ctx.getValue();
					if (!value || (Array.isArray(value) && value.length === 0)) {
						return (
							<Text size="2" color="gray">
								—
							</Text>
						);
					}

					if (Array.isArray(value)) {
						return (
							<div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
								{value.map(v => (
									<Badge key={v.label} variant="soft" color={v.color}>
										{v.label}
									</Badge>
								))}
							</div>
						);
					}

					if (item.type === "FILE") {
						return (
							<Badge variant="soft" color="blue">
								{value as string}
							</Badge>
						);
					}

					return (
						<Text size="2" truncate>
							{value as string}
						</Text>
					);
				},
			})
		),
	];

	const handleDownloadFiles = async () => {
		setIsDownloading(true);
		try {
			await downloadFormResponseFilesZip(formId, formTitle);
		} catch (error) {
			reportHandledError({
				error,
				operation: "download_files_zip",
				userMessage: "ファイルの一括ダウンロードに失敗しました",
				ui: { type: "toast" },
				context: { formId },
			});
		} finally {
			setIsDownloading(false);
		}
	};

	if (!rows || rows.length === 0) {
		return (
			<div className={styles.emptyState}>
				<Text size="2" color={error ? "red" : "gray"}>
					{error ?? (rows ? "まだ回答がありません。" : "読み込み中...")}
				</Text>
			</div>
		);
	}

	return (
		<DataTable<AnswerRow>
			data={rows}
			columns={columns}
			features={{
				sorting: true,
				globalFilter: true,
				columnVisibility: false,
				selection: false,
				copy: false,
				csvExport: true,
			}}
			toolbarExtraBeforeCsv={
				hasFileItems ? (
					<Button
						intent="secondary"
						onClick={handleDownloadFiles}
						disabled={isDownloading}
						loading={isDownloading}
					>
						<IconDownload size={16} /> 一括ダウンロード
					</Button>
				) : null
			}
		/>
	);
}

/* ─── ステータスバッジ ─── */

function FormStatusBadge({ form }: { form: GetFormDetailResponse["form"] }) {
	const latestAuth = form.authorizationDetail;

	const status = getFormStatusFromAuth(
		latestAuth
			? {
					status: latestAuth.status,
					deliveredAt: latestAuth.scheduledSendAt,
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
