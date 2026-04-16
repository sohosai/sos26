import { Badge, Heading, Text } from "@radix-ui/themes";
import { IconEye, IconPlus } from "@tabler/icons-react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { useState } from "react";
import {
	AvatarGroupCell,
	type AvatarGroupItem,
	DataTable,
	DateCell,
	NameCell,
} from "@/components/patterns";
import { Button } from "@/components/primitives";
import { listMyForms } from "@/lib/api/committee-form";
import {
	type FormStatusInfo,
	getFormStatusFromAuth,
} from "@/lib/form/form-status";
import { CreateFormDialog } from "./-components/CreateFormDialog";
import styles from "./index.module.scss";

type FormRow = {
	id: string;
	ownerId: string;
	title: string;
	owner: { name: string; avatarFileId: string | null };
	collaborators: AvatarGroupItem[];
	updatedAt: Date;
	approver: { name: string; avatarFileId: string | null } | null;
	status: FormStatusInfo;
};

const columnHelper = createColumnHelper<FormRow>();

export const Route = createFileRoute("/committee/forms/")({
	component: CommitteeIndexPage,
	head: () => ({
		meta: [
			{ title: "申請管理 | 雙峰祭オンラインシステム" },
			{ name: "description", content: "申請管理" },
		],
	}),
	loader: async () => {
		const { forms } = await listMyForms();

		return {
			forms: forms.map(f => {
				const authorization = f.authorization;

				return {
					id: f.id,
					ownerId: f.owner.id,
					title: f.title,
					owner: { name: f.owner.name, avatarFileId: f.owner.avatarFileId },
					collaborators: f.collaborators.map(u => ({
						id: u.id,
						name: u.name,
						avatarFileId: u.avatarFileId,
					})),
					updatedAt: f.updatedAt,
					approver: authorization
						? {
								name: authorization.requestedTo.name,
								avatarFileId: authorization.requestedTo.avatarFileId,
							}
						: null,
					status: getFormStatusFromAuth(
						authorization
							? {
									status: authorization.status,
									deliveredAt: authorization.scheduledSendAt,
									deadlineAt: authorization.deadlineAt,
								}
							: null
					),
				} satisfies FormRow;
			}),
		};
	},
});

function CommitteeIndexPage() {
	const { forms } = Route.useLoaderData();
	const router = useRouter();

	const [dialogOpen, setDialogOpen] = useState(false);

	const columns = [
		columnHelper.accessor("title", {
			header: "申請名",
		}),
		columnHelper.accessor("owner", {
			header: "オーナー",
			cell: NameCell,
			sortingFn: (a, b) =>
				a.original.owner.name.localeCompare(b.original.owner.name),
		}),
		columnHelper.accessor("collaborators", {
			header: "共同編集者",
			cell: AvatarGroupCell,
		}),
		columnHelper.accessor("updatedAt", {
			header: "更新日",
			cell: DateCell,
			meta: { dateFormat: "date" },
		}),
		columnHelper.accessor("status", {
			header: "ステータス",
			cell: ctx => {
				const { label, color } = ctx.getValue();
				return (
					<Badge variant="soft" color={color}>
						{label}
					</Badge>
				);
			},
		}),
		columnHelper.accessor("approver", {
			header: "承認者",
			cell: ctx => {
				const value = ctx.getValue();
				if (!value)
					return (
						<Text size="2" color="gray">
							—
						</Text>
					);
				return <NameCell {...ctx} />;
			},
			sortingFn: (a, b) =>
				(a.original.approver?.name ?? "").localeCompare(
					b.original.approver?.name ?? ""
				),
		}),
		columnHelper.display({
			id: "actions",
			header: "操作",
			cell: ({ row }) => (
				<Link
					to="/committee/forms/$formId"
					params={{ formId: row.original.id }}
				>
					<Button intent="ghost" size="1">
						<IconEye size={16} />
						詳細
					</Button>
				</Link>
			),
			enableSorting: false,
		}),
	];

	return (
		<div>
			<div className={styles.header}>
				<Heading size="6">申請</Heading>
				<Text size="2" color="gray">
					申請の作成・管理ができます。
				</Text>
			</div>
			<DataTable<FormRow>
				data={forms}
				columns={columns}
				features={{
					sorting: true,
					globalFilter: true,
					columnVisibility: false,
					selection: false,
					copy: false,
					csvExport: false,
				}}
				toolbarExtra={
					<Button intent="primary" size="2" onClick={() => setDialogOpen(true)}>
						<IconPlus size={16} stroke={1.5} />
						申請を作成
					</Button>
				}
			/>
			<CreateFormDialog
				open={dialogOpen}
				onOpenChange={setDialogOpen}
				onSuccess={() => router.invalidate()}
			/>
		</div>
	);
}
