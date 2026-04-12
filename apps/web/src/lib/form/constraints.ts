import type { FormItem } from "@/components/form/type";

type NormalizedConstraints = FormItem["constraints"] | null;

/**
 * テキスト入力フィールドの制約を正規化する
 * @param constraints 元の制約オブジェクト
 * @returns 有効な制約プロパティのみを含むオブジェクト、または全て無効な場合はnull
 */
function normalizeTextConstraints(
	constraints: FormItem["constraints"] | null | undefined
): NormalizedConstraints {
	if (!constraints) return null;
	const next: NonNullable<FormItem["constraints"]> = {};
	if (constraints.minLength !== undefined)
		next.minLength = constraints.minLength;
	if (constraints.maxLength !== undefined)
		next.maxLength = constraints.maxLength;
	if (constraints.pattern !== undefined) next.pattern = constraints.pattern;
	if (constraints.customPattern !== undefined)
		next.customPattern = constraints.customPattern;
	return Object.keys(next).length > 0 ? next : null;
}

/**
 * ファイルアップロードフィールドの制約を正規化する
 * @param constraints 元の制約オブジェクト
 * @returns 有効な制約プロパティのみを含むオブジェクト、または全て無効な場合はnull
 */
function normalizeFileConstraints(
	constraints: FormItem["constraints"] | null | undefined
): NormalizedConstraints {
	if (!constraints) return null;
	const next: NonNullable<FormItem["constraints"]> = {};
	if (constraints.minFiles !== undefined) next.minFiles = constraints.minFiles;
	if (constraints.maxFiles !== undefined) next.maxFiles = constraints.maxFiles;
	if (constraints.allowedMimeTypes !== undefined)
		next.allowedMimeTypes = constraints.allowedMimeTypes;
	return Object.keys(next).length > 0 ? next : null;
}

/**
 * フォーム項目の種類に応じて制約を正規化する
 * @param type フォーム項目の種類（TEXT, TEXTAREA, FILE等）
 * @param constraints 元の制約オブジェクト
 * @returns 項目種類に応じた有効な制約、または該当する制約がない場合はnull
 */
export function normalizeItemConstraintsForType(
	type: FormItem["type"],
	constraints: FormItem["constraints"] | null | undefined
): NormalizedConstraints {
	switch (type) {
		case "TEXT":
		case "TEXTAREA":
			return normalizeTextConstraints(constraints);
		case "FILE":
			return normalizeFileConstraints(constraints);
		default:
			return null;
	}
}
