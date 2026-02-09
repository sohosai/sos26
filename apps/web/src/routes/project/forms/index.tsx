import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/project/forms/")({
	component: RouteComponent,
});

function RouteComponent() {
	return <div>Hello "/project/forms/"!</div>;
}
