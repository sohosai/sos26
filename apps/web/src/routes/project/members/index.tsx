import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/project/members/")({
	component: RouteComponent,
});

function RouteComponent() {
	return <div>Hello "/project/members/"!</div>;
}
