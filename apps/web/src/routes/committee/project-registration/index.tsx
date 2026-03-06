import { Badge, Heading, Text } from "@radix-ui/themes";
import type { ProjectRegistrationFormAuthorizationStatus } from "@sos26/shared";
import { IconEye, IconPlus } from "@tabler/icons-react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { useState } from "react";
import { DataTable, DateCell, NameCell } from "@/components/patterns";
import {
	type ActionItem,
	ActionsMenu,
} from "@/components/patterns/ActionMenu/ActionMenu";
import { Button } from "@/components/primitives";
import { listCommitteeMembers } from "@/lib/api/committee-member";
import { listProjectRegistrationForms } from "@/lib/api/committee-project-registration-form";
import { useAuthStore } from "@/lib/auth";
import { CreateProjectRegistrationFormDialog } from "./-components/CreateProjectRegistrationFormDialog";
import styles from "./index.module.scss";

type FormRow = {
	id: string;
	ownerId: string;
	title: string;
	ownerName: string;
	isActive: boolean;
	sortOrder: number;
	filterTypes: string[];
	filterLocations: string[];
	updatedAt: Date;
	statusInfo: { label: string; color: "green" | "yellow" | "gray" | "red" };
};

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

function getStatusInfo(
	isActive: boolean,
	latestAuthStatus: ProjectRegistrationFormAuthorizationStatus | null
): FormRow["statusInfo"] {
	if (isActive) return { label: "有効", color: "green" };
	if (latestAuthStatus === "PENDING")
		return { label: "承認待ち", color: "yellow" };
	if (latestAuthStatus === "REJECTED") return { label: "却下", color: "red" };
	return { label: "下書き", color: "gray" };
}

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
				ownerName: f.owner.name,
				isActive: f.isActive,
				sortOrder: f.sortOrder,
				filterTypes: f.filterTypes,
				filterLocations: f.filterLocations,
				updatedAt: f.updatedAt,
				statusInfo: getStatusInfo(
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

	const buildActions = (form: FormRow): ActionItem<FormRow>[] => [
		{
			key: "detail",
			label: "詳細",
			icon: <IconEye size={16} />,
			href: {
				to: "/committee/project-registration/$formId",
				params: { formId: form.id },
			},
		},
	];

	const columns = [
		columnHelper.accessor("title", {
			header: "フォーム名",
		}),
		columnHelper.accessor("ownerName", {
			header: "作成者",
			cell: NameCell,
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
		columnHelper.display({
			id: "actions",
			header: "操作",
			cell: ({ row }) => (
				<ActionsMenu item={row.original} actions={buildActions(row.original)} />
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
				onSuccess={() => router.invalidate()}
			/>
		</div>
	);
}
