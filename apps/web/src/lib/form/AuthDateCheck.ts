type AuthorizationDateError =
	| "PAST_SCHEDULED_SEND_AT"
	| "INVALID_SCHEDULE_DEADLINE_ORDER";

export function validateAuthorizationDates(auth: {
	scheduledSendAt: string | Date;
	deadlineAt?: string | Date | null;
}): AuthorizationDateError | null {
	const now = new Date();
	const scheduledSendAt = new Date(auth.scheduledSendAt);
	const deadlineAt = auth.deadlineAt ? new Date(auth.deadlineAt) : null;

	if (scheduledSendAt <= now) {
		return "PAST_SCHEDULED_SEND_AT";
	}

	if (deadlineAt && scheduledSendAt >= deadlineAt) {
		return "INVALID_SCHEDULE_DEADLINE_ORDER";
	}

	return null;
}
