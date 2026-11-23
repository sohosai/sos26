import { Heading, Text } from "@radix-ui/themes";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/primitives";
import { SupportDetail } from "@/components/support/SupportDetail";
import {
	addProjectInquiryAssignee,
	addProjectInquiryComment,
	getProjectInquiry,
	readProjectInquiry,
	removeProjectInquiryAssignee,
	reopenProjectInquiry,
} from "@/lib/api/project-inquiry";
import { useAuthStore } from "@/lib/auth";
import { reportHandledError } from "@/lib/error/report";
import { refreshNotificationDot } from "@/lib/project/notification-status";
import { useProjectStore } from "@/lib/project/store";
import { syncSelectedProjectFromSearch } from "@/lib/project/sync";
import { queryClient } from "@/lib/query/client";
import {
	invalidateQueryAfterFetch,
	projectMembersQuery,
	projectQueryKeys,
} from "@/lib/query/project";

/**
 * 既読にしてから、一覧とサイドバーのドットを取り直させる。失敗しても表示は続ける。
 * 既読になる前に一覧へ戻って取り直した場合に備え、既読のあとにも一覧を古くする
 */
function markInquiryRead(projectId: string, inquiryId: string) {
	void readProjectInquiry(projectId, inquiryId)
		.then(() => {
			void invalidateQueryAfterFetch(projectQueryKeys.inquiries(projectId));
			return refreshNotificationDot();
		})
		.catch(() => undefined);
}

const searchSchema = z.object({
	projectId: z.string().optional(),
});

export const Route = createFileRoute("/project/support/$inquiryId")({
	component: ProjectSupportDetailPage,
	head: () => ({
		meta: [
			{ title: "お問い合わせ詳細 | 雙峰祭オンラインシステム" },
			{ name: "description", content: "お問い合わせ詳細" },
		],
	}),
	validateSearch: searchSchema,
	// 操作の結果は画面の state にだけ反映するので、ページを離れたら loader のデータを捨て、開き直したときに古い表示を出さない
	gcTime: 0,
	// パラメータが変わったら作り直し、前の詳細を待っていた応答を移った先の画面に入れない
	remountDeps: ({ params }) => params,
	beforeLoad: ({ search }) => {
		syncSelectedProjectFromSearch(search.projectId);
	},
	loader: async ({ params }) => {
		const { selectedProjectId } = useProjectStore.getState();
		if (!selectedProjectId) return null;
		const [inquiryRes, membersRes] = await Promise.all([
			getProjectInquiry(selectedProjectId, params.inquiryId),
			queryClient.fetchQuery(projectMembersQuery(selectedProjectId)),
		]);
		// 開くと既読になり、返信などでも一覧の表示が変わるので、一覧に戻ったときに取り直させる。
		// 取得中の一覧の応答で無効化が打ち消されないよう、詳細を取得したあとに行う
		void queryClient.invalidateQueries({
			queryKey: projectQueryKeys.inquiries(selectedProjectId),
		});
		return {
			inquiry: inquiryRes.inquiry,
			projectMembers: membersRes.members.map(m => ({
				id: m.userId,
				name: m.name,
				avatarFileId: m.avatarFileId,
			})),
		};
	},
});

function ProjectSupportDetailPage() {
	const { inquiryId } = Route.useParams();
	const data = Route.useLoaderData();
	const { selectedProjectId } = useProjectStore();
	const { user } = useAuthStore();
	const loadedInquiry = data?.inquiry;

	// 操作の結果を loader の再実行なしで反映するため、手元で持つ
	const [inquiry, setInquiry] = useState(loadedInquiry);
	const latestRefreshIdRef = useRef(0);

	// 新着の反映などで loader が再実行されたら、その前に出ていた取り直しの応答で上書きしない
	useEffect(() => {
		latestRefreshIdRef.current += 1;
		setInquiry(loadedInquiry);
	}, [loadedInquiry]);

	// 詳細を表示したときと、新しいコメントを取り直したときに既読にする。失敗しても表示は続ける
	useEffect(() => {
		if (!selectedProjectId || !loadedInquiry) return;
		markInquiryRead(selectedProjectId, loadedInquiry.id);
	}, [selectedProjectId, loadedInquiry]);

	if (!data || !inquiry || !selectedProjectId) {
		return (
			<div>
				<Heading size="5">お問い合わせが見つかりません</Heading>
				<Text as="p" size="2" color="gray">
					指定されたお問い合わせは存在しないか、削除された可能性があります。
				</Text>
				<Link to="/project/support">
					<Button intent="secondary">一覧に戻る</Button>
				</Link>
			</div>
		);
	}

	const { projectMembers } = data;

	// 操作で変わるアクティビティや担当者・ステータスを反映するため、詳細だけを取り直す。
	// 続けて操作したときに古い応答で上書きしないよう、最後に出したリクエストの分だけ反映する
	const refreshInquiry = async () => {
		latestRefreshIdRef.current += 1;
		const refreshId = latestRefreshIdRef.current;
		try {
			const res = await getProjectInquiry(selectedProjectId, inquiryId);
			if (refreshId !== latestRefreshIdRef.current) return;
			setInquiry(res.inquiry);
			markInquiryRead(selectedProjectId, inquiryId);
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

	const isAssigneeOrAdmin =
		!!user && inquiry.projectAssignees.some(a => a.user.id === user.id);

	return (
		<SupportDetail
			inquiry={inquiry}
			viewerRole="project"
			basePath="/project/support"
			currentUserId={user?.id ?? ""}
			committeeMembers={[]}
			projectMembers={projectMembers}
			isAssigneeOrAdmin={isAssigneeOrAdmin}
			onUpdateStatus={async status => {
				try {
					if (status === "IN_PROGRESS") {
						await reopenProjectInquiry(selectedProjectId, inquiryId);
						await refreshInquiry();
					}
				} catch {
					toast.error("ステータスの更新に失敗しました");
				}
			}}
			onAddComment={async (body, fileIds) => {
				try {
					await addProjectInquiryComment(selectedProjectId, inquiryId, {
						body,
						fileIds,
					});
					await refreshInquiry();
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
					await refreshInquiry();
				} catch {
					toast.error("担当者の追加に失敗しました");
				}
			}}
			onRemoveAssignee={async assigneeId => {
				await removeProjectInquiryAssignee(
					selectedProjectId,
					inquiryId,
					assigneeId
				);
				// 自分を外したときは一覧へ移る。閲覧できなくなるので取り直さない
				const removedSelf = inquiry.projectAssignees.some(
					a => a.id === assigneeId && a.user.id === user?.id
				);
				if (!removedSelf) await refreshInquiry();
			}}
		/>
	);
}
