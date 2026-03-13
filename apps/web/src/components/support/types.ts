import type {
	Bureau,
	GetCommitteeInquiryResponse,
	GetProjectInquiryResponse,
	ViewerScope,
} from "@sos26/shared";

export type InquiryDetail =
	| GetProjectInquiryResponse["inquiry"]
	| GetCommitteeInquiryResponse["inquiry"];
export type CommitteeCommentInfo =
	GetCommitteeInquiryResponse["inquiry"]["comments"][number];
export type CommentInfo = InquiryDetail["comments"][number];
export type ActivityInfo = InquiryDetail["activities"][number];
export type AssigneeInfo = InquiryDetail["projectAssignees"][number];

export type ViewerDetail = {
	id: string;
	scope: ViewerScope;
	bureauValue: Bureau | null;
	createdAt: Date;
	user: { id: string; name: string } | null;
};

export type ViewerInput = {
	scope: ViewerScope;
	bureauValue?: Bureau;
	userId?: string;
};
