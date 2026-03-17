import type { TextConstraintPattern, TextConstraints } from "@sos26/shared";

export type PrismaConstraintFields = {
	constraintMinLength: number | null;
	constraintMaxLength: number | null;
	constraintPattern: string | null;
	constraintCustomPattern: string | null;
};

export function constraintsToPrisma(
	constraints: TextConstraints | null | undefined
): PrismaConstraintFields {
	return {
		constraintMinLength: constraints?.minLength ?? null,
		constraintMaxLength: constraints?.maxLength ?? null,
		constraintPattern: constraints?.pattern ?? null,
		constraintCustomPattern: constraints?.customPattern ?? null,
	};
}

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

export function mapItemToApiShape<T extends PrismaConstraintFields>(item: T) {
	const {
		constraintMinLength,
		constraintMaxLength,
		constraintPattern,
		constraintCustomPattern,
		...rest
	} = item;
	return {
		...rest,
		constraints: constraintsFromPrisma({
			constraintMinLength,
			constraintMaxLength,
			constraintPattern,
			constraintCustomPattern,
		}),
	};
}

export function mapFormToApiShape<
	T extends { items: PrismaConstraintFields[] },
>(form: T) {
	return { ...form, items: form.items.map(mapItemToApiShape) };
}
