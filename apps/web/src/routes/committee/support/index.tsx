import {
	createFileRoute,
	useNavigate,
	useRouter,
} from "@tanstack/react-router";
import { useState } from "react";
import { NewInquiryForm } from "@/components/support/NewInquiryForm";
import { SupportList } from "@/components/support/SupportList";
import { listMyForms } from "@/lib/api/committee-form";
import {
	createCommitteeInquiry,
	listCommitteeInquiries,
} from "@/lib/api/committee-inquiry";
import {
	getMyPermissions,
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

		const [inquiriesRes, projectsRes, membersRes, formsRes] = await Promise.all(
			[
				listCommitteeInquiries(),
				listCommitteeProjects(),
				listCommitteeMembers(),
				listMyForms(),
			]
		);

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
			inquiries: inquiriesRes.inquiries,
			projects: projectsRes.projects.map(p => ({
				id: p.id,
				name: p.name,
				number: p.number,
			})),
			committeeMembers: membersRes.committeeMembers.map(m => ({
				id: m.user.id,
				name: m.user.name,
				avatarFileId: m.user.avatarFileId,
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

function CommitteeSupportListPage() {
	const { inquiries, projects, committeeMembers, availableForms, isAdmin } =
		Route.useLoaderData();
	const [formOpen, setFormOpen] = useState(false);
	const navigate = useNavigate();
	const router = useRouter();
	const { user } = useAuthStore();

	if (!user) return null;

	const currentUser = { id: user.id, name: user.name };

	const handleLoadProjectMembers = async (projectId: string) => {
		const res = await listCommitteeProjectMembers(projectId);
		return res.members.map(m => ({
			id: m.userId,
			name: m.name,
			avatarFileId: m.avatarFileId,
		}));
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
				availableForms={availableForms}
				onSubmit={async params => {
					if (!params.projectId || !params.projectAssigneeUserIds) return;
					const { inquiry } = await createCommitteeInquiry({
						title: params.title,
						body: params.body,
						relatedFormId: params.relatedFormId,
						projectId: params.projectId,
						projectAssigneeUserIds: params.projectAssigneeUserIds,
						committeeAssigneeUserIds: params.committeeAssigneeUserIds,
						fileIds: params.fileIds,
						viewers: params.viewers,
						isDraft: params.isDraft,
					});
					await router.invalidate();
					navigate({
						to: "/committee/support/$inquiryId",
						params: { inquiryId: inquiry.id },
					});
				}}
			/>
		</>
	);
}
