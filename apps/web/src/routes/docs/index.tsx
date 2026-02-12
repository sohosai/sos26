import { createFileRoute, Navigate } from "@tanstack/react-router";
import { articles } from "@/content/docs";

export const Route = createFileRoute("/docs/")({
	component: DocsIndex,
});

function DocsIndex() {
	const first = articles[0];
	if (first) {
		return <Navigate to="/docs/$slug" params={{ slug: first.slug }} replace />;
	}
	return null;
}
