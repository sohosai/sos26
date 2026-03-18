import { formatProjectNumber } from "@/lib/format";

const INVALID_FILE_NAME_CHARS = /[<>:"/\\|?*]/g;
const LEADING_OR_TRAILING_PUNCTUATION = /^[.\s_]+|[.\s_]+$/g;

function sanitizeFileNameSegment(value: string): string {
	const sanitized = value
		.trim()
		.replace(INVALID_FILE_NAME_CHARS, "_")
		.replace(/\s+/g, " ")
		.replace(/_+/g, "_")
		.replace(LEADING_OR_TRAILING_PUNCTUATION, "");

	return sanitized || "_";
}

function splitFileName(fileName: string): {
	baseName: string;
	extension: string;
} {
	const lastDot = fileName.lastIndexOf(".");
	if (lastDot <= 0) {
		return { baseName: fileName, extension: "" };
	}

	return {
		baseName: fileName.slice(0, lastDot),
		extension: fileName.slice(lastDot),
	};
}

export function buildFormDownloadFileName(params: {
	projectNumber: number;
	formTitle: string;
	projectName: string;
	originalFileName: string;
}): string {
	const { baseName, extension } = splitFileName(params.originalFileName);

	return [
		formatProjectNumber(params.projectNumber),
		sanitizeFileNameSegment(params.formTitle),
		sanitizeFileNameSegment(params.projectName),
		`${sanitizeFileNameSegment(baseName)}${extension}`,
	].join("_");
}
