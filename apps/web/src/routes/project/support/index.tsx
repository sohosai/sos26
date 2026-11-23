import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { NewInquiryForm } from "@/components/support/NewInquiryForm";
import { SupportList } from "@/components/support/SupportList";
import { createProjectInquiry } from "@/lib/api/project-inquiry";
import { useAuthStore } from "@/lib/auth";
import { useProjectStore } from "@/lib/project/store";
import { queryClient } from "@/lib/query/client";
import {
	projectFormsQuery,
	projectInquiriesQuery,
	projectMembersQuery,
	projectQueryKeys,
} from "@/lib/query/project";

export const Route = createFileRoute("/project/support/")({
	component: ProjectSupportListPage,
	head: () => ({
		meta: [
			{ title: "お問い合わせ | 雙峰祭オンラインシステム" },
			{ name: "description", content: "お問い合わせ管理" },
		],
	}),
	loader: async ({ context }) => {
		// 新着があれば一覧が古くなっているので、確認を待ってから読む
		await context.notificationStatusCheck;
		const { selectedProjectId } = useProjectStore.getState();
		if (!selectedProjectId)
			return {
				inquiries: [] as never[],
				projectMembers: [] as never[],
				availableForms: [] as never[],
			};
		const [inquiriesRes, membersRes, formsRes] = await Promise.all([
			queryClient.fetchQuery(projectInquiriesQuery(selectedProjectId)),
			queryClient.fetchQuery(projectMembersQuery(selectedProjectId)),
			queryClient.fetchQuery(projectFormsQuery(selectedProjectId)),
		]);
		return {
			inquiries: inquiriesRes.inquiries,
			projectMembers: membersRes.members.map(m => ({
				id: m.userId,
				name: m.name,
				avatarFileId: m.avatarFileId,
			})),
			availableForms: formsRes.forms.map(f => ({
				id: f.formId,
				title: f.title,
			})),
		};
	},
});

function ProjectSupportListPage() {
	const { inquiries, projectMembers, availableForms } = Route.useLoaderData();
	const [formOpen, setFormOpen] = useState(false);
	const navigate = useNavigate();
	const { user } = useAuthStore();
	const { selectedProjectId } = useProjectStore();

	if (!user || !selectedProjectId) return null;

	const currentUser = { id: user.id, name: user.name };

	return (
		<>
			<SupportList
				inquiries={inquiries}
				currentUser={currentUser}
				viewerRole="project"
				basePath="/project/support"
				onNewInquiry={() => setFormOpen(true)}
			/>
			<NewInquiryForm
				open={formOpen}
				onOpenChange={setFormOpen}
				viewerRole="project"
				currentUser={currentUser}
				projectMembers={projectMembers}
				availableForms={availableForms}
				onSubmit={async params => {
					const { inquiry } = await createProjectInquiry(selectedProjectId, {
						title: params.title,
						body: params.body,
						relatedFormId: params.relatedFormId ?? undefined,
						coAssigneeUserIds: params.coAssigneeUserIds,
						fileIds: params.fileIds,
					});
					await queryClient.invalidateQueries({
						queryKey: projectQueryKeys.inquiries(selectedProjectId),
					});
					navigate({
						to: "/project/support/$inquiryId",
						params: { inquiryId: inquiry.id },
					});
				}}
			/>
		</>
	);
}
