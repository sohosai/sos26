import { Heading, Text } from "@radix-ui/themes";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/primitives";
import { SupportDetail } from "@/components/support/SupportDetail";
import {
	addCommitteeInquiryAssignee,
	addCommitteeInquiryComment,
	getCommitteeInquiry,
	removeCommitteeInquiryAssignee,
	reopenCommitteeInquiry,
	updateCommitteeInquiryStatus,
	updateCommitteeInquiryViewers,
} from "@/lib/api/committee-inquiry";
import {
	listCommitteeMemberPermissions,
	listCommitteeMembers,
} from "@/lib/api/committee-member";
import { listCommitteeProjectMembers } from "@/lib/api/committee-project";
import { useAuthStore } from "@/lib/auth";

export const Route = createFileRoute("/committee/support/$inquiryId")({
	component: CommitteeSupportDetailPage,
	head: () => ({
		meta: [
			{ title: "お問い合わせ詳細 | 雙峰祭オンラインシステム" },
			{ name: "description", content: "お問い合わせ詳細" },
		],
	}),
	loader: async ({ params }) => {
		const { committeeMember } = useAuthStore.getState();
		const inquiryRes = await getCommitteeInquiry(params.inquiryId);
		const [membersRes, projectMembersRes] = await Promise.all([
			listCommitteeMembers(),
			listCommitteeProjectMembers(inquiryRes.inquiry.projectId),
		]);

		// INQUIRY_ADMIN 権限チェック
		let isAdmin = false;
		if (committeeMember) {
			try {
				const permRes = await listCommitteeMemberPermissions(
					committeeMember.id
				);
				isAdmin = permRes.permissions.some(
					p => p.permission === "INQUIRY_ADMIN"
				);
			} catch {
				// 権限取得失敗時は管理者でない扱い
			}
		}

		return {
			inquiry: inquiryRes.inquiry,
			committeeMembers: membersRes.committeeMembers.map(m => ({
				id: m.user.id,
				name: m.user.name,
			})),
			projectMembers: projectMembersRes.members.map(m => ({
				id: m.userId,
				name: m.name,
			})),
			isAdmin,
		};
	},
});

function CommitteeSupportDetailPage() {
	const { inquiryId } = Route.useParams();
	const { inquiry, committeeMembers, projectMembers, isAdmin } =
		Route.useLoaderData();
	const router = useRouter();
	const { user } = useAuthStore();

	if (!inquiry) {
		return (
			<div>
				<Heading size="5">お問い合わせが見つかりません</Heading>
				<Text as="p" size="2" color="gray">
					指定されたお問い合わせは存在しないか、削除された可能性があります。
				</Text>
				<Link to="/committee/support">
					<Button intent="secondary">一覧に戻る</Button>
				</Link>
			</div>
		);
	}

	const isAssigneeOrAdmin =
		isAdmin ||
		(!!user && inquiry.committeeAssignees.some(a => a.user.id === user.id));

	return (
		<SupportDetail
			inquiry={inquiry}
			viewerRole="committee"
			basePath="/committee/support"
			committeeMembers={committeeMembers}
			projectMembers={projectMembers}
			viewers={inquiry.viewers}
			isAssigneeOrAdmin={isAssigneeOrAdmin}
			onUpdateStatus={async status => {
				try {
					if (status === "RESOLVED") {
						await updateCommitteeInquiryStatus(inquiryId, {
							status: "RESOLVED",
						});
					} else {
						await reopenCommitteeInquiry(inquiryId);
					}
					await router.invalidate();
				} catch {
					toast.error("ステータスの更新に失敗しました");
				}
			}}
			onAddComment={async (body, fileIds) => {
				try {
					await addCommitteeInquiryComment(inquiryId, { body, fileIds });
					await router.invalidate();
				} catch {
					toast.error("コメントの送信に失敗しました");
				}
			}}
			onAddAssignee={async (userId, side) => {
				try {
					await addCommitteeInquiryAssignee(inquiryId, {
						userId,
						side,
					});
					await router.invalidate();
				} catch {
					toast.error("担当者の追加に失敗しました");
				}
			}}
			onRemoveAssignee={async assigneeId => {
				try {
					await removeCommitteeInquiryAssignee(inquiryId, assigneeId);
					await router.invalidate();
				} catch {
					toast.error("担当者の削除に失敗しました");
				}
			}}
			onUpdateViewers={async viewers => {
				try {
					await updateCommitteeInquiryViewers(inquiryId, { viewers });
					await router.invalidate();
				} catch {
					toast.error("閲覧者設定の更新に失敗しました");
				}
			}}
		/>
	);
}
