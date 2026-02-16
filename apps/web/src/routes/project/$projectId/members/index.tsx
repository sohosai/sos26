import { Heading } from "@radix-ui/themes";
import { IconPlus } from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useState } from "react";
import { DataTable } from "@/components/patterns";
import { Button } from "@/components/primitives";
import { InviteMemberDialog } from "@/components/project/members/InviteMemberDialog";
import { listProjectMembers } from "@/lib/api/project";
import styles from "./index.module.scss";

type MemberRow = {
	id: string;
	name: string;
	role: "OWNER" | "SUB_OWNER" | "MEMBER";
	joinedAt: Date;
};

export const Route = createFileRoute("/project/$projectId/members/")({
	loader: async ({ params }) => {
		return listProjectMembers(params.projectId);
	},
	component: RouteComponent,
});

const roleLabelMap: Record<MemberRow["role"], string> = {
	OWNER: "責任者",
	SUB_OWNER: "副責任者",
	MEMBER: "メンバー",
};

const columns: ColumnDef<MemberRow>[] = [
	{
		accessorKey: "name",
		header: "名前",
		cell: info => info.getValue(),
	},
	{
		accessorKey: "role",
		header: "役職",
		cell: info => roleLabelMap[info.getValue() as MemberRow["role"]],
	},
	{
		accessorKey: "joinedAt",
		header: "参加日",
		meta: {
			dateFormat: "date",
		},
		cell: info => new Date(info.getValue() as Date).toLocaleDateString(),
	},
];

function RouteComponent() {
	const { members } = Route.useLoaderData();
	const [dialogOpen, setDialogOpen] = useState(false);

	return (
		<div className={styles.page}>
			<Heading size="6">メンバー一覧</Heading>
			<Button intent="ghost" size="2" onClick={() => setDialogOpen(true)}>
				<IconPlus size={16} stroke={1.5} />
				メンバーを追加
			</Button>

			<DataTable<MemberRow>
				data={members}
				columns={columns}
				features={{
					sorting: true,
					globalFilter: true,
					columnVisibility: true,
					selection: true,
					copy: true,
					csvExport: true,
				}}
				initialSorting={[
					{
						id: "joinedAt",
						desc: false,
					},
				]}
			/>

			<InviteMemberDialog open={dialogOpen} onOpenChange={setDialogOpen} />
		</div>
	);
}
