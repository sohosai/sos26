import { Badge, Heading, Text } from "@radix-ui/themes";
import { IconEye, IconPlus } from "@tabler/icons-react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { useState } from "react";
import { DataTable, DateCell, NameCell } from "@/components/patterns";
import { Button } from "@/components/primitives";
import { listCommitteeMembers } from "@/lib/api/committee-member";
import { listProjectRegistrationForms } from "@/lib/api/committee-project-registration-form";
import { useAuthStore } from "@/lib/auth";
import {
	type FormStatusInfo,
	getProjectRegistrationFormStatus,
} from "@/lib/form/form-status";
import {
	PROJECT_LOCATION_LABELS,
	PROJECT_TYPE_LABELS,
} from "@/lib/project/options";
import { CreateProjectRegistrationFormDialog } from "./-components/CreateProjectRegistrationFormDialog";
import styles from "./index.module.scss";

type FormRow = {
	id: string;
	ownerId: string;
	title: string;
	owner: { name: string; avatarFileId: string | null };
	isActive: boolean;
	sortOrder: number;
	filterTypes: string[];
	filterLocations: string[];
	updatedAt: Date;
	statusInfo: FormStatusInfo;
};

type LoaderData = {
	forms: FormRow[];
	canCreate: boolean;
};

const columnHelper = createColumnHelper<FormRow>();

export const Route = createFileRoute("/committee/project-registration/")({
	component: ProjectRegistrationPage,
	head: () => ({
		meta: [{ title: "企画登録管理 | 雙峰祭オンラインシステム" }],
	}),
	loader: async (): Promise<LoaderData> => {
		const [{ forms }, { committeeMembers }] = await Promise.all([
			listProjectRegistrationForms(),
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

		return {
			forms: forms.map(f => ({
				id: f.id,
				ownerId: f.ownerId,
				title: f.title,
				owner: { name: f.owner.name, avatarFileId: f.owner.avatarFileId },
				isActive: f.isActive,
				sortOrder: f.sortOrder,
				filterTypes: f.filterTypes,
				filterLocations: f.filterLocations,
				updatedAt: f.updatedAt,
				statusInfo: getProjectRegistrationFormStatus(
					f.isActive,
					f.latestAuthorization?.status ?? null
				),
			})),
			canCreate,
		};
	},
});

function ProjectRegistrationPage() {
	const { forms, canCreate } = Route.useLoaderData();
	const router = useRouter();
	const [createDialogOpen, setCreateDialogOpen] = useState(false);

	const activeForms = forms
		.filter(f => f.isActive)
		.sort((a, b) => a.sortOrder - b.sortOrder)
		.map(f => ({
			id: f.id,
			title: f.title,
			filterTypes: f.filterTypes,
			filterLocations: f.filterLocations,
		}));

	const columns = [
		columnHelper.accessor("title", {
			header: "フォーム名",
		}),
		columnHelper.accessor("owner", {
			header: "オーナー",
			cell: NameCell,
			sortingFn: (a, b) =>
				a.original.owner.name.localeCompare(b.original.owner.name),
		}),
		columnHelper.accessor("filterTypes", {
			header: "対象区分",
			cell: ctx => {
				const types = ctx.getValue();
				if (types.length === 0)
					return (
						<Text size="2" color="gray">
							全区分
						</Text>
					);
				return (
					<Text size="2">
						{types.map(t => PROJECT_TYPE_LABELS[t] ?? t).join("・")}
					</Text>
				);
			},
		}),
		columnHelper.accessor("filterLocations", {
			header: "対象場所",
			cell: ctx => {
				const locs = ctx.getValue();
				if (locs.length === 0)
					return (
						<Text size="2" color="gray">
							全場所
						</Text>
					);
				return (
					<Text size="2">
						{locs.map(l => PROJECT_LOCATION_LABELS[l] ?? l).join("・")}
					</Text>
				);
			},
		}),
		columnHelper.accessor("sortOrder", {
			header: "表示順",
		}),
		columnHelper.accessor("updatedAt", {
			header: "更新日",
			cell: DateCell,
			meta: { dateFormat: "date" },
		}),
		columnHelper.accessor("statusInfo", {
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
		columnHelper.display({
			id: "actions",
			header: "操作",
			cell: ({ row }) => (
				<Link
					to="/committee/project-registration/$formId"
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
				<Heading size="6">企画登録管理</Heading>
				<Text size="2" color="gray">
					企画登録時に表示される追加フォームを管理します。
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
					canCreate ? (
						<Button
							intent="primary"
							size="2"
							onClick={() => setCreateDialogOpen(true)}
						>
							<IconPlus size={16} stroke={1.5} />
							フォームを作成
						</Button>
					) : undefined
				}
			/>

			<CreateProjectRegistrationFormDialog
				open={createDialogOpen}
				onOpenChange={setCreateDialogOpen}
				activeForms={activeForms}
				onSuccess={() => router.invalidate()}
			/>
		</div>
	);
}
