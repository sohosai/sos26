/**
 * RichTextEditor (tiptap StarterKit + Link) が出力する HTML に対応する
 * DOMPurify 用の許可タグ・属性定義。
 *
 * API (isomorphic-dompurify) と Web (dompurify) の両方で共有する。
 */
export const SANITIZE_ALLOWED_TAGS = [
	"p",
	"br",
	"strong",
	"em",
	"s",
	"ul",
	"ol",
	"li",
	"blockquote",
	"a",
] as const;

export const SANITIZE_ALLOWED_ATTR = ["href", "target", "rel"] as const;
