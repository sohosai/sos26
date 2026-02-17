import { useProjectStore } from "./store";

export function useProject() {
	const project = useProjectStore(s => s.project);
	if (!project) {
		throw new Error("useProject: project is not loaded yet");
	}
	return project;
}
