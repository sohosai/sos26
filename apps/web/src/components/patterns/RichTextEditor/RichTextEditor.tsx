import { Popover, Text } from "@radix-ui/themes";
import {
	IconBold,
	IconItalic,
	IconLink,
	IconList,
	IconListNumbers,
	IconQuote,
	IconStrikethrough,
	IconUnlink,
} from "@tabler/icons-react";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useId, useState } from "react";
import { Button, IconButton, TextField } from "@/components/primitives";
import styles from "./RichTextEditor.module.scss";

type RichTextEditorProps = {
	label: string;
	error?: string;
	placeholder?: string;
	value?: string;
	onChange?: (html: string) => void;
	required?: boolean;
};

export function RichTextEditor({
	label,
	error,
	placeholder,
	value,
	onChange,
	required,
}: RichTextEditorProps) {
	const id = useId();
	const errorId = `${id}-error`;

	const editor = useEditor({
		extensions: [
			StarterKit.configure({
				heading: false,
				codeBlock: false,
				code: false,
				horizontalRule: false,
			}),
			Link.configure({
				openOnClick: false,
				HTMLAttributes: {
					target: "_blank",
					rel: "noopener noreferrer",
				},
			}),
			Placeholder.configure({
				placeholder,
			}),
		],
		content: value,
		editorProps: {
			attributes: {
				id,
				role: "textbox",
				"aria-multiline": "true",
				"aria-label": label,
			},
		},
		onUpdate: ({ editor }) => {
			onChange?.(editor.getHTML());
		},
	});

	// 親の value が変更された時にエディタの内容を同期（リセット対応）
	useEffect(() => {
		if (!editor) return;
		const currentHtml = editor.getHTML();
		// 空の value でリセットされた場合、または異なる内容の場合のみ更新
		if (value === "" && currentHtml !== "<p></p>") {
			editor.commands.setContent("");
		} else if (value && value !== currentHtml) {
			editor.commands.setContent(value);
		}
	}, [editor, value]);

	return (
		<div className={styles.container}>
			<Text as="label" size="2" weight="medium" htmlFor={id}>
				{label}
				{required && <span aria-hidden="true"> *</span>}
			</Text>

			<div className={styles.editorWrapper} data-error={!!error || undefined}>
				<Toolbar editor={editor} />
				<div className={styles.editor}>
					<EditorContent editor={editor} />
				</div>
			</div>

			{error && (
				<Text id={errorId} size="1" color="red" role="alert">
					{error}
				</Text>
			)}
		</div>
	);
}

type ToolbarProps = {
	editor: ReturnType<typeof useEditor>;
};

function Toolbar({ editor }: ToolbarProps) {
	if (!editor) return null;

	return (
		<div className={styles.toolbar} data-accent-color="gray">
			<IconButton
				size="1"
				intent={editor.isActive("bold") ? "secondary" : "ghost"}
				onClick={() => editor.chain().focus().toggleBold().run()}
				aria-label="太字"
			>
				<IconBold size={16} />
			</IconButton>
			<IconButton
				size="1"
				intent={editor.isActive("italic") ? "secondary" : "ghost"}
				onClick={() => editor.chain().focus().toggleItalic().run()}
				aria-label="斜体"
			>
				<IconItalic size={16} />
			</IconButton>
			<IconButton
				size="1"
				intent={editor.isActive("strike") ? "secondary" : "ghost"}
				onClick={() => editor.chain().focus().toggleStrike().run()}
				aria-label="取り消し線"
			>
				<IconStrikethrough size={16} />
			</IconButton>
			<LinkButton editor={editor} />

			<div className={styles.separator} />

			<IconButton
				size="1"
				intent={editor.isActive("bulletList") ? "secondary" : "ghost"}
				onClick={() => editor.chain().focus().toggleBulletList().run()}
				aria-label="箇条書き"
			>
				<IconList size={16} />
			</IconButton>
			<IconButton
				size="1"
				intent={editor.isActive("orderedList") ? "secondary" : "ghost"}
				onClick={() => editor.chain().focus().toggleOrderedList().run()}
				aria-label="番号リスト"
			>
				<IconListNumbers size={16} />
			</IconButton>
			<IconButton
				size="1"
				intent={editor.isActive("blockquote") ? "secondary" : "ghost"}
				onClick={() => editor.chain().focus().toggleBlockquote().run()}
				aria-label="引用"
			>
				<IconQuote size={16} />
			</IconButton>
		</div>
	);
}

type LinkButtonProps = {
	editor: NonNullable<ReturnType<typeof useEditor>>;
};

function LinkButton({ editor }: LinkButtonProps) {
	const [open, setOpen] = useState(false);
	const [url, setUrl] = useState("");

	const handleOpen = (nextOpen: boolean) => {
		if (nextOpen) {
			const existingUrl = editor.getAttributes("link").href as
				| string
				| undefined;
			setUrl(existingUrl ?? "");
		}
		setOpen(nextOpen);
	};

	const applyLink = () => {
		if (url.trim()) {
			editor
				.chain()
				.focus()
				.extendMarkRange("link")
				.setLink({ href: url.trim() })
				.run();
		}
		setOpen(false);
	};

	const removeLink = () => {
		editor.chain().focus().extendMarkRange("link").unsetLink().run();
		setOpen(false);
	};

	return (
		<Popover.Root open={open} onOpenChange={handleOpen}>
			<Popover.Trigger>
				<IconButton
					size="1"
					intent={editor.isActive("link") ? "secondary" : "ghost"}
					aria-label="リンク"
				>
					<IconLink size={16} />
				</IconButton>
			</Popover.Trigger>
			<Popover.Content side="bottom" align="start" sideOffset={4}>
				<form
					className={styles.linkPopoverContent}
					onSubmit={e => {
						e.preventDefault();
						applyLink();
					}}
				>
					<TextField
						label="URL"
						placeholder="https://example.com"
						value={url}
						onChange={setUrl}
					/>
					<div className={styles.linkPopoverActions}>
						{editor.isActive("link") && (
							<Button intent="secondary" size="1" onClick={removeLink}>
								<IconUnlink size={14} />
								リンクを解除
							</Button>
						)}
						<Button intent="primary" size="1" type="submit">
							適用
						</Button>
					</div>
				</form>
			</Popover.Content>
		</Popover.Root>
	);
}
