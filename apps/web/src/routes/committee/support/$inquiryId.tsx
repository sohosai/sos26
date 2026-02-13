import { Heading, Text } from "@radix-ui/themes";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/primitives";
import { SupportDetail } from "@/components/support/SupportDetail";
import {
	committeMembers,
	currentCommitteeUser,
	projectMembers,
	useSupportStore,
} from "@/mock/support";

export const Route = createFileRoute("/committee/support/$inquiryId")({
	component: CommitteeSupportDetailPage,
	head: () => ({
		meta: [
			{ title: "問い合わせ詳細 | 雙峰祭オンラインシステム" },
			{ name: "description", content: "問い合わせ詳細" },
		],
	}),
});

function CommitteeSupportDetailPage() {
	const { inquiryId } = Route.useParams();
	const { inquiries, updateStatus, addMessage, addAssignee, removeAssignee } =
		useSupportStore();

	const inquiry = inquiries.find(inq => inq.id === inquiryId);

	if (!inquiry) {
		return (
			<div>
				<Heading size="5">問い合わせが見つかりません</Heading>
				<Text as="p" size="2" color="gray">
					指定された問い合わせは存在しないか、削除された可能性があります。
				</Text>
				<Link to="/committee/support">
					<Button intent="secondary">一覧に戻る</Button>
				</Link>
			</div>
		);
	}

	return (
		<SupportDetail
			inquiry={inquiry}
			viewerRole="committee"
			basePath="/committee/support"
			committeeMembers={committeMembers}
			projectMembers={projectMembers}
			onUpdateStatus={status =>
				updateStatus(inquiry.id, status, currentCommitteeUser)
			}
			onAddMessage={body =>
				addMessage(inquiry.id, body, currentCommitteeUser, null)
			}
			onAddAssignee={(person, side) =>
				addAssignee(inquiry.id, person, side, currentCommitteeUser)
			}
			onRemoveAssignee={(personId, side) =>
				removeAssignee(inquiry.id, personId, side, currentCommitteeUser)
			}
		/>
	);
}
