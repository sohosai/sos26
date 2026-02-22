import { Heading, Text } from "@radix-ui/themes";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/primitives";
import { SupportDetail } from "@/components/support/SupportDetail";
import { listProjectMembers } from "@/lib/api/project";
import {
	addProjectInquiryAssignee,
	addProjectInquiryComment,
	getProjectInquiry,
	removeProjectInquiryAssignee,
	reopenProjectInquiry,
} from "@/lib/api/project-inquiry";
import { useProjectStore } from "@/lib/project/store";

export const Route = createFileRoute("/project/support/$inquiryId")({
	component: ProjectSupportDetailPage,
	head: () => ({
		meta: [
			{ title: "問い合わせ詳細 | 雙峰祭オンラインシステム" },
			{ name: "description", content: "問い合わせ詳細" },
		],
	}),
	loader: async ({ params }) => {
		const { selectedProjectId } = useProjectStore.getState();
		if (!selectedProjectId) return null;
		const [inquiryRes, membersRes] = await Promise.all([
			getProjectInquiry(selectedProjectId, params.inquiryId),
			listProjectMembers(selectedProjectId),
		]);
		return {
			inquiry: inquiryRes.inquiry,
			projectMembers: membersRes.members.map(m => ({
				id: m.userId,
				name: m.name,
			})),
		};
	},
});

function ProjectSupportDetailPage() {
	const { inquiryId } = Route.useParams();
	const data = Route.useLoaderData();
	const router = useRouter();
	const { selectedProjectId } = useProjectStore();

	if (!data || !selectedProjectId) {
		return (
			<div>
				<Heading size="5">問い合わせが見つかりません</Heading>
				<Text as="p" size="2" color="gray">
					指定された問い合わせは存在しないか、削除された可能性があります。
				</Text>
				<Link to="/project/support">
					<Button intent="secondary">一覧に戻る</Button>
				</Link>
			</div>
		);
	}

	const { inquiry, projectMembers } = data;

	return (
		<SupportDetail
			inquiry={inquiry}
			viewerRole="project"
			basePath="/project/support"
			committeeMembers={[]}
			projectMembers={projectMembers}
			onUpdateStatus={async status => {
				try {
					if (status === "IN_PROGRESS") {
						await reopenProjectInquiry(selectedProjectId, inquiryId);
					}
					await router.invalidate();
				} catch {
					toast.error("ステータスの更新に失敗しました");
				}
			}}
			onAddComment={async body => {
				try {
					await addProjectInquiryComment(selectedProjectId, inquiryId, {
						body,
					});
					await router.invalidate();
				} catch {
					toast.error("コメントの送信に失敗しました");
				}
			}}
			onAddAssignee={async (userId, side) => {
				try {
					await addProjectInquiryAssignee(selectedProjectId, inquiryId, {
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
					await removeProjectInquiryAssignee(
						selectedProjectId,
						inquiryId,
						assigneeId
					);
					await router.invalidate();
				} catch {
					toast.error("担当者の削除に失敗しました");
				}
			}}
		/>
	);
}
