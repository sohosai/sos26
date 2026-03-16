import { Heading, Text } from "@radix-ui/themes";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/primitives";
import { SupportDetail } from "@/components/support/SupportDetail";
import {
	addCommitteeInquiryAssignee,
	addCommitteeInquiryComment,
	deleteCommitteeInquiryComment,
	deleteDraftInquiry,
	getCommitteeInquiry,
	publishDraftComment,
	publishDraftInquiry,
	removeCommitteeInquiryAssignee,
	reopenCommitteeInquiry,
	updateCommitteeDraftComment,
	updateCommitteeInquiryStatus,
	updateCommitteeInquiryViewers,
	updateDraftInquiry,
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
	const [currentInquiry, setCurrentInquiry] = useState(inquiry);

	useEffect(() => {
		setCurrentInquiry(inquiry);
	}, [inquiry]);

	if (!currentInquiry) {
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
		(!!user &&
			currentInquiry.committeeAssignees.some(a => a.user.id === user.id));

	return (
		<SupportDetail
			inquiry={currentInquiry}
			viewerRole="committee"
			basePath="/committee/support"
			currentUserId={user?.id ?? ""}
			committeeMembers={committeeMembers}
			projectMembers={projectMembers}
			viewers={currentInquiry.viewers}
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
			onAddComment={async (body, fileIds, isDraft) => {
				try {
					await addCommitteeInquiryComment(inquiryId, {
						body,
						fileIds,
						isDraft,
					});
					await router.invalidate();
					if (isDraft) {
						toast.success("下書きを保存しました");
					}
				} catch {
					toast.error(
						isDraft
							? "下書きの保存に失敗しました"
							: "コメントの送信に失敗しました"
					);
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
				await removeCommitteeInquiryAssignee(inquiryId, assigneeId);
				await router.invalidate();
			}}
			onPublishDraft={async commentId => {
				try {
					await publishDraftComment(inquiryId, commentId);
					await router.invalidate();
					toast.success("コメントを送信しました");
				} catch {
					toast.error("コメントの送信に失敗しました");
				}
			}}
			onDeleteComment={async commentId => {
				try {
					await deleteCommitteeInquiryComment(inquiryId, commentId);
					await router.invalidate();
					toast.success("コメントを削除しました");
				} catch {
					toast.error("コメントの削除に失敗しました");
				}
			}}
			onUpdateDraft={async (commentId, body) => {
				try {
					await updateCommitteeDraftComment(inquiryId, commentId, { body });
					await router.invalidate();
					toast.success("下書きを更新しました");
				} catch {
					toast.error("下書きの更新に失敗しました");
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
			onPublishDraftInquiry={async () => {
				try {
					await publishDraftInquiry(inquiryId);
					await router.invalidate();
					toast.success("お問い合わせを送信しました");
				} catch {
					toast.error("お問い合わせの送信に失敗しました");
				}
			}}
			onDeleteDraftInquiry={async () => {
				try {
					await deleteDraftInquiry(inquiryId);
					toast.success("下書きを削除しました");
					router.navigate({ to: "/committee/support" });
				} catch {
					toast.error("下書きの削除に失敗しました");
				}
			}}
			onUpdateDraftInquiry={async (title, body, fileIds) => {
				try {
					await updateDraftInquiry(inquiryId, { title, body, fileIds });
					try {
						const refreshed = await getCommitteeInquiry(inquiryId);
						setCurrentInquiry(refreshed.inquiry);
					} catch (err) {
						console.error("failed to refresh inquiry after draft update", err);
						await router.invalidate();
					}
					toast.success("下書きを更新しました");
				} catch {
					toast.error("下書きの更新に失敗しました");
				}
			}}
		/>
	);
}
