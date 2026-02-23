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
	listCommitteeMemberPermissions,
	listCommitteeMembers,
} from "@/lib/api/committee-member";
import {
	listCommitteeProjectMembers,
	listCommitteeProjects,
} from "@/lib/api/committee-project";
import { useAuthStore } from "@/lib/auth";

export const Route = createFileRoute("/committee/support/")({
	component: CommitteeSupportListPage,
	head: () => ({
		meta: [
			{ title: "お問い合わせ | 雙峰祭オンラインシステム" },
			{ name: "description", content: "お問い合わせ管理" },
		],
	}),
	loader: async () => {
		const { committeeMember } = useAuthStore.getState();

		const [inquiriesRes, projectsRes, membersRes] = await Promise.all([
			listCommitteeInquiries(),
			listCommitteeProjects(),
			listCommitteeMembers(),
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
			inquiries: inquiriesRes.inquiries,
			projects: projectsRes.projects.map(p => ({ id: p.id, name: p.name })),
			committeeMembers: membersRes.committeeMembers.map(m => ({
				id: m.user.id,
				name: m.user.name,
			})),
			isAdmin,
		};
	},
});

function CommitteeSupportListPage() {
	const { inquiries, projects, committeeMembers, isAdmin } =
		Route.useLoaderData();
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
				isAdmin={isAdmin}
			/>
			<NewInquiryForm
				open={formOpen}
				onOpenChange={setFormOpen}
				viewerRole="committee"
				currentUser={currentUser}
				projects={projects}
				onLoadProjectMembers={handleLoadProjectMembers}
				committeeMembers={committeeMembers}
				onSubmit={async params => {
					try {
						if (!params.projectId || !params.projectAssigneeUserIds) return;
						const { inquiry } = await createCommitteeInquiry({
							title: params.title,
							body: params.body,
							projectId: params.projectId,
							projectAssigneeUserIds: params.projectAssigneeUserIds,
							committeeAssigneeUserIds: params.committeeAssigneeUserIds,
							fileIds: params.fileIds,
							viewers: params.viewers,
						});
						await router.invalidate();
						navigate({
							to: "/committee/support/$inquiryId",
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
