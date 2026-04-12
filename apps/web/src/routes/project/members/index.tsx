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
import { reportHandledError } from "@/lib/error/report";
import { formatDate } from "@/lib/format";
import { useProject, useProjectStore } from "@/lib/project/store";
import styles from "./index.module.scss";

export type MemberRow = {
	userId: string;
	name: string;
	email: string | null;
	role: "OWNER" | "SUB_OWNER" | "MEMBER";
	roleLabel: string[];
	joinedAt: Date;
};

const pendingSubOwnerLabel = "副企画責任者承認待ち";

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
		label: "副企画責任者に指名",
		icon: <IconUserUp size={16} />,
		hidden:
			!isOwner ||
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
		label: "副企画責任者リクエスト取り消し",
		icon: <IconX size={16} />,
		hidden:
			!isOwner ||
			pendingSubOwnerRequestUserId !== member.userId ||
			member.role !== "MEMBER",
		onClick: () => onCancelSubOwnerRequest(),
	},
];

const roleLabelMap: Record<MemberRow["role"], string> = {
	OWNER: "企画責任者",
	SUB_OWNER: "副企画責任者",
	MEMBER: "メンバー",
};

const roleColorMap: Record<string, string> = {
	企画責任者: "red",
	副企画責任者: "orange",
	副企画責任者承認待ち: "orange",
	メンバー: "gray",
};

const memberColumnHelper = createColumnHelper<MemberRow>();

export const Route = createFileRoute("/project/members/")({
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "メンバー管理 | 雙峰祭オンラインシステム" }],
	}),
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
	const [isApprovingSubOwnerRequest, setIsApprovingSubOwnerRequest] =
		useState(false);
	const [isRejectingSubOwnerRequest, setIsRejectingSubOwnerRequest] =
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
			toast.success("副企画責任者の確認待ちにしました");
		} catch (error) {
			reportHandledError({
				error,
				operation: "submit",
				userMessage: "副企画責任者の任命に失敗しました",
				ui: { type: "toast" },
				context: {
					projectId: project.id,
					memberId,
				},
			});
		}
	};

	const handleApproveSubOwnerRequest = async () => {
		setIsApprovingSubOwnerRequest(true);
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
			toast.success("副企画責任者リクエストを承認しました");
		} catch (error) {
			reportHandledError({
				error,
				operation: "approve",
				userMessage: "副企画責任者リクエストの承認に失敗しました",
				ui: { type: "toast" },
				context: {
					projectId: project.id,
				},
			});
		} finally {
			setIsApprovingSubOwnerRequest(false);
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
			toast.success("副企画責任者リクエストを取り消しました");
		} catch (error) {
			reportHandledError({
				error,
				operation: "reject",
				userMessage: "副企画責任者リクエストの取り消しに失敗しました",
				ui: { type: "toast" },
				context: {
					projectId: project.id,
				},
			});
		}
	};

	const handleRejectSubOwnerRequest = async () => {
		setIsRejectingSubOwnerRequest(true);
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
			toast.success("副企画責任者リクエストを辞退しました");
		} catch (error) {
			reportHandledError({
				error,
				operation: "reject",
				userMessage: "副企画責任者リクエストの辞退に失敗しました",
				ui: { type: "toast" },
				context: {
					projectId: project.id,
				},
			});
		} finally {
			setIsRejectingSubOwnerRequest(false);
		}
	};

	const handleDeleteMember = async (memberId: string) => {
		try {
			await removeProjectMember(project.id, memberId);
			setMembers(prev => prev.filter(m => m.userId !== memberId));
			if (pendingSubOwnerRequestUserId === memberId) {
				setPendingSubOwnerRequestUserId(null);
			}
		} catch (error) {
			reportHandledError({
				error,
				operation: "delete",
				userMessage: "メンバーの削除に失敗しました",
				ui: { type: "toast" },
				context: {
					projectId: project.id,
					memberId,
				},
			});
		}
	};

	const baseColumns = [
		memberColumnHelper.accessor("name", {
			header: "名前",
		}),
		memberColumnHelper.accessor("email", {
			header: "メールアドレス",
			cell: info => {
				return info.getValue() ?? "非表示";
			},
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
					header: "操作",
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
			<div className={styles.pageHeader}>
				<Heading size="6">メンバー管理</Heading>
				<Button intent="primary" size="2" onClick={() => setDialogOpen(true)}>
					<IconPlus size={16} stroke={1.5} />
					メンバーを追加
				</Button>
			</div>

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
			/>

			<InviteMemberDialog open={dialogOpen} onOpenChange={setDialogOpen} />

			{/* ユーザーに承認/辞退を明示的に選択させるため、ESC・オーバーレイクリックでは閉じない */}
			<AlertDialog.Root open={subOwnerRequestDialogOpen}>
				<AlertDialog.Content maxWidth="420px">
					<AlertDialog.Title>副企画責任者リクエストの確認</AlertDialog.Title>
					<AlertDialog.Description size="2">
						{pendingRequestedByName
							? `${pendingRequestedByName} さんから副企画責任者リクエストが届いています。承認または辞退を選択してください。`
							: "副企画責任者リクエストが届いています。承認または辞退を選択してください。"}
					</AlertDialog.Description>
					<div className={styles.dialogActions}>
						<Button
							intent="secondary"
							size="2"
							onClick={handleRejectSubOwnerRequest}
							loading={isRejectingSubOwnerRequest}
							disabled={isApprovingSubOwnerRequest}
						>
							辞退する
						</Button>
						<Button
							intent="primary"
							size="2"
							onClick={handleApproveSubOwnerRequest}
							loading={isApprovingSubOwnerRequest}
							disabled={isRejectingSubOwnerRequest}
						>
							承認する
						</Button>
					</div>
				</AlertDialog.Content>
			</AlertDialog.Root>
		</div>
	);
}
