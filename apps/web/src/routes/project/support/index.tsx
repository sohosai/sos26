import {
	createFileRoute,
	useNavigate,
	useRouter,
} from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { NewInquiryForm } from "@/components/support/NewInquiryForm";
import { SupportList } from "@/components/support/SupportList";
import { listProjectMembers } from "@/lib/api/project";
import {
	createProjectInquiry,
	listProjectInquiries,
} from "@/lib/api/project-inquiry";
import { useAuthStore } from "@/lib/auth";
import { useProjectStore } from "@/lib/project/store";

export const Route = createFileRoute("/project/support/")({
	component: ProjectSupportListPage,
	head: () => ({
		meta: [
			{ title: "お問い合わせ | 雙峰祭オンラインシステム" },
			{ name: "description", content: "お問い合わせ管理" },
		],
	}),
	loader: async () => {
		const { selectedProjectId } = useProjectStore.getState();
		if (!selectedProjectId)
			return { inquiries: [] as never[], projectMembers: [] as never[] };
		const [inquiriesRes, membersRes] = await Promise.all([
			listProjectInquiries(selectedProjectId),
			listProjectMembers(selectedProjectId),
		]);
		return {
			inquiries: inquiriesRes.inquiries,
			projectMembers: membersRes.members.map(m => ({
				id: m.userId,
				name: m.name,
			})),
		};
	},
});

function ProjectSupportListPage() {
	const { inquiries, projectMembers } = Route.useLoaderData();
	const [formOpen, setFormOpen] = useState(false);
	const navigate = useNavigate();
	const router = useRouter();
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
				onSubmit={async params => {
					try {
						const { inquiry } = await createProjectInquiry(selectedProjectId, {
							title: params.title,
							body: params.body,
							coAssigneeUserIds: params.coAssigneeUserIds,
							fileIds: params.fileIds,
						});
						await router.invalidate();
						navigate({
							to: "/project/support/$inquiryId",
							params: { inquiryId: inquiry.id },
						});
					} catch {
						toast.error("お問い合わせの作成に失敗しました");
					}
				}}
			/>
		</>
	);
}
