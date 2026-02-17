import { Heading, Popover } from "@radix-ui/themes";
import {
	IconDotsVertical,
	IconPlus,
	IconTrash,
	IconUserUp,
} from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useState } from "react";
import { DataTable } from "@/components/patterns";
import { Button } from "@/components/primitives";
import { InviteMemberDialog } from "@/components/project/members/InviteMemberDialog";
import {
	listProjectMembers,
	promoteSubOwner,
	removeProjectMember,
} from "@/lib/api/project";
import styles from "./index.module.scss";

type MemberRow = {
	userId: string;
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

const createColumns = (
	onPromote: (memberId: string) => void,
	onDelete: (memberId: string) => void,
	hasSubOwner: boolean
): ColumnDef<MemberRow>[] => [
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
	{
		id: "actions",
		header: "",
		enableSorting: false,
		enableHiding: false,
		cell: ({ row }) => {
			const member = row.original;

			return (
				<Popover.Root>
					<Popover.Trigger>
						{/* 色を表の中身で揃えたいため、<IconButton>は使わない */}
						<button type="button" className={styles.trigger}>
							<IconDotsVertical size={16} />
						</button>
					</Popover.Trigger>

					<Popover.Content align="start" sideOffset={4}>
						<div className={styles.menu}>
							{!hasSubOwner && member.role !== "OWNER" && (
								<Button
									intent="ghost"
									size="2"
									onClick={() => onPromote(member.userId)}
								>
									<IconUserUp size={16} />
									副責任者に指名
								</Button>
							)}
							{member.role === "MEMBER" && (
								<Button
									intent="ghost"
									size="2"
									onClick={() => onDelete(member.userId)}
								>
									<IconTrash size={16} />
									削除
								</Button>
							)}
							{/* 現状何もボタンがない状態が存在するが、後々追加することが予想されるため放置 */}
						</div>
					</Popover.Content>
				</Popover.Root>
			);
		},
	},
];

function RouteComponent() {
	const loaderData = Route.useLoaderData();
	const [members, setMembers] = useState(loaderData.members);
	const [dialogOpen, setDialogOpen] = useState(false);
	const { projectId } = Route.useParams();

	const handlePromote = async (memberId: string) => {
		try {
			await promoteSubOwner(projectId, memberId);

			setMembers(prev =>
				prev.map(m => ({
					...m,
					role: m.userId === memberId ? "SUB_OWNER" : m.role,
				}))
			);
		} catch (err) {
			console.error(err);
			alert("副責任者の任命に失敗しました");
		}
	};

	const handleDeleteMember = async (memberId: string) => {
		try {
			await removeProjectMember(projectId, memberId);
			setMembers(prev => prev.filter(m => m.userId !== memberId));
		} catch (err) {
			console.error(err);
			alert("メンバーの削除に失敗しました");
		}
	};

	return (
		<div className={styles.page}>
			<Heading size="6">メンバー一覧</Heading>
			<Button intent="ghost" size="2" onClick={() => setDialogOpen(true)}>
				<IconPlus size={16} stroke={1.5} />
				メンバーを追加
			</Button>

			<DataTable<MemberRow>
				data={members}
				columns={createColumns(
					handlePromote,
					handleDeleteMember,
					members.some(member => member.role === "SUB_OWNER")
				)}
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
