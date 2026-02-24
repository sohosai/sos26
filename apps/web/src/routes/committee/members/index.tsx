import { Heading, Text } from "@radix-ui/themes";
import {
	type Bureau,
	bureauLabelMap,
	type CommitteePermission,
} from "@sos26/shared";
import { IconTrash } from "@tabler/icons-react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DataTable, NameCell, TagCell } from "@/components/patterns";
import { Button } from "@/components/primitives";
import {
	deleteCommitteeMember,
	grantCommitteeMemberPermission,
	listCommitteeMembers,
	revokeCommitteeMemberPermission,
} from "@/lib/api/committee-member";
import { useAuthStore } from "@/lib/auth";
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
	beforeLoad: async () => {
		const { user } = useAuthStore.getState();
		if (!user) return;

		const data = await listCommitteeMembers();
		const me = data.committeeMembers.find(m => m.userId === user.id);

		const hasMemberEdit = me?.permissions.some(
			p => p.permission === "MEMBER_EDIT"
		);

		if (!hasMemberEdit) {
			throw redirect({ to: "/forbidden" });
		}
	},
	loader: async () => {
		const data = await listCommitteeMembers();
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

	useEffect(() => {
		setMembers(initialMembers);
	}, [initialMembers]);

	const handleTogglePermission = async (
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

	const handleDelete = async (memberId: string) => {
		try {
			await deleteCommitteeMember(memberId);
			setMembers(prev => prev.filter(m => m.id !== memberId));
			toast.success("メンバーを削除しました");
		} catch {
			toast.error("メンバーの削除に失敗しました");
		}
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
			cell: info => new Date(info.getValue()).toLocaleDateString(),
		}),
		memberColumnHelper.display({
			id: "actions",
			header: "操作",
			cell: ({ row }) => (
				<MemberActionsCell
					member={row.original}
					currentUserId={user?.id ?? ""}
					onDelete={handleDelete}
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
					実委人メンバーの権限編集・削除ができます。
				</Text>
			</div>

			<DataTable<CommitteeMemberRow>
				data={members}
				columns={columns}
				features={{
					sorting: true,
					globalFilter: true,
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
		</div>
	);
}
