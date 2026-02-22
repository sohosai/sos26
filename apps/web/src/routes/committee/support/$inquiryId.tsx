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
} from "@/lib/api/committee-inquiry";
import { listCommitteeMembers } from "@/lib/api/committee-member";
import { listCommitteeProjectMembers } from "@/lib/api/committee-project";

export const Route = createFileRoute("/committee/support/$inquiryId")({
	component: CommitteeSupportDetailPage,
	head: () => ({
		meta: [
			{ title: "問い合わせ詳細 | 雙峰祭オンラインシステム" },
			{ name: "description", content: "問い合わせ詳細" },
		],
	}),
	loader: async ({ params }) => {
		const inquiryRes = await getCommitteeInquiry(params.inquiryId);
		const [membersRes, projectMembersRes] = await Promise.all([
			listCommitteeMembers(),
			listCommitteeProjectMembers(inquiryRes.inquiry.projectId),
		]);
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
		};
	},
});

function CommitteeSupportDetailPage() {
	const { inquiryId } = Route.useParams();
	const { inquiry, committeeMembers, projectMembers } = Route.useLoaderData();
	const router = useRouter();

	if (!inquiry) {
		return (
			<div>
				<Heading size="5">問い合わせが見つかりません</Heading>
				<Text as="p" size="2" color="gray">
					指定された問い合わせは存在しないか、削除された可能性があります。
				</Text>
				<Link to="/committee/support">
					<Button intent="secondary">一覧に戻る</Button>
				</Link>
			</div>
		);
	}

	return (
		<SupportDetail
			inquiry={inquiry}
			viewerRole="committee"
			basePath="/committee/support"
			committeeMembers={committeeMembers}
			projectMembers={projectMembers}
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
			onAddComment={async body => {
				try {
					await addCommitteeInquiryComment(inquiryId, { body });
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
		/>
	);
}
