import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import { ProjectContext } from "@/lib/project/context";
import { Route as ProjectRoute } from "../route";

export const Route = createFileRoute("/project/$projectId")({
	component: ProjectIdLayout,
	loader: async ({ params }) => {
		return params;
	},
});

function ProjectIdLayout() {
	const { projects } = ProjectRoute.useLoaderData();
	const params = Route.useLoaderData();
	const project = projects.find(p => p.id === params.projectId);
	if (!project) throw notFound();
	return (
		<ProjectContext.Provider value={project}>
			<Outlet />
		</ProjectContext.Provider>
	);
}
