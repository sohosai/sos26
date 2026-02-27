import { AlertDialog, Heading, Text } from "@radix-ui/themes";
import {
	type Bureau,
	bureauLabelMap,
	type CommitteePermission,
} from "@sos26/shared";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DataTable, NameCell, TagCell } from "@/components/patterns";
import { Button } from "@/components/primitives";
import {
	createCommitteeMember,
	deleteCommitteeMember,
	grantCommitteeMemberPermission,
	listCommitteeMembers,
	revokeCommitteeMemberPermission,
} from "@/lib/api/committee-member";
import { useAuthStore } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { AddMemberDialog } from "./-components/AddMemberDialog";
import styles from "./index.module.scss";

// ─────────────────────────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────────────────────────

type CommitteeMemberRow = {
	id: string;
	userId: string;
	name: string;
	email: string;
	bureau: string[];
	permissions: CommitteePermission[];
	isExecutive: boolean;
	joinedAt: Date;
};

const permissionLabelMap: Record<CommitteePermission, string> = {
	MEMBER_EDIT: "メンバー編集",
	NOTICE_DELIVER: "お知らせ配信",
	NOTICE_APPROVE: "お知らせ承認",
	FORM_DELIVER: "フォーム配信",
	INQUIRY_ADMIN: "お問い合わせ管理",
};

const bureauColorMap: Record<string, string> = {
	財務局: "red",
	総務局: "orange",
	広報宣伝局: "yellow",
	渉外局: "green",
	推進局: "teal",
	総合計画局: "blue",
	ステージ管理局: "purple",
	本部企画局: "pink",
	情報メディアシステム局: "indigo",
	案内所運営部会: "gray",
};

// ─────────────────────────────────────────────────────────────
// 権限トグルセル
// ─────────────────────────────────────────────────────────────

type PermissionsCellProps = {
	member: CommitteeMemberRow;
	onToggle: (
		memberId: string,
		permission: CommitteePermission,
		currently: boolean
	) => void;
};

function PermissionsCell({ member, onToggle }: PermissionsCellProps) {
	const allPermissions: CommitteePermission[] = [
		"MEMBER_EDIT",
		"NOTICE_DELIVER",
		"NOTICE_APPROVE",
		"FORM_DELIVER",
		"INQUIRY_ADMIN",
	];

	return (
		<div className={styles.permissionList}>
			{allPermissions.map(perm => {
				const has = member.permissions.includes(perm);
				return (
					<button
						key={perm}
						type="button"
						className={`${styles.permissionToggle} ${has ? styles.active : ""}`}
						onClick={() => onToggle(member.id, perm, has)}
					>
						{permissionLabelMap[perm]}
					</button>
				);
			})}
		</div>
	);
}

// ─────────────────────────────────────────────────────────────
// アクションセル
// ─────────────────────────────────────────────────────────────

type MemberActionsCellProps = {
	member: CommitteeMemberRow;
	currentUserId: string;
	onDelete: (memberId: string) => void;
};

function MemberActionsCell({
	member,
	currentUserId,
	onDelete,
}: MemberActionsCellProps) {
	// 自分自身は削除できない
	if (member.userId === currentUserId) {
		return null;
	}

	return (
		<Button intent="ghost" size="1" onClick={() => onDelete(member.id)}>
			<IconTrash size={16} />
			削除
		</Button>
	);
}

// ─────────────────────────────────────────────────────────────
// ルート定義
// ─────────────────────────────────────────────────────────────

const memberColumnHelper = createColumnHelper<CommitteeMemberRow>();

export const Route = createFileRoute("/committee/members/")({
	component: RouteComponent,
	loader: async () => {
		const { user } = useAuthStore.getState();
		const data = await listCommitteeMembers();

		const me = data.committeeMembers.find(m => m.userId === user?.id);
		const hasMemberEdit = me?.permissions.some(
			p => p.permission === "MEMBER_EDIT"
		);

		if (!hasMemberEdit) {
			throw redirect({ to: "/forbidden" });
		}

		return {
			members: data.committeeMembers.map(m => ({
				id: m.id,
				userId: m.userId,
				name: m.user.name,
				email: m.user.email,
				bureau: [bureauLabelMap[m.Bureau as Bureau]],
				permissions: m.permissions.map(p => p.permission),
				isExecutive: m.isExecutive,
				joinedAt: new Date(m.joinedAt),
			})),
		};
	},
});

