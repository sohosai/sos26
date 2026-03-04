import { AlertDialog, Heading } from "@radix-ui/themes";
import { IconPlus, IconTrash, IconUserUp, IconX } from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DataTable, TagCell } from "@/components/patterns";
import {
	type ActionItem,
	ActionsMenu,
} from "@/components/patterns/ActionMenu/ActionMenu";
import { Button } from "@/components/primitives";
import { InviteMemberDialog } from "@/components/project/members/InviteMemberDialog";
import {
	approveSubOwnerRequest,
	assignSubOwner,
	cancelSubOwnerRequest,
	listProjectMembers,
	rejectSubOwnerRequest,
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

const pendingSubOwnerLabel = "副責任者承認待ち";

const buildMemberActions = (
	member: MemberRow,
	isPrivileged: boolean,
	isOwner: boolean,
	hasSubOwner: boolean,
	hasPendingSubOwnerRequest: boolean,
	pendingSubOwnerRequestUserId: string | null,
	onAssign: (id: string) => void,
	onDelete: (id: string) => void,
	onCancelSubOwnerRequest: () => void
): ActionItem<MemberRow>[] => [
	{
		key: "assign-sub-owner",
		label: "副責任者に指名",
		icon: <IconUserUp size={16} />,
		hidden:
			!isPrivileged ||
			member.role !== "MEMBER" ||
			hasSubOwner ||
			hasPendingSubOwnerRequest,
		onClick: m => onAssign(m.userId),
	},
	{
		key: "delete-member",
		label: "削除",
		icon: <IconTrash size={16} />,
		hidden: !isPrivileged || member.role !== "MEMBER",
		onClick: m => onDelete(m.userId),
	},
	{
		key: "cancel-sub-owner-request",
		label: "副責任者リクエスト取り消し",
		icon: <IconX size={16} />,
		hidden:
			!isOwner ||
			pendingSubOwnerRequestUserId !== member.userId ||
			member.role !== "MEMBER",
		onClick: () => onCancelSubOwnerRequest(),
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
	副責任者承認待ち: "orange",
	メンバー: "gray",
};

const memberColumnHelper = createColumnHelper<MemberRow>();

export const Route = createFileRoute("/project/members/")({
	component: RouteComponent,
	loader: async () => {
		const { selectedProjectId } = useProjectStore.getState();
		if (!selectedProjectId) {
			return {
				members: [] as MemberRow[],
				pendingSubOwnerRequestUserId: null as string | null,
			};
		}

		const data = await listProjectMembers(selectedProjectId);
		return {
			members: data.members.map((m: Omit<MemberRow, "roleLabel">) => {
				const roleLabel =
					m.role === "MEMBER" && data.pendingSubOwnerRequestUserId === m.userId
						? pendingSubOwnerLabel
						: roleLabelMap[m.role];
				return {
					...m,
					roleLabel: [roleLabel],
				};
			}),
			pendingSubOwnerRequestUserId: data.pendingSubOwnerRequestUserId,
		};
	},
});

function RouteComponent() {
	const {
		members: initialMembers,
		pendingSubOwnerRequestUserId: initialPendingSubOwnerRequestUserId,
	} = Route.useLoaderData();
	const [members, setMembers] = useState<MemberRow[]>(initialMembers);
	const [pendingSubOwnerRequestUserId, setPendingSubOwnerRequestUserId] =
		useState<string | null>(initialPendingSubOwnerRequestUserId);

	useEffect(() => {
		setMembers(initialMembers);
		setPendingSubOwnerRequestUserId(initialPendingSubOwnerRequestUserId);
	}, [initialMembers, initialPendingSubOwnerRequestUserId]);

	const [dialogOpen, setDialogOpen] = useState(false);
	const [subOwnerRequestDialogOpen, setSubOwnerRequestDialogOpen] =
		useState(false);

	const project = useProject();
	const { user } = useAuthStore();

	useEffect(() => {
		const hasOwnPendingRequest = pendingSubOwnerRequestUserId === user?.id;
		setSubOwnerRequestDialogOpen(hasOwnPendingRequest);
	}, [pendingSubOwnerRequestUserId, user?.id]);

	const hasSubOwner = members.some(member => member.role === "SUB_OWNER");
	const hasPendingSubOwnerRequest = pendingSubOwnerRequestUserId !== null;

	const isPrivileged =
		project.ownerId === user?.id || project.subOwnerId === user?.id;
	const isOwner = project.ownerId === user?.id;

	const pendingRequestedByName = useMemo(() => {
		if (pendingSubOwnerRequestUserId !== user?.id) return null;
		const owner = members.find(m => m.userId === project.ownerId);
		return owner?.name ?? null;
	}, [members, pendingSubOwnerRequestUserId, project.ownerId, user?.id]);

	const handleAssign = async (memberId: string) => {
		try {
			await assignSubOwner(project.id, memberId);
			setPendingSubOwnerRequestUserId(memberId);
			setMembers(prev =>
				prev.map(m => ({
					...m,
					roleLabel: [
						m.role === "MEMBER" && m.userId === memberId
							? pendingSubOwnerLabel
							: roleLabelMap[m.role],
					],
				}))
			);
			toast.success("副責任者の確認待ちにしました");
		} catch {
			toast.error("副責任者の任命に失敗しました");
		}
	};

	const handleApproveSubOwnerRequest = async () => {
		try {
			await approveSubOwnerRequest(project.id);
			setSubOwnerRequestDialogOpen(false);
			setPendingSubOwnerRequestUserId(null);
			setMembers(prev =>
				prev.map(m => {
					if (m.userId === user?.id) {
						return {
							...m,
							role: "SUB_OWNER" as const,
							roleLabel: [roleLabelMap.SUB_OWNER],
						};
					}
					return {
						...m,
						roleLabel: [roleLabelMap[m.role]],
					};
				})
			);
			toast.success("副責任者リクエストを承認しました");
		} catch {
			toast.error("副責任者リクエストの承認に失敗しました");
		}
	};

	const handleCancelSubOwnerRequest = async () => {
		try {
			await cancelSubOwnerRequest(project.id);
			setPendingSubOwnerRequestUserId(null);
			setMembers(prev =>
				prev.map(m => ({
					...m,
					roleLabel: [roleLabelMap[m.role]],
				}))
			);
			toast.success("副責任者リクエストを取り消しました");
		} catch {
			toast.error("副責任者リクエストの取り消しに失敗しました");
		}
	};

	const handleRejectSubOwnerRequest = async () => {
		try {
			await rejectSubOwnerRequest(project.id);
			setSubOwnerRequestDialogOpen(false);
			setPendingSubOwnerRequestUserId(null);
			setMembers(prev =>
				prev.map(m => ({
					...m,
					roleLabel: [roleLabelMap[m.role]],
				}))
			);
			toast.success("副責任者リクエストを辞退しました");
		} catch {
			toast.error("副責任者リクエストの辞退に失敗しました");
		}
	};

	const handleDeleteMember = async (memberId: string) => {
		try {
			await removeProjectMember(project.id, memberId);
			setMembers(prev => prev.filter(m => m.userId !== memberId));
			if (pendingSubOwnerRequestUserId === memberId) {
				setPendingSubOwnerRequestUserId(null);
			}
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
								isPrivileged,
								isOwner,
								hasSubOwner,
								hasPendingSubOwnerRequest,
								pendingSubOwnerRequestUserId,
								handleAssign,
								handleDeleteMember,
								handleCancelSubOwnerRequest
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

			<AlertDialog.Root
				open={subOwnerRequestDialogOpen}
				onOpenChange={setSubOwnerRequestDialogOpen}
			>
				<AlertDialog.Content maxWidth="420px">
					<AlertDialog.Title>副責任者リクエストの確認</AlertDialog.Title>
					<AlertDialog.Description size="2">
						{pendingRequestedByName
							? `${pendingRequestedByName} さんから副責任者リクエストが届いています。承認または辞退を選択してください。`
							: "副責任者リクエストが届いています。承認または辞退を選択してください。"}
					</AlertDialog.Description>
					<div
						style={{
							display: "flex",
							justifyContent: "flex-end",
							gap: "8px",
							marginTop: "16px",
						}}
					>
						<Button
							intent="secondary"
							size="2"
							onClick={handleRejectSubOwnerRequest}
						>
							辞退する
						</Button>
						<Button
							intent="primary"
							size="2"
							onClick={handleApproveSubOwnerRequest}
						>
							承認する
						</Button>
					</div>
				</AlertDialog.Content>
			</AlertDialog.Root>
		</div>
	);
}
