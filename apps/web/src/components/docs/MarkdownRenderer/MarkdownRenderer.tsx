import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import styles from "./MarkdownRenderer.module.scss";

type MarkdownRendererProps = {
	content: string;
};

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
	return (
		<div className={styles.prose}>
			<Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
		</div>
	);
}