function RouteComponent() {
	const { members: initialMembers } = Route.useLoaderData();
	const [members, setMembers] = useState<CommitteeMemberRow[]>(initialMembers);
	const { user } = useAuthStore();
	const [selfRevokeConfirmOpen, setSelfRevokeConfirmOpen] = useState(false);
	const [pendingRevoke, setPendingRevoke] = useState<{
		memberId: string;
		permission: CommitteePermission;
	} | null>(null);
	const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
	const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
	const [addMemberOpen, setAddMemberOpen] = useState(false);

	useEffect(() => {
		setMembers(initialMembers);
	}, [initialMembers]);

	const executeToggle = async (
		memberId: string,
		permission: CommitteePermission,
		currentlyHas: boolean
	) => {
		try {
			if (currentlyHas) {
				await revokeCommitteeMemberPermission(memberId, permission);
			} else {
				await grantCommitteeMemberPermission(memberId, { permission });
			}

			setMembers(prev =>
				prev.map(m => {
					if (m.id !== memberId) return m;
					return {
						...m,
						permissions: currentlyHas
							? m.permissions.filter(p => p !== permission)
							: [...m.permissions, permission],
					};
				})
			);
		} catch {
			toast.error("権限の変更に失敗しました");
		}
	};

	const handleTogglePermission = async (
		memberId: string,
		permission: CommitteePermission,
		currentlyHas: boolean
	) => {
		// 自分自身から MEMBER_EDIT を外す場合は確認ダイアログを表示
		const member = members.find(m => m.id === memberId);
		if (
			currentlyHas &&
			permission === "MEMBER_EDIT" &&
			member?.userId === user?.id
		) {
			setPendingRevoke({ memberId, permission });
			setSelfRevokeConfirmOpen(true);
			return;
		}

		await executeToggle(memberId, permission, currentlyHas);
	};

	const handleConfirmSelfRevoke = async () => {
		if (!pendingRevoke) return;
		await executeToggle(pendingRevoke.memberId, pendingRevoke.permission, true);
		setSelfRevokeConfirmOpen(false);
		setPendingRevoke(null);
	};

	const handleDeleteClick = (memberId: string) => {
		setPendingDeleteId(memberId);
		setDeleteConfirmOpen(true);
	};

	const handleConfirmDelete = async () => {
		if (!pendingDeleteId) return;
		try {
			await deleteCommitteeMember(pendingDeleteId);
			setMembers(prev => prev.filter(m => m.id !== pendingDeleteId));
			toast.success("メンバーを削除しました");
		} catch {
			toast.error("メンバーの削除に失敗しました");
		} finally {
			setDeleteConfirmOpen(false);
			setPendingDeleteId(null);
		}
	};

	const handleAddMember = async (body: {
		userId: string;
		Bureau: Bureau;
		isExecutive?: boolean;
	}) => {
		const result = await createCommitteeMember(body);
		// リストを再取得して反映
		const data = await listCommitteeMembers();
		setMembers(
			data.committeeMembers.map(m => ({
				id: m.id,
				userId: m.userId,
				name: m.user.name,
				email: m.user.email,
				bureau: [bureauLabelMap[m.Bureau as Bureau]],
				permissions: m.permissions.map(p => p.permission),
				isExecutive: m.isExecutive,
				joinedAt: new Date(m.joinedAt),
			}))
		);
		return result;
	};

	const columns = [
		memberColumnHelper.accessor("name", {
			header: "名前",
			cell: NameCell,
		}),
		memberColumnHelper.accessor("email", {
			header: "メールアドレス",
		}),
		memberColumnHelper.accessor("bureau", {
			header: "所属局",
			cell: TagCell,
			meta: {
				tagColors: bureauColorMap,
			},
		}),
		memberColumnHelper.display({
			id: "permissions",
			header: "権限",
			cell: ({ row }) => (
				<PermissionsCell
					member={row.original}
					onToggle={handleTogglePermission}
				/>
			),
		}),
		memberColumnHelper.accessor("joinedAt", {
			header: "参加日",
			cell: info => formatDate(new Date(info.getValue()), "date"),
		}),
		memberColumnHelper.display({
			id: "actions",
			header: "操作",
			cell: ({ row }) => (
				<MemberActionsCell
					member={row.original}
					currentUserId={user?.id ?? ""}
					onDelete={handleDeleteClick}
				/>
			),
			enableSorting: false,
		}),
	];

	return (
		<div>
			<div className={styles.header}>
				<Heading size="6">実委人メンバー管理</Heading>
				<Text size="2" color="gray">
					実委人メンバーの追加・権限編集・削除ができます。
				</Text>
			</div>

			<DataTable<CommitteeMemberRow>
				data={members}
				columns={columns}
				features={{ selection: false, columnVisibility: false }}
				initialSorting={[
					{
						id: "joinedAt",
						desc: false,
					},
				]}
				toolbarExtra={
					<Button
						intent="primary"
						size="2"
						onClick={() => setAddMemberOpen(true)}
					>
						<IconPlus size={16} />
						メンバーを追加
					</Button>
				}
			/>

			{/* 自分からメンバー編集権限を外す確認ダイアログ */}
			<AlertDialog.Root
				open={selfRevokeConfirmOpen}
				onOpenChange={setSelfRevokeConfirmOpen}
			>
				<AlertDialog.Content maxWidth="400px">
					<AlertDialog.Title>権限の削除</AlertDialog.Title>
					<AlertDialog.Description size="2">
						自分自身から「メンバー編集」権限を外すと、このページにアクセスできなくなります。本当に実行しますか？
					</AlertDialog.Description>
					<div className={styles.confirmActions}>
						<AlertDialog.Cancel>
							<Button intent="secondary" size="2">
								キャンセル
							</Button>
						</AlertDialog.Cancel>
						<Button intent="danger" size="2" onClick={handleConfirmSelfRevoke}>
							権限を削除する
						</Button>
					</div>
				</AlertDialog.Content>
			</AlertDialog.Root>

			{/* メンバー削除確認ダイアログ */}
			<AlertDialog.Root
				open={deleteConfirmOpen}
				onOpenChange={setDeleteConfirmOpen}
			>
				<AlertDialog.Content maxWidth="400px">
					<AlertDialog.Title>メンバーの削除</AlertDialog.Title>
					<AlertDialog.Description size="2">
						このメンバーを削除しますか？削除すると、付与されている権限もすべて失われます。
					</AlertDialog.Description>
					<div className={styles.confirmActions}>
						<AlertDialog.Cancel>
							<Button intent="secondary" size="2">
								キャンセル
							</Button>
						</AlertDialog.Cancel>
						<Button intent="danger" size="2" onClick={handleConfirmDelete}>
							削除する
						</Button>
					</div>
				</AlertDialog.Content>
			</AlertDialog.Root>

			{/* メンバー追加ダイアログ */}
			<AddMemberDialog
				open={addMemberOpen}
				onOpenChange={setAddMemberOpen}
				onSubmit={handleAddMember}
			/>
		</div>
	);
}
