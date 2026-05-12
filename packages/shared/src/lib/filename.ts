const INVALID_FILE_NAME_CHARS = /[<>:"/\\|?*]/g;
const LEADING_OR_TRAILING_PUNCTUATION = /^[.\s_]+|[.\s_]+$/g;

/**
 * ファイル名の一部として安全に利用できる文字列へ変換する。
 */
export function sanitizeFileNameSegment(value: string): string {
	const sanitized = value
		.trim()
		.replace(INVALID_FILE_NAME_CHARS, "_")
		.replace(/\s+/g, " ")
		.replace(/_+/g, "_")
		.replace(LEADING_OR_TRAILING_PUNCTUATION, "");

	return sanitized || "_";
}

/**
 * ファイル名を「ベース名」と「拡張子」に分割する。
 */
export function splitFileName(fileName: string): {
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

/**
 * 企画番号を 3 桁固定の文字列に変換する。
 */
export function formatProjectNumber(projectNumber: number): string {
	return String(projectNumber).padStart(3, "0");
}

/**
 * フォーム添付ファイルのダウンロード用ファイル名を生成する。
 *  `{企画番号}_{フォームタイトル}_{企画名}_{元ファイル名}`
 */
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

/**
 * パス内のファイル名にサフィックスを付与する。
 */
export function appendSuffixToPath(path: string, suffix: string): string {
	const lastSlash = path.lastIndexOf("/");
	const dir = lastSlash >= 0 ? path.slice(0, lastSlash + 1) : "";
	const fileName = lastSlash >= 0 ? path.slice(lastSlash + 1) : path;
	const { baseName, extension } = splitFileName(fileName);
	return `${dir}${baseName}_${suffix}${extension}`;
}
