import {
	createFileRoute,
	notFound,
	Outlet,
	rootRouteId,
} from "@tanstack/react-router";

export const Route = createFileRoute("/dev")({
	beforeLoad: () => {
		if (!import.meta.env.DEV) {
			throw notFound({ routeId: rootRouteId });
		}
	},
	component: () => <Outlet />,
});
