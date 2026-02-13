import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { NewInquiryForm } from "@/components/support/NewInquiryForm";
import { SupportList } from "@/components/support/SupportList";
import {
	availableForms,
	committeMembers,
	currentProjectUser,
	projectMembers,
	useSupportStore,
} from "@/mock/support";

export const Route = createFileRoute("/project/support/")({
	component: ProjectSupportListPage,
	head: () => ({
		meta: [
			{ title: "問い合わせ | 雙峰祭オンラインシステム" },
			{ name: "description", content: "問い合わせ管理" },
		],
	}),
});

function ProjectSupportListPage() {
	const { inquiries, addInquiry } = useSupportStore();
	const [formOpen, setFormOpen] = useState(false);
	const navigate = useNavigate();

	return (
		<>
			<SupportList
				inquiries={inquiries}
				currentUser={currentProjectUser}
				viewerRole="project"
				basePath="/project/support"
				onNewInquiry={() => setFormOpen(true)}
			/>
			<NewInquiryForm
				open={formOpen}
				onOpenChange={setFormOpen}
				viewerRole="project"
				currentUser={currentProjectUser}
				availableForms={availableForms}
				committeeMembers={committeMembers}
				projectMembers={projectMembers}
				onSubmit={params => {
					const inquiry = addInquiry({
						title: params.title,
						body: params.body,
						createdBy: currentProjectUser,
						creatorRole: "project",
						relatedForm: params.relatedForm,
						projectAssignees: [currentProjectUser],
						committeeAssignees: [],
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
