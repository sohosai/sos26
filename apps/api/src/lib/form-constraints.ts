import type { FormItemConstraints, TextConstraintPattern } from "@sos26/shared";

export type PrismaConstraintFields = {
	constraintMinLength: number | null;
	constraintMaxLength: number | null;
	constraintPattern: string | null;
	constraintCustomPattern: string | null;
	constraintMinFiles: number | null;
	constraintMaxFiles: number | null;
};

export function constraintsToPrisma(
	constraints: FormItemConstraints | null | undefined
): PrismaConstraintFields {
	return {
		constraintMinLength: constraints?.minLength ?? null,
		constraintMaxLength: constraints?.maxLength ?? null,
		constraintPattern: constraints?.pattern ?? null,
		constraintCustomPattern: constraints?.customPattern ?? null,
		constraintMinFiles: constraints?.minFiles ?? null,
		constraintMaxFiles: constraints?.maxFiles ?? null,
	};
}

export function constraintsFromPrisma({
	constraintMinLength,
	constraintMaxLength,
	constraintPattern,
	constraintCustomPattern,
	constraintMinFiles,
	constraintMaxFiles,
}: PrismaConstraintFields): FormItemConstraints | null {
	if (
		constraintMinLength === null &&
		constraintMaxLength === null &&
		constraintPattern === null &&
		constraintMinFiles === null &&
		constraintMaxFiles === null
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
		...(constraintMinFiles !== null && { minFiles: constraintMinFiles }),
		...(constraintMaxFiles !== null && { maxFiles: constraintMaxFiles }),
	};
}

export function mapItemToApiShape<T extends PrismaConstraintFields>(item: T) {
	const {
		constraintMinLength,
		constraintMaxLength,
		constraintPattern,
		constraintCustomPattern,
		constraintMinFiles,
		constraintMaxFiles,
		...rest
	} = item;
	return {
		...rest,
		constraints: constraintsFromPrisma({
			constraintMinLength,
			constraintMaxLength,
			constraintPattern,
			constraintCustomPattern,
			constraintMinFiles,
			constraintMaxFiles,
		}),
	};
}

export function mapFormToApiShape<
	T extends { items: PrismaConstraintFields[] },
>(form: T) {
	return { ...form, items: form.items.map(mapItemToApiShape) };
}
