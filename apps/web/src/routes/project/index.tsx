import { Badge, Card, Dialog, Heading, Table, Text } from "@radix-ui/themes";
import type {
	GetActiveProjectRegistrationFormsResponse,
	GetProjectRegistrationFormResponsesResponse,
} from "@sos26/shared";
import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/primitives";
import { ProjectDetailEditDialog } from "@/components/project/ProjectDetailEditDialog";
import { ProjectRegistrationFormResponseEditDialog } from "@/components/project/ProjectRegistrationFormResponseEditDialog";
import {
	getApplicationPeriod,
	getProjectRegistrationFormResponses,
} from "@/lib/api/project";
import { getActiveProjectRegistrationForms } from "@/lib/api/project-registration-form";
import { useAuthStore } from "@/lib/auth";
import { formatDate, formatProjectNumber } from "@/lib/format";
import {
	PROJECT_LOCATION_LABELS,
	PROJECT_TYPE_LABELS,
} from "@/lib/project/options";
import { useProject, useProjectStore } from "@/lib/project/store";
import styles from "./index.module.scss";

export const Route = createFileRoute("/project/")({
	component: ProjectIndexPage,
	loader: async () => {
		const { selectedProjectId, projects } = useProjectStore.getState();
		if (!selectedProjectId) {
			return {
				registrationFormResponses: [],
				registrationForms: [],
				applicationPeriodInfo: null,
			};
		}

		const project = projects.find(p => p.id === selectedProjectId);

		const [responsesResult, formsResult, applicationPeriodResult] =
			await Promise.allSettled([
				getProjectRegistrationFormResponses(selectedProjectId),
				project
					? getActiveProjectRegistrationForms(project.type, project.location)
					: Promise.resolve({ forms: [] }),
				getApplicationPeriod(),
			]);

		return {
			registrationFormResponses:
				responsesResult.status === "fulfilled"
					? responsesResult.value.responses
					: [],
			registrationForms:
				formsResult.status === "fulfilled" ? formsResult.value.forms : [],
			applicationPeriodInfo:
				applicationPeriodResult.status === "fulfilled"
					? applicationPeriodResult.value
					: null,
		};
	},
	head: () => ({
		meta: [
			{ title: "企画ダッシュボード | 雙峰祭オンラインシステム" },
			{ name: "description", content: "企画ダッシュボード" },
		],
	}),
});

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
	return (
		<Table.Row>
			<Table.RowHeaderCell>{label}</Table.RowHeaderCell>
			<Table.Cell>{value}</Table.Cell>
		</Table.Row>
	);
}

type RegistrationFormResponseAnswer =
	GetProjectRegistrationFormResponsesResponse["responses"][number]["answers"][number];
type RegistrationFormResponse =
	GetProjectRegistrationFormResponsesResponse["responses"][number];
type RegistrationForm =
	GetActiveProjectRegistrationFormsResponse["forms"][number];

function formatAnswerValue(answer: RegistrationFormResponseAnswer): string {
	switch (answer.type) {
		case "TEXT":
		case "TEXTAREA":
			return answer.textValue ?? "未回答";
		case "NUMBER":
			return answer.numberValue !== null
				? String(answer.numberValue)
				: "未回答";
		case "SELECT":
		case "CHECKBOX":
			return answer.selectedOptions.length > 0
				? answer.selectedOptions.map(option => option.label).join("、")
				: "未回答";
		case "FILE":
			return answer.files.length > 0
				? `ファイル${answer.files.length}件`
				: "未回答";
		default: {
			return "不明な回答タイプ";
		}
	}
}

type MissingPromptDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	missingForms: RegistrationForm[];
	visibleResponses: RegistrationFormResponse[];
	canEdit: boolean;
	onCreate: (formId: string) => void;
	onEdit: (responseId: string) => void;
};

