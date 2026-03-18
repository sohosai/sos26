import {
	AlertDialog,
	Badge,
	Button,
	Callout,
	Card,
	Dialog,
	Heading,
	Select,
	Table,
	Text,
	TextField,
} from "@radix-ui/themes";
import type {
	CommitteeProjectDetail,
	ProjectDeletionStatus,
	UpdateCommitteeProjectBaseInfoRequest,
} from "@sos26/shared";
import { createFileRoute } from "@tanstack/react-router";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
	getCommitteeProjectDetail,
	updateCommitteeProjectBaseInfo,
	updateCommitteeProjectDeletionStatus,
} from "@/lib/api/committee-project";
import { formatDate } from "@/lib/format";
import {
	PROJECT_LOCATION_LABELS,
	PROJECT_TYPE_LABELS,
} from "@/lib/project/options";
import styles from "./$projectId.module.scss";

type DeletionStatusSelectValue = ProjectDeletionStatus | "ACTIVE";

export const Route = createFileRoute("/committee/info/$projectId")({
	loader: async ({ params }) => getCommitteeProjectDetail(params.projectId),
	component: CommitteeProjectInfoPage,
	head: () => ({
		meta: [{ title: "企画詳細 | 雙峰祭オンラインシステム" }],
	}),
});

function statusLabel(status: ProjectDeletionStatus | null): string {
	if (status === "LOTTERY_LOSS") return "抽選漏れ";
	if (status === "DELETED") return "削除";
	return "有効";
}

