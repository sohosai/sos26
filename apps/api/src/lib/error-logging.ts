type ErrorLogContext = Record<string, unknown> | undefined;

export function logUnexpectedApiError(
	label: string,
	error: unknown,
	context?: ErrorLogContext
): void {
	console.error(`[${label}]`, {
		...context,
		error,
	});
}

export function logIntegrationFailure(
	integration: string,
	action: string,
	error: unknown,
	context?: ErrorLogContext
): void {
	console.error(`[${integration}] ${action} failed`, {
		...context,
		error,
	});
}
