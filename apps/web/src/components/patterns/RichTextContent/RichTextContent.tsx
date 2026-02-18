import Link from "@tiptap/extension-link";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";
import styles from "./RichTextContent.module.scss";

type RichTextContentProps = {
	content: string;
};

export function RichTextContent({ content }: RichTextContentProps) {
	const editor = useEditor({
		extensions: [
			StarterKit.configure({
				heading: false,
				codeBlock: false,
				code: false,
				horizontalRule: false,
			}),
			Link.configure({
				openOnClick: true,
				HTMLAttributes: {
					target: "_blank",
					rel: "noopener noreferrer",
				},
			}),
		],
		content,
		editable: false,
	});

	useEffect(() => {
		if (!editor) return;
		if (content !== editor.getHTML()) {
			editor.commands.setContent(content);
		}
	}, [editor, content]);

	return (
		<div className={styles.content}>
			<EditorContent editor={editor} />
		</div>
	);
}
