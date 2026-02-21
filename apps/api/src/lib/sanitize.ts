import { SANITIZE_ALLOWED_ATTR, SANITIZE_ALLOWED_TAGS } from "@sos26/shared";
import DOMPurify from "isomorphic-dompurify";

/**
 * お知らせ本文の HTML をサニタイズする。
 * RichTextEditor が生成する範囲のタグ・属性のみ残し、それ以外は除去する。
 */
export function sanitizeHtml(dirty: string): string {
	return DOMPurify.sanitize(dirty, {
		ALLOWED_TAGS: [...SANITIZE_ALLOWED_TAGS],
		ALLOWED_ATTR: [...SANITIZE_ALLOWED_ATTR],
	});
}
