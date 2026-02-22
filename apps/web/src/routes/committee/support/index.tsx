import {
	createFileRoute,
	useNavigate,
	useRouter,
} from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { NewInquiryForm } from "@/components/support/NewInquiryForm";
import { SupportList } from "@/components/support/SupportList";
import {
	createCommitteeInquiry,
	listCommitteeInquiries,
} from "@/lib/api/committee-inquiry";
import {
	listCommitteeProjectMembers,
	listCommitteeProjects,
} from "@/lib/api/committee-project";
import { useAuthStore } from "@/lib/auth";

export const Route = createFileRoute("/committee/support/")({
	component: CommitteeSupportListPage,
	head: () => ({
		meta: [
			{ title: "問い合わせ | 雙峰祭オンラインシステム" },
			{ name: "description", content: "問い合わせ管理" },
		],
	}),
	loader: async () => {
		const [inquiriesRes, projectsRes] = await Promise.all([
			listCommitteeInquiries(),
			listCommitteeProjects(),
		]);
		return {
			inquiries: inquiriesRes.inquiries,
			projects: projectsRes.projects.map(p => ({ id: p.id, name: p.name })),
		};
	},
});

function CommitteeSupportListPage() {
	const { inquiries, projects } = Route.useLoaderData();
	const [formOpen, setFormOpen] = useState(false);
	const navigate = useNavigate();
	const router = useRouter();
	const { user } = useAuthStore();

	if (!user) return null;

	const currentUser = { id: user.id, name: user.name };

	const handleLoadProjectMembers = async (projectId: string) => {
		const res = await listCommitteeProjectMembers(projectId);
		return res.members.map(m => ({ id: m.userId, name: m.name }));
	};

	return (
		<>
			<SupportList
				inquiries={inquiries}
				currentUser={currentUser}
				viewerRole="committee"
				basePath="/committee/support"
				onNewInquiry={() => setFormOpen(true)}
			/>
			<NewInquiryForm
				open={formOpen}
				onOpenChange={setFormOpen}
				viewerRole="committee"
				currentUser={currentUser}
				projects={projects}
				onLoadProjectMembers={handleLoadProjectMembers}
				onSubmit={async params => {
					try {
						if (!params.projectId || !params.projectAssigneeUserIds) return;
						const { inquiry } = await createCommitteeInquiry({
							title: params.title,
							body: params.body,
							projectId: params.projectId,
							projectAssigneeUserIds: params.projectAssigneeUserIds,
						});
						await router.invalidate();
						navigate({
							to: "/committee/support/$inquiryId",
							params: { inquiryId: inquiry.id },
						});
					} catch {
						toast.error("問い合わせの作成に失敗しました");
					}
				}}
			/>
		</>
	);
}