function MissingPromptDialog({
	open,
	onOpenChange,
	missingForms,
	visibleResponses,
	canEdit,
	onCreate,
	onEdit,
}: MissingPromptDialogProps) {
	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Content maxWidth="520px">
				<Dialog.Title>回答すべき申請があります</Dialog.Title>
				<Dialog.Description>
					企画区分・実施場所の変更により、回答が必要な申請が追加されています。
					{missingForms.length > 1
						? `（未回答: ${missingForms.length}件）`
						: ""}
				</Dialog.Description>
				<div className={styles.missingPromptBody}>
					<div>
						<ul className={styles.missingPromptList}>
							{missingForms.map(form => (
								<li key={form.id} className={styles.missingPromptItem}>
									<div className={styles.missingPromptLabel}>
										<Badge size="1" variant="soft" color="orange">
											未回答
										</Badge>
										<Text size="2">{form.title}</Text>
									</div>
									<Button
										size="1"
										intent="secondary"
										onClick={() => onCreate(form.id)}
									>
										回答する
									</Button>
								</li>
							))}
							{missingForms.length === 0 && (
								<li>
									<Text size="1" color="gray">
										未回答の申請はありません。
									</Text>
								</li>
							)}
						</ul>
					</div>
					<div>
						<ul className={styles.missingPromptList}>
							{visibleResponses.map(response => (
								<li key={response.id} className={styles.missingPromptItem}>
									<div className={styles.missingPromptLabel}>
										<Badge size="1" variant="soft" color="green">
											回答済み
										</Badge>
										<Text size="2">{response.form.title}</Text>
									</div>
									<Button
										size="1"
										intent="secondary"
										disabled={!canEdit}
										onClick={() => onEdit(response.id)}
									>
										編集
									</Button>
								</li>
							))}
						</ul>
					</div>
				</div>
			</Dialog.Content>
		</Dialog.Root>
	);
}

type RegistrationFormsSectionProps = {
	missingForms: RegistrationForm[];
	visibleResponses: RegistrationFormResponse[];
	formMap: Map<string, RegistrationForm>;
	canEdit: boolean;
	isOwner: boolean;
	isApplicationPeriodOpen: boolean;
	detailEditReason: string | null;
	onCreate: (formId: string) => void;
	onEdit: (responseId: string) => void;
};

function RegistrationFormsSection({
	missingForms,
	visibleResponses,
	formMap,
	canEdit,
	isOwner,
	isApplicationPeriodOpen,
	detailEditReason,
	onCreate,
	onEdit,
}: RegistrationFormsSectionProps) {
	if (visibleResponses.length === 0 && missingForms.length === 0) {
		return null;
	}

	return (
		<section className={styles.section}>
			{!isApplicationPeriodOpen && (
				<Text size="2" color="gray">
					企画応募期間外のため、企画登録フォームの回答は編集できません。
				</Text>
			)}
			<div className={styles.formResponses}>
				{missingForms.map(form => (
					<Card key={form.id}>
						<div className={styles.formResponseHeader}>
							<div className={styles.formResponseMeta}>
								<Heading size="3">{form.title}</Heading>
								{form.description && (
									<Text size="1" color="gray">
										{form.description}
									</Text>
								)}
								<Text size="1" color="gray">
									未回答の申請です。
								</Text>
							</div>
							<div className={styles.formResponseActions}>
								<Button
									size="1"
									intent="secondary"
									disabled={!canEdit}
									onClick={() => onCreate(form.id)}
								>
									回答する
								</Button>
								{detailEditReason && (
									<Text size="1" color="gray">
										{detailEditReason}
									</Text>
								)}
							</div>
						</div>
					</Card>
				))}
				{visibleResponses.map(response => {
					const form = formMap.get(response.form.id) ?? null;
					const editReason = !form
						? "フォーム情報が取得できません"
						: !isOwner
							? "責任者のみ編集できます"
							: !isApplicationPeriodOpen
								? "企画応募期間外のため編集できません"
								: null;

					return (
						<Card key={response.id}>
							<div className={styles.formResponseHeader}>
								<div className={styles.formResponseMeta}>
									<Heading size="3">{response.form.title}</Heading>
									<Text size="1" color="gray">
										最終更新: {formatDate(response.submittedAt, "datetime")}
									</Text>
									{response.form.description && (
										<Text size="1" color="gray">
											{response.form.description}
										</Text>
									)}
								</div>
								<div className={styles.formResponseActions}>
									<Button
										size="2"
										intent="secondary"
										disabled={!canEdit || !form}
										onClick={() => onEdit(response.id)}
									>
										編集
									</Button>
									{editReason && (
										<Text size="1" color="gray">
											{editReason}
										</Text>
									)}
								</div>
							</div>
							<Table.Root className={styles.table}>
								<Table.Body>
									{response.answers.map(answer => (
										<Table.Row key={answer.formItemId}>
											<Table.RowHeaderCell>
												{answer.formItemLabel}
											</Table.RowHeaderCell>
											<Table.Cell>{formatAnswerValue(answer)}</Table.Cell>
										</Table.Row>
									))}
								</Table.Body>
							</Table.Root>
						</Card>
					);
				})}
			</div>
		</section>
	);
}

