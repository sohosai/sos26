import { Heading, Popover } from "@radix-ui/themes";
import {
	IconDotsVertical,
	IconPlus,
	IconTrash,
	IconUserUp,
} from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { useContext, useEffect, useState } from "react";
import { DataTable, TagCell } from "@/components/patterns";
import { Button } from "@/components/primitives";
import { InviteMemberDialog } from "@/components/project/members/InviteMemberDialog";
import {
	assignSubOwner,
	listProjectMembers,
	removeProjectMember,
} from "@/lib/api/project";
import { useAuthStore } from "@/lib/auth";
import { ProjectContext } from "@/lib/project/context";
import styles from "./index.module.scss";

export type MemberRow = {
	userId: string;
	name: string;
	email: string;
	role: "OWNER" | "SUB_OWNER" | "MEMBER";
	roleLabel: string[]; // TagCell用の配列
	joinedAt: Date;
};

type MemberActionsCellProps = {
	member: MemberRow;
	hasSubOwner: boolean;
	onAssign: (memberId: string) => void;
	onDelete: (memberId: string) => void;
};

export function MemberActionsCell({
	member,
	hasSubOwner,
	onAssign,
	onDelete,
}: MemberActionsCellProps) {
	if (member.role === "OWNER") {
		return null;
	}
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
					{!hasSubOwner && (
						<Button
							intent="ghost"
							size="2"
							onClick={() => onAssign(member.userId)}
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
				</div>
			</Popover.Content>
		</Popover.Root>
	);
}

export const Route = createFileRoute("/project/members/")({
	component: RouteComponent,
});

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

function RouteComponent() {
	const [members, setMembers] = useState<MemberRow[]>([]);

	const [dialogOpen, setDialogOpen] = useState(false);
	const project = useContext(ProjectContext);
	const { user } = useAuthStore();

	useEffect(() => {
		if (!project?.id) return;

		listProjectMembers(project.id).then(data => {
			setMembers(
				data.members.map((m: Omit<MemberRow, "roleLabel">) => ({
					...m,
					roleLabel: [roleLabelMap[m.role]],
				}))
			);
		});
	}, [project?.id]);

	const hasSubOwner = members.some(member => member.role === "SUB_OWNER");

	const isPrivileged =
		project?.ownerId === user?.id || project?.subOwnerId === user?.id;
	const handleAssign = async (memberId: string) => {
		try {
			if (!project?.id) {
				alert("プロジェクト情報が取得できません");
				return;
			}
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
		} catch (err) {
			console.error(err);
			alert("副責任者の任命に失敗しました");
		}
	};

	const handleDeleteMember = async (memberId: string) => {
		try {
			if (!project?.id) {
				alert("プロジェクト情報が取得できません");
				return;
			}
			await removeProjectMember(project.id, memberId);
			setMembers(prev => prev.filter(m => m.userId !== memberId));
		} catch (err) {
			console.error(err);
			alert("メンバーの削除に失敗しました");
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
			cell: info => new Date(info.getValue()).toLocaleDateString(),
		}),
	];

	const memberColumns = isPrivileged
		? [
				...baseColumns,
				memberColumnHelper.display({
					id: "actions",
					header: "",
					cell: ({ row }) => (
						<MemberActionsCell
							member={row.original}
							hasSubOwner={hasSubOwner}
							onAssign={handleAssign}
							onDelete={handleDeleteMember}
						/>
					),
				}),
			]
		: baseColumns;

	return (
		<div className={styles.page}>
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
