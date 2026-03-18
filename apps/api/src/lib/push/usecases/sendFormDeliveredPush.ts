import { z } from "zod";
import { formDeliveredTemplate } from "../templates/formDelivered";
import { sendPushToUsers } from "./sendPushToUsers";

const InputSchema = z.object({
	userIds: z.array(z.string().min(1)),
	formTitle: z.string().min(1),
	url: z.url(),
});

export async function sendFormDeliveredPush(
	input: z.infer<typeof InputSchema>
): Promise<void> {
	const { userIds, formTitle, url } = InputSchema.parse(input);
	await sendPushToUsers({
		userIds,
		payload: formDeliveredTemplate({ formTitle, url }),
	});
}
