import {
	AlertDialog,
	Badge,
	type BadgeProps,
	Checkbox,
	Heading,
	Popover,
	Text,
	Tooltip,
} from "@radix-ui/themes";
import {
	type Bureau,
	bureauLabelMap,
	bureauSchema,
	type CommitteePermission,
	committeePermissionSchema,
} from "@sos26/shared";
import {
	IconCheck,
	IconChevronDown,
	IconPlus,
	IconTrash,
} from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { DataTable, NameCell } from "@/components/patterns";
import { Button } from "@/components/primitives";
import {
	createCommitteeMember,
	deleteCommitteeMember,
	grantCommitteeMemberPermission,
	listCommitteeMembers,
	revokeCommitteeMemberPermission,
	updateCommitteeMember,
} from "@/lib/api/committee-member";
import { ForbiddenError, useAuthStore } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { isClientError } from "@/lib/http/error";
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
	bureau: Bureau;
	permissions: CommitteePermission[];
	isExecutive: boolean;
	joinedAt: Date;
	avatarFileId: string | null;
};

const permissionLabelMap: Record<CommitteePermission, string> = {
	MEMBER_EDIT: "メンバー編集",
	NOTICE_DELIVER: "お知らせ配信",
	FORM_DELIVER: "申請配信",
	INQUIRY_ADMIN: "お問い合わせ管理",
	PROJECT_EDIT: "企画編集",
	PROJECT_DELETE: "企画削除",
	PROJECT_VIEW: "企画閲覧",
	PROJECT_REGISTRATION_FORM_CREATE: "企画登録フォーム作成",
	PROJECT_REGISTRATION_FORM_DELIVER: "企画登録フォーム配信",
};

const bureauColorMap: Partial<Record<Bureau, BadgeProps["color"]>> = {
	FINANCE: "red",
	GENERAL_AFFAIRS: "orange",
	PUBLIC_RELATIONS: "yellow",
	EXTERNAL: "green",
	PROMOTION: "teal",
	PLANNING: "blue",
	STAGE_MANAGEMENT: "purple",
	HQ_PLANNING: "pink",
	INFO_SYSTEM: "indigo",
};

// ─────────────────────────────────────────────────────────────
// 所属局セレクトセル
// ─────────────────────────────────────────────────────────────

const allBureaus = bureauSchema.options;

type BureauCellProps = {
	member: CommitteeMemberRow;
	onChange: (memberId: string, bureau: Bureau) => void;
};

function BureauCell({ member, onChange }: BureauCellProps) {
	const [open, setOpen] = useState(false);

	return (
		<Popover.Root
			open={open}
			onOpenChange={newOpen => {
				if (newOpen) setOpen(true);
			}}
		>
			<Popover.Trigger>
				<button type="button" className={styles.bureauTrigger}>
					<Badge
						size="1"
						variant="soft"
						className={
							member.bureau === "EXECUTIVE_BOARD"
								? styles.executiveBoardBadge
								: undefined
						}
						color={
							member.bureau === "EXECUTIVE_BOARD"
								? undefined
								: ((bureauColorMap[member.bureau] as BadgeProps["color"]) ??
									"gray")
						}
					>
						{bureauLabelMap[member.bureau]}
					</Badge>
					<IconChevronDown size={14} className={styles.chevron} />
				</button>
			</Popover.Trigger>
			<Popover.Content
				size="1"
				className={styles.bureauDropdown}
				onPointerDownOutside={() => setOpen(false)}
				onEscapeKeyDown={() => setOpen(false)}
			>
				{allBureaus.map(bureau => {
					const isSelected = member.bureau === bureau;
					return (
						<button
							type="button"
							key={bureau}
							className={styles.bureauOption}
							onClick={() => {
								if (!isSelected) {
									onChange(member.id, bureau);
								}
								setOpen(false);
							}}
						>
							<span className={styles.bureauCheckIcon}>
								{isSelected && <IconCheck size={14} />}
							</span>
							<Text size="2">{bureauLabelMap[bureau]}</Text>
						</button>
					);
				})}
			</Popover.Content>
		</Popover.Root>
	);
}

// ─────────────────────────────────────────────────────────────
// 権限マルチセレクトセル
// ─────────────────────────────────────────────────────────────

const allPermissions = committeePermissionSchema.options;

const MAX_VISIBLE_BADGES = 2;

type PermissionsCellProps = {
	member: CommitteeMemberRow;
	onToggle: (
		memberId: string,
		permission: CommitteePermission,
		currently: boolean
	) => void;
};