function CommitteeProjectInfoPage() {
	const data = Route.useLoaderData();
	const [project, setProject] = useState<CommitteeProjectDetail>(data.project);
	const [editOpen, setEditOpen] = useState(false);
	const [saving, setSaving] = useState(false);
	const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
	const [deletionStatus, setDeletionStatus] =
		useState<DeletionStatusSelectValue>("DELETED");

	const [form, setForm] = useState<UpdateCommitteeProjectBaseInfoRequest>({
		name: project.name,
		namePhonetic: project.namePhonetic,
		organizationName: project.organizationName,
		organizationNamePhonetic: project.organizationNamePhonetic,
		type: project.type,
		location: project.location,
	});

	useEffect(() => {
		if (!editOpen) return;

		setForm({
			name: project.name,
			namePhonetic: project.namePhonetic,
			organizationName: project.organizationName,
			organizationNamePhonetic: project.organizationNamePhonetic,
			type: project.type,
			location: project.location,
		});
	}, [editOpen, project]);

	const mixedActions = useMemo(() => {
		return [
			...project.actions.forms.map(item => ({
				...item,
				kind: "申請" as const,
			})),
			...project.actions.notices.map(item => ({
				...item,
				kind: "お知らせ" as const,
			})),
			...project.actions.inquiries.map(item => ({
				...item,
				kind: "お問い合わせ" as const,
			})),
		].sort((a, b) => +new Date(b.sentAt) - +new Date(a.sentAt));
	}, [project.actions]);

	const applyProjectUpdate = (
		updated: Omit<CommitteeProjectDetail, "actions" | "permissions">
	) => {
		setProject(prev => ({
			...prev,
			...updated,
			owner: {
				...prev.owner,
				...updated.owner,
			},
			subOwner: updated.subOwner
				? {
						...updated.subOwner,
					}
				: null,
		}));
	};

	const handleSaveBaseInfo = async () => {
		try {
			setSaving(true);
			const res = await updateCommitteeProjectBaseInfo(project.id, form);
			applyProjectUpdate(res.project);
			setEditOpen(false);
			toast.success("企画情報を更新しました");
		} catch {
			toast.error("企画情報の更新に失敗しました");
		} finally {
			setSaving(false);
		}
	};

	const handleUpdateDeletionStatus = async (
		status: ProjectDeletionStatus | null
	) => {
		try {
			setSaving(true);
			const res = await updateCommitteeProjectDeletionStatus(project.id, {
				deletionStatus: status,
			});
			applyProjectUpdate(res.project);
			setDeleteConfirmOpen(false);
			toast.success(
				status
					? `企画を「${statusLabel(status)}」に設定しました`
					: "企画の削除状態を取り消しました"
			);
		} catch {
			toast.error("企画状態の更新に失敗しました");
		} finally {
			setSaving(false);
		}
	};

	const openDeleteStatusDialog = () => {
		setDeletionStatus(project.deletionStatus ?? "ACTIVE");
		setDeleteConfirmOpen(true);
	};

	return (
		<div className={styles.page}>
			<header className={styles.header}>
				<div>
					<Heading size="6">企画詳細</Heading>
					<div className={styles.meta}>
						<Text size="2" color="gray">
							企画番号 {project.number}
						</Text>
						<Badge color={project.deletionStatus === null ? "green" : "red"}>
							{statusLabel(project.deletionStatus)}
						</Badge>
					</div>
				</div>
				<div className={styles.controls}>
					{project.permissions.canEdit && (
						<Button onClick={() => setEditOpen(true)}>基本情報を編集</Button>
					)}
					{project.permissions.canDelete && (
						<Button color="red" variant="soft" onClick={openDeleteStatusDialog}>
							ステータスを変更
						</Button>
					)}
				</div>
			</header>

			{project.deletionStatus !== null && (
				<Callout.Root color="red">
					<Callout.Text>
						この企画は「{statusLabel(project.deletionStatus)}
						」として扱われています。
					</Callout.Text>
				</Callout.Root>
			)}

			<Card>
				<Heading size="4">基本情報</Heading>
				<Table.Root className={styles.table}>
					<Table.Body>
						<Row label="企画名" value={project.name} />
						<Row label="企画名（ふりがな）" value={project.namePhonetic} />
						<Row label="企画団体名" value={project.organizationName} />
						<Row
							label="企画団体名（ふりがな）"
							value={project.organizationNamePhonetic}
						/>
						<Row
							label="企画区分"
							value={PROJECT_TYPE_LABELS[project.type] ?? project.type}
						/>
						<Row
							label="実施場所"
							value={
								PROJECT_LOCATION_LABELS[project.location] ?? project.location
							}
						/>
						<Row
							label="最終更新"
							value={formatDate(project.updatedAt, "datetime")}
						/>
					</Table.Body>
				</Table.Root>
			</Card>

			<Card>
				<Heading size="4">責任者情報</Heading>
				{!project.permissions.canViewContacts && (
					<Text size="2" color="gray">
						企画閲覧権限がないため、メールアドレスと電話番号は非表示です。
					</Text>
				)}
				<div className={styles.people}>
					<PersonCard title="責任者" person={project.owner} />
					<PersonCard title="副責任者" person={project.subOwner} />
				</div>
			</Card>

			<Card>
				<Heading size="4">アクション履歴</Heading>
				<div className={styles.actionList}>
					{mixedActions.length === 0 && (
						<Text size="2" color="gray">
							履歴はありません。
						</Text>
					)}
					{mixedActions.map(item => (
						<div key={item.id} className={styles.actionRow}>
							<div className={styles.actionMain}>
								<Badge color="gray" variant="soft">
									{item.kind}
								</Badge>
								<Text size="2">{item.title}</Text>
							</div>
							<span className={styles.actionTime}>
								{formatDate(item.sentAt, "datetime")}
							</span>
						</div>
					))}
				</div>
			</Card>

			<Dialog.Root open={editOpen} onOpenChange={setEditOpen}>
				<Dialog.Content>
					<Dialog.Title>企画の基本情報を編集</Dialog.Title>
					<div className={styles.form}>
						<Field label="企画名">
							<TextField.Root
								value={form.name ?? ""}
								onChange={e =>
									setForm(prev => ({ ...prev, name: e.target.value }))
								}
							/>
						</Field>
						<Field label="企画名（ふりがな）">
							<TextField.Root
								value={form.namePhonetic ?? ""}
								onChange={e =>
									setForm(prev => ({ ...prev, namePhonetic: e.target.value }))
								}
							/>
						</Field>
						<Field label="企画団体名">
							<TextField.Root
								value={form.organizationName ?? ""}
								onChange={e =>
									setForm(prev => ({
										...prev,
										organizationName: e.target.value,
									}))
								}
							/>
						</Field>
						<Field label="企画団体名（ふりがな）">
							<TextField.Root
								value={form.organizationNamePhonetic ?? ""}
								onChange={e =>
									setForm(prev => ({
										...prev,
										organizationNamePhonetic: e.target.value,
									}))
								}
							/>
						</Field>
					</div>
					<div className={styles.dialogActions}>
						<Dialog.Close>
							<Button variant="soft" color="gray">
								キャンセル
							</Button>
						</Dialog.Close>
						<Button onClick={handleSaveBaseInfo} disabled={saving}>
							{saving ? "更新中..." : "更新する"}
						</Button>
					</div>
				</Dialog.Content>
			</Dialog.Root>

			<AlertDialog.Root
				open={deleteConfirmOpen}
				onOpenChange={setDeleteConfirmOpen}
			>
				<AlertDialog.Content>
					<AlertDialog.Title>企画のステータスを変更</AlertDialog.Title>
					<AlertDialog.Description>
						削除状態を設定すると、企画画面に警告バーが表示されます。
					</AlertDialog.Description>
					<Field label="変更後の状態">
						<Select.Root
							value={deletionStatus}
							onValueChange={value =>
								setDeletionStatus(value as DeletionStatusSelectValue)
							}
						>
							<Select.Trigger />
							<Select.Content>
								<Select.Item value="ACTIVE">有効</Select.Item>
								<Select.Item value="DELETED">削除</Select.Item>
								<Select.Item value="LOTTERY_LOSS">抽選漏れ</Select.Item>
							</Select.Content>
						</Select.Root>
					</Field>
					<div className={styles.dialogActions}>
						<AlertDialog.Cancel>
							<Button variant="soft" color="gray">
								キャンセル
							</Button>
						</AlertDialog.Cancel>
						<Button
							color="red"
							onClick={() =>
								handleUpdateDeletionStatus(
									deletionStatus === "ACTIVE" ? null : deletionStatus
								)
							}
							disabled={saving}
						>
							{saving ? "保存中..." : "保存"}
						</Button>
					</div>
				</AlertDialog.Content>
			</AlertDialog.Root>
		</div>
	);
}

function Row({ label, value }: { label: string; value: string | number }) {
	return (
		<Table.Row>
			<Table.RowHeaderCell>{label}</Table.RowHeaderCell>
			<Table.Cell>{value}</Table.Cell>
		</Table.Row>
	);
}

function PersonCard({
	title,
	person,
}: {
	title: string;
	person: {
		id: string;
		name: string;
		email: string | null;
		telephoneNumber: string | null;
	} | null;
}) {
	if (!person) {
		return (
			<div className={styles.personCard}>
				<Text size="2" color="gray">
					{title}: 未設定
				</Text>
			</div>
		);
	}

	return (
		<div className={styles.personCard}>
			<Heading size="3">{title}</Heading>
			<Text as="p" size="2">
				{person.name}
			</Text>
			<Text as="p" size="2" color="gray">
				メール: {person.email ?? "権限がないため非表示"}
			</Text>
			<Text as="p" size="2" color="gray">
				電話: {person.telephoneNumber ?? "権限がないため非表示"}
			</Text>
		</div>
	);
}

function Field({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className={styles.field}>
			<Text size="2">{label}</Text>
			{children}
		</div>
	);
}