function ProjectIndexPage() {
	const project = useProject();
	const { projects, setProjects } = useProjectStore();
	const {
		registrationFormResponses,
		registrationForms,
		applicationPeriodInfo,
	} = Route.useLoaderData();
	const { user } = useAuthStore();
	const [responses, setResponses] = useState(registrationFormResponses);
	const [forms, setForms] = useState(registrationForms);
	const [editingResponseId, setEditingResponseId] = useState<string | null>(
		null
	);
	const [creatingFormId, setCreatingFormId] = useState<string | null>(null);
	const [detailEditOpen, setDetailEditOpen] = useState(false);
	const [missingPromptOpen, setMissingPromptOpen] = useState(false);

	useEffect(() => {
		setResponses(registrationFormResponses);
	}, [registrationFormResponses]);
	useEffect(() => {
		setForms(registrationForms);
	}, [registrationForms]);
	const isOwner = user?.id === project.ownerId;
	const isApplicationPeriodOpen = applicationPeriodInfo?.isOpen ?? true;
	const canEdit = isOwner && isApplicationPeriodOpen;
	const detailEditReason = !isOwner
		? "責任者のみ編集できます"
		: !isApplicationPeriodOpen
			? "企画応募期間外のため編集できません"
			: null;
	const formMap = useMemo(
		() => new Map(forms.map(form => [form.id, form])),
		[forms]
	);
	const visibleResponses = useMemo(
		() => responses.filter(response => formMap.has(response.form.id)),
		[responses, formMap]
	);
	const missingForms = useMemo(
		() => forms.filter(form => !responses.some(r => r.form.id === form.id)),
		[forms, responses]
	);
	useEffect(() => {
		if (!canEdit) {
			setMissingPromptOpen(false);
			return;
		}
		if (missingForms.length === 0) {
			setMissingPromptOpen(false);
			return;
		}
		if (
			missingForms.length > 0 &&
			!missingPromptOpen &&
			!creatingFormId &&
			!editingResponseId
		) {
			setMissingPromptOpen(true);
		}
	}, [
		canEdit,
		missingForms.length,
		missingPromptOpen,
		creatingFormId,
		editingResponseId,
	]);
	const editingResponse =
		responses.find(response => response.id === editingResponseId) ?? null;
	const editingForm = editingResponse
		? (formMap.get(editingResponse.form.id) ?? null)
		: null;
	const creatingForm = creatingFormId
		? (formMap.get(creatingFormId) ?? null)
		: null;
	const rows = [
		{ label: "企画番号", value: formatProjectNumber(project.number) },
		{ label: "登録日", value: formatDate(project.createdAt, "date") },
		{ label: "企画名", value: project.name },
		{ label: "企画名（ふりがな）", value: project.namePhonetic },
		{ label: "企画団体名", value: project.organizationName },
		{
			label: "企画団体名（ふりがな）",
			value: project.organizationNamePhonetic,
		},
		{
			label: "企画区分",
			value: PROJECT_TYPE_LABELS[project.type] ?? project.type,
		},
		{
			label: "実施場所",
			value: PROJECT_LOCATION_LABELS[project.location] ?? project.location,
		},
	];

	return (
		<div className={styles.page}>
			<header className={styles.header}>
				<div className={styles.headerRow}>
					<Heading size="6">企画ダッシュボード</Heading>
					<div className={styles.headerActions}>
						<Button
							size="2"
							intent="secondary"
							disabled={!canEdit}
							onClick={() => setDetailEditOpen(true)}
						>
							基本情報を編集
						</Button>
						{detailEditReason && (
							<Text size="1" color="gray">
								{detailEditReason}
							</Text>
						)}
					</div>
				</div>
				<Text as="p" size="2" color="gray">
					選択中の企画の基本情報を確認できます。
				</Text>
			</header>

			<Card>
				<Heading size="4">基本情報</Heading>
				<Table.Root className={styles.table}>
					<Table.Body>
						{rows.map(row => (
							<InfoRow key={row.label} label={row.label} value={row.value} />
						))}
					</Table.Body>
				</Table.Root>
			</Card>

			<RegistrationFormsSection
				missingForms={missingForms}
				visibleResponses={visibleResponses}
				formMap={formMap}
				canEdit={canEdit}
				isOwner={isOwner}
				isApplicationPeriodOpen={isApplicationPeriodOpen}
				detailEditReason={detailEditReason}
				onCreate={formId => setCreatingFormId(formId)}
				onEdit={responseId => setEditingResponseId(responseId)}
			/>
			<ProjectRegistrationFormResponseEditDialog
				open={editingResponseId !== null || creatingFormId !== null}
				onOpenChange={nextOpen => {
					if (!nextOpen) {
						setEditingResponseId(null);
						setCreatingFormId(null);
					}
				}}
				projectId={project.id}
				response={editingResponse}
				form={editingResponse ? editingForm : creatingForm}
				onUpdated={updated => {
					setResponses(prev =>
						prev.map(response =>
							response.id === updated.id ? updated : response
						)
					);
				}}
				onCreated={created => {
					setResponses(prev => [...prev, created]);
				}}
			/>
			<ProjectDetailEditDialog
				open={detailEditOpen}
				onOpenChange={setDetailEditOpen}
				project={project}
				onUpdated={updated => {
					setProjects(projects.map(p => (p.id === updated.id ? updated : p)));
					void (async () => {
						const [formsResult, responsesResult] = await Promise.allSettled([
							getActiveProjectRegistrationForms(updated.type, updated.location),
							getProjectRegistrationFormResponses(updated.id),
						]);
						if (formsResult.status === "fulfilled") {
							setForms(formsResult.value.forms);
						}
						if (responsesResult.status === "fulfilled") {
							setResponses(responsesResult.value.responses);
						}
					})();
				}}
			/>
			<MissingPromptDialog
				open={missingPromptOpen}
				onOpenChange={nextOpen => {
					if (!nextOpen && missingForms.length > 0) {
						setMissingPromptOpen(true);
						return;
					}
					setMissingPromptOpen(nextOpen);
				}}
				missingForms={missingForms}
				visibleResponses={visibleResponses}
				canEdit={canEdit}
				onCreate={formId => {
					setMissingPromptOpen(false);
					setCreatingFormId(formId);
				}}
				onEdit={responseId => {
					setMissingPromptOpen(false);
					setEditingResponseId(responseId);
				}}
			/>
		</div>
	);
}
