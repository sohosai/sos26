import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/committee/members/")({
	component: RouteComponent,
});

function RouteComponent() {
	return <div>Hello "/committee/members/"!</div>;
}
