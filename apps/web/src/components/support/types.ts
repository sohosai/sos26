import type {
	Bureau,
	GetProjectInquiryResponse,
	InquiryViewerScope,
} from "@sos26/shared";

export type InquiryDetail = GetProjectInquiryResponse["inquiry"];
export type CommentInfo = InquiryDetail["comments"][number];
export type ActivityInfo = InquiryDetail["activities"][number];
export type AssigneeInfo = InquiryDetail["projectAssignees"][number];

export type ViewerDetail = {
	id: string;
	scope: InquiryViewerScope;
	bureauValue: Bureau | null;
	createdAt: Date;
	user: { id: string; name: string } | null;
};

export type ViewerInput = {
	scope: InquiryViewerScope;
	bureauValue?: Bureau;
	userId?: string;
};
