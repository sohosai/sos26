import type { TextConstraintPattern, TextConstraints } from "@sos26/shared";

export type PrismaConstraintFields = {
	constraintMinLength: number | null;
	constraintMaxLength: number | null;
	constraintPattern: string | null;
	constraintCustomPattern: string | null;
};

export function constraintsFromPrisma({
	constraintMinLength,
	constraintMaxLength,
	constraintPattern,
	constraintCustomPattern,
}: PrismaConstraintFields): TextConstraints | null {
	if (
		constraintMinLength === null &&
		constraintMaxLength === null &&
		constraintPattern === null
	) {
		return null;
	}
	return {
		...(constraintMinLength !== null && { minLength: constraintMinLength }),
		...(constraintMaxLength !== null && { maxLength: constraintMaxLength }),
		...(constraintPattern !== null && {
			pattern: constraintPattern as TextConstraintPattern,
		}),
		...(constraintCustomPattern !== null && {
			customPattern: constraintCustomPattern,
		}),
	};
}
