import { Heading, Text } from "@radix-ui/themes";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
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
	readCommitteeInquiry,
	removeCommitteeInquiryAssignee,
	reopenCommitteeInquiry,
	updateCommitteeDraftComment,
	updateCommitteeInquiryStatus,
	updateCommitteeInquiryViewers,
	updateDraftInquiry,
} from "@/lib/api/committee-inquiry";
import { listCommitteeMembersPicker } from "@/lib/api/committee-member";
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
		const { committeeMember, permissions } = useAuthStore.getState();
		const [[inquiryRes, projectMembersRes], membersRes, formsRes] =
			await Promise.all([
				getCommitteeInquiry(params.inquiryId).then(
					async res =>
						[
							res,
							await listCommitteeProjectMembers(res.inquiry.projectId),
						] as const
				),
				listCommitteeMembersPicker(),
				listMyForms(),
			]);

		// INQUIRY_ADMIN 権限チェック（store から参照）
		const isAdmin = permissions?.has("INQUIRY_ADMIN") ?? false;

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
				role: m.role,
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
	const latestRefreshIdRef = useRef(0);

	useEffect(() => {
		latestRefreshIdRef.current += 1;
		setCurrentInquiry(inquiry);
	}, [inquiry]);

	// 詳細を表示したときと、新しいコメントを取り直したときに既読にする。失敗しても表示は続ける
	useEffect(() => {
		if (!inquiry) return;
		void readCommitteeInquiry(inquiry.id).catch(() => undefined);
	}, [inquiry]);

	// 操作で変わるアクティビティや担当者・ステータスを反映するため、詳細だけを取り直す。
	// 続けて操作したときに古い応答で上書きしないよう、最後に出したリクエストの分だけ反映する
	const refreshInquiry = async () => {
		latestRefreshIdRef.current += 1;
		const refreshId = latestRefreshIdRef.current;
		try {
			const res = await getCommitteeInquiry(inquiryId);
			if (refreshId !== latestRefreshIdRef.current) return;
			setCurrentInquiry(res.inquiry);
			void readCommitteeInquiry(inquiryId).catch(() => undefined);
		} catch (error) {
			if (refreshId !== latestRefreshIdRef.current) return;
			reportHandledError({
				error,
				operation: "read",
				userMessage: "お問い合わせの再読み込みに失敗しました",
				ui: { type: "toast" },
				context: { inquiryId },
			});
		}
	};

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
					await refreshInquiry();
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
					await refreshInquiry();
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
					await refreshInquiry();
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
				await refreshInquiry();
			}}
			onPublishDraft={async commentId => {
				try {
					const { comment } = await publishDraftComment(inquiryId, commentId);
					setCurrentInquiry(prev => ({
						...prev,
						comments: prev.comments.map(c =>
							c.id === comment.id
								? { ...c, isDraft: comment.isDraft, sentAt: comment.sentAt }
								: c
						),
					}));
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
					setCurrentInquiry(prev => ({
						...prev,
						comments: prev.comments.filter(c => c.id !== commentId),
					}));
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
					const { comment } = await updateCommitteeDraftComment(
						inquiryId,
						commentId,
						{ body }
					);
					setCurrentInquiry(prev => ({
						...prev,
						comments: prev.comments.map(c =>
							c.id === comment.id ? { ...c, body: comment.body } : c
						),
					}));
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
					await refreshInquiry();
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
					const res = await publishDraftInquiry(inquiryId);
					setCurrentInquiry(prev => ({ ...prev, ...res.inquiry }));
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
				await refreshInquiry();
			}}
		/>
	);
}
