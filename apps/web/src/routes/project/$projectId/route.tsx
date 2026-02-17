import { createFileRoute, Outlet } from "@tanstack/react-router";
import { getProjectDetail } from "@/lib/api/project";
import { ProjectContext } from "@/lib/project/context";

export const Route = createFileRoute("/project/$projectId")({
	component: ProjectIdLayout,
	loader: async ({ params }) => {
		return await getProjectDetail(params.projectId);
	},
});

function ProjectIdLayout() {
	const { project } = Route.useLoaderData();
	return (
		<ProjectContext.Provider value={project}>
			<Outlet />
		</ProjectContext.Provider>
	);
}
