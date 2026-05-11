import { Heading, Text } from "@radix-ui/themes";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/primitives";
import { SupportDetail } from "@/components/support/SupportDetail";
import { listMyForms } from "@/lib/api/committee-form";
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
	getMyPermissions,
	listCommitteeMembers,
} from "@/lib/api/committee-member";
import { listCommitteeProjectMembers } from "@/lib/api/committee-project";
import { useAuthStore } from "@/lib/auth";
import { reportHandledError } from "@/lib/error/report";

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
		const [membersRes, projectMembersRes, formsRes] = await Promise.all([
			listCommitteeMembers(),
			listCommitteeProjectMembers(inquiryRes.inquiry.projectId),
			listMyForms(),
		]);

		// INQUIRY_ADMIN 権限チェック
		let isAdmin = false;
		if (committeeMember) {
			try {
				const permRes = await getMyPermissions();
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
				avatarFileId: m.user.avatarFileId,
			})),
			projectMembers: projectMembersRes.members.map(m => ({
				id: m.userId,
				name: m.name,
				avatarFileId: m.avatarFileId,
			})),
			availableForms: formsRes.forms
				.filter(
					f =>
						f.owner.id === committeeMember?.userId ||
						f.collaborators.some(c => c.id === committeeMember?.userId)
				)
				.map(f => ({
					id: f.id,
					title: f.title,
				})),
			isAdmin,
		};
	},
});

function CommitteeSupportDetailPage() {
	const { inquiryId } = Route.useParams();
	const { inquiry, committeeMembers, projectMembers, availableForms, isAdmin } =
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
				<Link to="/committee/support" search={{ tab: "open" }}>
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
			availableForms={availableForms}
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
				} catch (error) {
					reportHandledError({
						error,
						operation: "save",
						userMessage: "ステータスの更新に失敗しました",
						ui: { type: "toast" },
						context: {
							inquiryId,
							status,
						},
					});
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
				} catch (error) {
					reportHandledError({
						error,
						operation: isDraft ? "draft_save" : "comment_submit",
						userMessage: isDraft
							? "下書きの保存に失敗しました"
							: "コメントの送信に失敗しました",
						ui: { type: "toast" },
						context: {
							inquiryId,
							isDraft,
							fileCount: fileIds?.length ?? 0,
						},
					});
				}
			}}
			onAddAssignee={async (userId, side) => {
				try {
					await addCommitteeInquiryAssignee(inquiryId, {
						userId,
						side,
					});
					await router.invalidate();
				} catch (error) {
					reportHandledError({
						error,
						operation: "assignee_update",
						userMessage: "担当者の追加に失敗しました",
						ui: { type: "toast" },
						context: {
							inquiryId,
							userId,
							side,
						},
					});
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
				} catch (error) {
					reportHandledError({
						error,
						operation: "comment_submit",
						userMessage: "コメントの送信に失敗しました",
						ui: { type: "toast" },
						context: {
							inquiryId,
							commentId,
						},
					});
				}
			}}
			onDeleteComment={async commentId => {
				try {
					await deleteCommitteeInquiryComment(inquiryId, commentId);
					await router.invalidate();
					toast.success("コメントを削除しました");
				} catch (error) {
					reportHandledError({
						error,
						operation: "delete",
						userMessage: "コメントの削除に失敗しました",
						ui: { type: "toast" },
						context: {
							inquiryId,
							commentId,
						},
					});
				}
			}}
			onUpdateDraft={async (commentId, body) => {
				try {
					await updateCommitteeDraftComment(inquiryId, commentId, { body });
					await router.invalidate();
					toast.success("下書きを更新しました");
				} catch (error) {
					reportHandledError({
						error,
						operation: "save",
						userMessage: "下書きの更新に失敗しました",
						ui: { type: "toast" },
						context: {
							inquiryId,
							commentId,
						},
					});
				}
			}}
			onUpdateViewers={async viewers => {
				try {
					await updateCommitteeInquiryViewers(inquiryId, { viewers });
					await router.invalidate();
				} catch (error) {
					reportHandledError({
						error,
						operation: "save",
						userMessage: "閲覧者設定の更新に失敗しました",
						ui: { type: "toast" },
						context: {
							inquiryId,
							viewerCount: viewers.length,
						},
					});
				}
			}}
			onPublishDraftInquiry={async () => {
				try {
					await publishDraftInquiry(inquiryId);
					await router.invalidate();
					toast.success("お問い合わせを送信しました");
				} catch (error) {
					reportHandledError({
						error,
						operation: "inquiry_create",
						userMessage: "お問い合わせの送信に失敗しました",
						ui: { type: "toast" },
						context: {
							inquiryId,
						},
					});
				}
			}}
			onDeleteDraftInquiry={async () => {
				try {
					await deleteDraftInquiry(inquiryId);
					toast.success("下書きを削除しました");
					router.navigate({
						to: "/committee/support",
						search: { tab: "draft" },
					});
				} catch (error) {
					reportHandledError({
						error,
						operation: "delete",
						userMessage: "下書きの削除に失敗しました",
						ui: { type: "toast" },
						context: {
							inquiryId,
						},
					});
				}
			}}
			onUpdateDraftInquiry={async (title, body, fileIds, relatedFormId) => {
				await updateDraftInquiry(inquiryId, {
					title,
					body,
					fileIds,
					relatedFormId,
				});
				try {
					const refreshed = await getCommitteeInquiry(inquiryId);
					setCurrentInquiry(refreshed.inquiry);
				} catch (err) {
					console.error("failed to refresh inquiry after draft update", err);
					await router.invalidate();
				}
			}}
		/>
	);
}
