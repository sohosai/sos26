import { Box, Heading, Text } from "@radix-ui/themes";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/patterns";
import { listProjectMembers } from "@/lib/api/project";

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

	return (
		<Box p="4">
			<Heading size="6" mb="1">
				メンバー一覧
			</Heading>
			<Text color="gray" mb="4">
				この企画に参加しているメンバーです
			</Text>

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
		</Box>
	);
}
