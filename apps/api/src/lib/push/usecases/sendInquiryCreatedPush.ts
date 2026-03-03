import { z } from "zod";
import { inquiryCreatedForCommitteeTemplate } from "../templates/inquiryCreatedForCommittee";
import { inquiryCreatedForProjectTemplate } from "../templates/inquiryCreatedForProject";
import { sendPushToUsers } from "./sendPushToUsers";

const InputSchema = z.object({
	userIds: z.array(z.string().min(1)),
	inquiryTitle: z.string().min(1),
	target: z.enum(["COMMITTEE", "PROJECT"]),
	url: z.url(),
});

export async function sendInquiryCreatedPush(
	input: z.infer<typeof InputSchema>
): Promise<void> {
	const { userIds, inquiryTitle, target, url } = InputSchema.parse(input);
	const template =
		target === "COMMITTEE"
			? inquiryCreatedForCommitteeTemplate({ inquiryTitle, url })
			: inquiryCreatedForProjectTemplate({ inquiryTitle, url });
	await sendPushToUsers({
		userIds,
		payload: template,
	});
}
