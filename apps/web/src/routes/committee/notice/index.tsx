import { Badge, Heading, Text } from "@radix-ui/themes";
import { IconEye, IconPlus } from "@tabler/icons-react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { useState } from "react";
import {
	AvatarGroupCell,
	type AvatarGroupItem,
	DataTable,
	DateCell,
	NameCell,
} from "@/components/patterns";
import { Button } from "@/components/primitives";
import { listNotices } from "@/lib/api/committee-notice";
import {
	getNoticeStatusFromAuth,
	type NoticeStatusInfo,
} from "@/lib/notice-status";
import { CreateNoticeDialog } from "./-components/CreateNoticeDialog";
import styles from "./index.module.scss";

type NoticeRow = {
	id: string;
	ownerId: string;
	title: string;
	owner: { name: string; avatarFileId: string | null };
	collaborators: AvatarGroupItem[];
	updatedAt: Date;
	approver: { name: string; avatarFileId: string | null } | null;
	status: NoticeStatusInfo;
};

const noticeColumnHelper = createColumnHelper<NoticeRow>();

export const Route = createFileRoute("/committee/notice/")({
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "お知らせ管理 | 雙峰祭オンラインシステム" }],
	}),
	loader: async () => {
		const res = await listNotices();
		return {
			notices: res.notices.map(n => ({
				id: n.id,
				ownerId: n.ownerId,
				title: n.title,
				owner: { name: n.owner.name, avatarFileId: n.owner.avatarFileId },
				collaborators: n.collaborators,
				updatedAt: n.updatedAt,
				approver: n.authorization
					? {
							name: n.authorization.requestedTo.name,
							avatarFileId: n.authorization.requestedTo.avatarFileId,
						}
					: null,
				status: getNoticeStatusFromAuth(n.authorization),
			})),
		};
	},
});

function RouteComponent() {
	const { notices } = Route.useLoaderData();
	const router = useRouter();

	const [createDialogOpen, setCreateDialogOpen] = useState(false);

	const columns = [
		noticeColumnHelper.accessor("title", {
			header: "タイトル",
		}),
		noticeColumnHelper.accessor("owner", {
			header: "オーナー",
			cell: NameCell,
			sortingFn: (a, b) =>
				a.original.owner.name.localeCompare(b.original.owner.name),
		}),
		noticeColumnHelper.accessor("collaborators", {
			header: "共同編集者",
			cell: AvatarGroupCell,
		}),
		noticeColumnHelper.accessor("updatedAt", {
			header: "更新日",
			cell: DateCell,
			meta: { dateFormat: "date" },
		}),
		noticeColumnHelper.accessor("status", {
			header: "ステータス",
			cell: ctx => {
				const { label, color } = ctx.getValue();
				return (
					<Badge variant="soft" color={color}>
						{label}
					</Badge>
				);
			},
		}),
		noticeColumnHelper.accessor("approver", {
			header: "承認者",
			cell: ctx => {
				const value = ctx.getValue();
				if (!value)
					return (
						<Text size="2" color="gray">
							—
						</Text>
					);
				return <NameCell {...ctx} />;
			},
			sortingFn: (a, b) =>
				(a.original.approver?.name ?? "").localeCompare(
					b.original.approver?.name ?? ""
				),
		}),
		noticeColumnHelper.display({
			id: "actions",
			header: "操作",
			cell: ({ row }) => (
				<Link
					to="/committee/notice/$noticeId"
					params={{ noticeId: row.original.id }}
				>
					<Button intent="ghost" size="1">
						<IconEye size={16} />
						詳細
					</Button>
				</Link>
			),
			enableSorting: false,
		}),
	];

	return (
		<div>
			<div className={styles.header}>
				<Heading size="6">お知らせ</Heading>
				<Text size="2" color="gray">
					お知らせの管理・配信ができます。
				</Text>
			</div>

			<DataTable<NoticeRow>
				data={notices}
				columns={columns}
				features={{
					sorting: true,
					globalFilter: true,
					columnVisibility: false,
					selection: false,
					copy: false,
					csvExport: false,
				}}
				initialSorting={[{ id: "updatedAt", desc: true }]}
				toolbarExtra={
					<Button
						intent="primary"
						size="2"
						onClick={() => setCreateDialogOpen(true)}
					>
						<IconPlus size={16} stroke={1.5} />
						お知らせを作成
					</Button>
				}
			/>

			<CreateNoticeDialog
				open={createDialogOpen}
				onOpenChange={setCreateDialogOpen}
				onSuccess={() => router.invalidate()}
			/>
		</div>
	);
}
