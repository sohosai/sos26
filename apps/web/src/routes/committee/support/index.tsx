import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { NewInquiryForm } from "@/components/support/NewInquiryForm";
import { SupportList } from "@/components/support/SupportList";
import {
	availableForms,
	committeMembers,
	currentCommitteeUser,
	projectMembers,
	useSupportStore,
} from "@/mock/support";

export const Route = createFileRoute("/committee/support/")({
	component: CommitteeSupportListPage,
	head: () => ({
		meta: [
			{ title: "問い合わせ | 雙峰祭オンラインシステム" },
			{ name: "description", content: "問い合わせ管理" },
		],
	}),
});

function CommitteeSupportListPage() {
	const { inquiries, addInquiry } = useSupportStore();
	const [formOpen, setFormOpen] = useState(false);
	const navigate = useNavigate();

	return (
		<>
			<SupportList
				inquiries={inquiries}
				currentUser={currentCommitteeUser}
				viewerRole="committee"
				basePath="/committee/support"
				onNewInquiry={() => setFormOpen(true)}
			/>
			<NewInquiryForm
				open={formOpen}
				onOpenChange={setFormOpen}
				viewerRole="committee"
				currentUser={currentCommitteeUser}
				availableForms={availableForms}
				committeeMembers={committeMembers}
				projectMembers={projectMembers}
				onSubmit={params => {
					const inquiry = addInquiry({
						title: params.title,
						body: params.body,
						createdBy: currentCommitteeUser,
						creatorRole: "committee",
						relatedForm: params.relatedForm,
						projectAssignees: params.projectAssignees,
						committeeAssignees: params.committeeAssignees,
					});
					navigate({
						to: "/committee/support/$inquiryId",
						params: { inquiryId: inquiry.id },
					});
				}}
			/>
		</>
	);
}
