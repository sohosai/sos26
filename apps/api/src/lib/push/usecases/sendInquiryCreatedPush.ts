import { z } from "zod";
import { inquiryCreatedForCommitteeTemplate } from "../templates/inquiryCreatedForCommittee";
import { sendPushToUsers } from "./sendPushToUsers";

const InputSchema = z.object({
	userIds: z.array(z.string().min(1)),
	inquiryTitle: z.string().min(1),
	target: z.enum(["COMMITTEE", "PROJECT"]),
});

export async function sendInquiryCreatedPush(
	input: z.infer<typeof InputSchema>
): Promise<void> {
	const { userIds, inquiryTitle, target } = InputSchema.parse(input);
	const template =
		target === "COMMITTEE"
			? inquiryCreatedForCommitteeTemplate({ inquiryTitle })
			: inquiryCreatedForCommitteeTemplate({ inquiryTitle });
	await sendPushToUsers({
		userIds,
		payload: template,
	});
}
