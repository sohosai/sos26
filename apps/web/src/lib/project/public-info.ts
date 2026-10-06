import type { ProjectSnsLinkKey } from "@sos26/shared";
import {
	allowedImageExtensions,
	isAllowedImageFile,
	PROJECT_MAP_IMAGES_MAX_COUNT,
	projectSnsLinkInputSchemas,
} from "@sos26/shared";

/** 入力値が保存できない形式ならエラーメッセージを返す（未入力は可） */
export function getSnsLinkError(key: ProjectSnsLinkKey, value: string) {
	if (value === "") return undefined;
	const result = projectSnsLinkInputSchemas[key].safeParse(value);
	return result.success ? undefined : result.error.issues[0]?.message;
}

/** 掲載画像として追加できないファイルなら、その理由を返す */
export function getMapImagesError(files: File[], currentCount: number) {
	if (files.some(file => !isAllowedImageFile(file))) {
		return `画像ファイルのみアップロードできます（${allowedImageExtensions}）。`;
	}
	if (currentCount + files.length > PROJECT_MAP_IMAGES_MAX_COUNT) {
		return `掲載画像は最大${PROJECT_MAP_IMAGES_MAX_COUNT}枚までです。`;
	}
	return undefined;
}
