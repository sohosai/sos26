import type {
	AllowedMimeType,
	FormItemConstraints,
	TextConstraintPattern,
} from "@sos26/shared";

export type PrismaConstraintFields = {
	constraintMinLength: number | null;
	constraintMaxLength: number | null;
	constraintPattern: string | null;
	constraintCustomPattern: string | null;
	constraintMinFiles: number | null;
	constraintMaxFiles: number | null;
	constraintAllowedMimeTypes: string | null;
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
		constraintAllowedMimeTypes:
			constraints?.allowedMimeTypes?.join(",") ?? null,
	};
}

export function constraintsFromPrisma({
	constraintMinLength,
	constraintMaxLength,
	constraintPattern,
	constraintCustomPattern,
	constraintMinFiles,
	constraintMaxFiles,
	constraintAllowedMimeTypes,
}: PrismaConstraintFields): FormItemConstraints | null {
	if (
		constraintMinLength === null &&
		constraintMaxLength === null &&
		constraintPattern === null &&
		constraintMinFiles === null &&
		constraintMaxFiles === null &&
		constraintAllowedMimeTypes === null
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
		...(constraintAllowedMimeTypes !== null && {
			allowedMimeTypes: constraintAllowedMimeTypes.split(
				","
			) as AllowedMimeType[],
		}),
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
		constraintAllowedMimeTypes,
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
			constraintAllowedMimeTypes,
		}),
	};
}

export function mapFormToApiShape<
	T extends { items: PrismaConstraintFields[] },
>(form: T) {
	return { ...form, items: form.items.map(mapItemToApiShape) };
}