function PermissionsCell({ member, onToggle }: PermissionsCellProps) {
	const [open, setOpen] = useState(false);

	const handleToggle = useCallback(
		(perm: CommitteePermission, has: boolean) => {
			onToggle(member.id, perm, has);
		},
		[onToggle, member.id]
	);

	const visiblePerms = member.permissions.slice(0, MAX_VISIBLE_BADGES);
	const hiddenPerms = member.permissions.slice(MAX_VISIBLE_BADGES);
	const hiddenCount = hiddenPerms.length;

	const trigger = (
		<Popover.Trigger>
			<button type="button" className={styles.permissionTrigger}>
				{member.permissions.length > 0 ? (
					<span className={styles.permissionBadges}>
						{visiblePerms.map(perm => (
							<Badge key={perm} size="1" variant="soft">
								{permissionLabelMap[perm]}
							</Badge>
						))}
						{hiddenCount > 0 && (
							<Tooltip
								content={hiddenPerms.map(p => permissionLabelMap[p]).join("、")}
								side="top"
							>
								<Badge size="1" variant="soft" color="gray">
									+{hiddenCount}
								</Badge>
							</Tooltip>
						)}
					</span>
				) : (
					<Text size="1" color="gray">
						なし
					</Text>
				)}
				<IconChevronDown size={14} className={styles.chevron} />
			</button>
		</Popover.Trigger>
	);

	return (
		<Popover.Root
			open={open}
			onOpenChange={newOpen => {
				// トリガークリックによる開閉のみ許可し、内部操作での閉じを防ぐ
				if (newOpen) setOpen(true);
			}}
		>
			{trigger}
			<Popover.Content
				size="1"
				className={styles.permissionDropdown}
				onPointerDownOutside={() => setOpen(false)}
				onEscapeKeyDown={() => setOpen(false)}
			>
				{allPermissions.map(perm => {
					const has = member.permissions.includes(perm);
					return (
						<button
							type="button"
							key={perm}
							className={styles.permissionOption}
							onClick={() => handleToggle(perm, has)}
						>
							<Checkbox size="1" checked={has} tabIndex={-1} />
							<Text size="2">{permissionLabelMap[perm]}</Text>
						</button>
					);
				})}
			</Popover.Content>
		</Popover.Root>
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
	head: () => ({
		meta: [{ title: "メンバー管理 | 雙峰祭オンラインシステム" }],
	}),
	loader: async () => {
		const { user } = useAuthStore.getState();
		const data = await listCommitteeMembers();

		const me = data.committeeMembers.find(m => m.userId === user?.id);
		const hasMemberEdit = me?.permissions.some(
			p => p.permission === "MEMBER_EDIT"
		);

		if (!hasMemberEdit) {
			throw new ForbiddenError();
		}

		return {
			members: data.committeeMembers.map(m => ({
				id: m.id,
				userId: m.userId,
				name: m.user.name,
				email: m.user.email,
				bureau: m.Bureau as Bureau,
				permissions: m.permissions.map(p => p.permission),
				isExecutive: m.isExecutive,
				joinedAt: new Date(m.joinedAt),
				avatarFileId: m.user.avatarFileId,
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

	const handleBureauChange = async (memberId: string, bureau: Bureau) => {
		try {
			await updateCommitteeMember(memberId, { Bureau: bureau });
			setMembers(prev =>
				prev.map(m => (m.id === memberId ? { ...m, bureau } : m))
			);
		} catch (error) {
			toast.error(
				isClientError(error)
					? (error as Error).message
					: "所属局の変更に失敗しました"
			);
		}
	};

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
		} catch (error) {
			toast.error(
				isClientError(error)
					? (error as Error).message
					: "権限の変更に失敗しました"
			);
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
		} catch (error) {
			toast.error(
				isClientError(error)
					? (error as Error).message
					: "メンバーの削除に失敗しました"
			);
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
				bureau: m.Bureau as Bureau,
				permissions: m.permissions.map(p => p.permission),
				isExecutive: m.isExecutive,
				joinedAt: new Date(m.joinedAt),
				avatarFileId: m.user.avatarFileId,
			}))
		);
		return result;
	};

	const columns = [
		memberColumnHelper.accessor(
			row => ({ name: row.name, avatarFileId: row.avatarFileId }),
			{
				id: "name",
				header: "名前",
				cell: NameCell,
			}
		),
		memberColumnHelper.accessor("email", {
			header: "メールアドレス",
		}),
		memberColumnHelper.display({
			id: "bureau",
			header: "所属局",
			cell: ({ row }) => (
				<BureauCell member={row.original} onChange={handleBureauChange} />
			),
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
				<Heading size="6">メンバー管理</Heading>
				<Text size="2" color="gray">
					実委人メンバーの追加・権限編集・削除ができます。
				</Text>
			</div>

			<DataTable<CommitteeMemberRow>
				data={members}
				columns={columns}
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
				excludeUserIds={members.map(m => m.userId)}
			/>
		</div>
	);
}
