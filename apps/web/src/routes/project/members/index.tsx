import { Heading } from "@radix-ui/themes";
import { IconPlus, IconTrash, IconUserUp } from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DataTable, TagCell } from "@/components/patterns";
import {
	type ActionItem,
	ActionsMenu,
} from "@/components/patterns/ActionMenu/ActonMenu";
import { Button } from "@/components/primitives";
import { InviteMemberDialog } from "@/components/project/members/InviteMemberDialog";
import {
	assignSubOwner,
	listProjectMembers,
	removeProjectMember,
} from "@/lib/api/project";
import { useAuthStore } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { useProject, useProjectStore } from "@/lib/project/store";

export type MemberRow = {
	userId: string;
	name: string;
	email: string;
	role: "OWNER" | "SUB_OWNER" | "MEMBER";
	roleLabel: string[];
	joinedAt: Date;
};

const buildMemberActions = (
	member: MemberRow,
	hasSubOwner: boolean,
	onAssign: (id: string) => void,
	onDelete: (id: string) => void
): ActionItem<MemberRow>[] => [
	{
		key: "assign-sub-owner",
		label: "副責任者に指名",
		icon: <IconUserUp size={16} />,
		hidden: member.role !== "MEMBER" || hasSubOwner,
		onClick: m => onAssign(m.userId),
	},
	{
		key: "delete-member",
		label: "削除",
		icon: <IconTrash size={16} />,
		hidden: member.role !== "MEMBER",
		onClick: m => onDelete(m.userId),
	},
];

const roleLabelMap: Record<MemberRow["role"], string> = {
	OWNER: "責任者",
	SUB_OWNER: "副責任者",
	MEMBER: "メンバー",
};

const roleColorMap: Record<string, string> = {
	責任者: "red",
	副責任者: "orange",
	メンバー: "gray",
};

const memberColumnHelper = createColumnHelper<MemberRow>();

export const Route = createFileRoute("/project/members/")({
	component: RouteComponent,
	loader: async () => {
		const { selectedProjectId } = useProjectStore.getState();
		if (!selectedProjectId) return { members: [] as MemberRow[] };
		const data = await listProjectMembers(selectedProjectId);
		return {
			members: data.members.map((m: Omit<MemberRow, "roleLabel">) => ({
				...m,
				roleLabel: [roleLabelMap[m.role]],
			})),
		};
	},
});

function RouteComponent() {
	const { members: initialMembers } = Route.useLoaderData();
	const [members, setMembers] = useState<MemberRow[]>(initialMembers);

	useEffect(() => {
		setMembers(initialMembers);
	}, [initialMembers]);
	const [dialogOpen, setDialogOpen] = useState(false);
	const project = useProject();
	const { user } = useAuthStore();

	const hasSubOwner = members.some(member => member.role === "SUB_OWNER");

	const isPrivileged =
		project.ownerId === user?.id || project.subOwnerId === user?.id;
	const handleAssign = async (memberId: string) => {
		try {
			await assignSubOwner(project.id, memberId);

			setMembers(prev =>
				prev.map(m => {
					if (m.userId === memberId) {
						return {
							...m,
							role: "SUB_OWNER" as const,
							roleLabel: [roleLabelMap.SUB_OWNER],
						};
					}
					return m;
				})
			);
		} catch {
			toast.error("副責任者の任命に失敗しました");
		}
	};

	const handleDeleteMember = async (memberId: string) => {
		try {
			await removeProjectMember(project.id, memberId);
			setMembers(prev => prev.filter(m => m.userId !== memberId));
		} catch {
			toast.error("メンバーの削除に失敗しました");
		}
	};

	const baseColumns = [
		memberColumnHelper.accessor("name", {
			header: "名前",
		}),
		memberColumnHelper.accessor("email", {
			header: "メールアドレス",
		}),
		memberColumnHelper.accessor("roleLabel", {
			header: "役職",
			cell: TagCell,
			meta: {
				tagColors: roleColorMap,
			},
		}),
		memberColumnHelper.accessor("joinedAt", {
			header: "参加日",
			cell: info => formatDate(new Date(info.getValue()), "date"),
		}),
	];

	const memberColumns = isPrivileged
		? [
				...baseColumns,
				memberColumnHelper.display({
					id: "actions",
					header: "",
					cell: ({ row }) => (
						<ActionsMenu
							item={row.original}
							actions={buildMemberActions(
								row.original,
								hasSubOwner,
								handleAssign,
								handleDeleteMember
							)}
						/>
					),
				}),
			]
		: baseColumns;

	return (
		<div>
			<Heading size="6">メンバー一覧</Heading>

			<DataTable<MemberRow>
				data={members}
				columns={memberColumns}
				features={{
					sorting: true,
					globalFilter: false,
					columnVisibility: false,
					selection: false,
					copy: false,
					csvExport: false,
				}}
				initialSorting={[
					{
						id: "joinedAt",
						desc: false,
					},
				]}
				toolbarExtra={
					<Button intent="primary" size="2" onClick={() => setDialogOpen(true)}>
						<IconPlus size={16} stroke={1.5} />
						メンバーを追加
					</Button>
				}
			/>

			<InviteMemberDialog open={dialogOpen} onOpenChange={setDialogOpen} />
		</div>
	);
}
