import type {
	Bureau,
	GetProjectInquiryResponse,
	ViewerScope,
} from "@sos26/shared";

export type InquiryDetail = GetProjectInquiryResponse["inquiry"];
export type RelatedFormInfo = InquiryDetail["relatedForm"];
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
